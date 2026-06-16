import { Worker, Job } from 'bullmq';
import { connectionOptions } from './scannerQueue';
import { prisma } from '../config/prisma';
import { decrypt } from '../services/encryption';
import { fetchOrgRepos, fetchRepoIssues, parseBountyAmount } from '../services/github';
import { sendNotificationToUser } from '../sockets/socketManager';

export const scannerWorker = new Worker(
  'scannerQueue',
  async (job: Job) => {
    console.log(`[Worker] Starting job: ${job.name} (id: ${job.id})`);

    try {
      if (job.name === 'trigger_all_scans') {
        // Fetch all organizations in the system
        const orgs = await prisma.organization.findMany();
        console.log(`[Worker] Found ${orgs.length} organizations to queue for scanning.`);
        
        // Add individual scan jobs to the queue
        const { scannerQueue } = require('./scannerQueue');
        for (const org of orgs) {
          await scannerQueue.add(
            `scan_org_${org.id}`,
            { organizationId: org.id },
            { jobId: `org_${org.id}_${Date.now()}` }
          );
        }
        return { triggered: orgs.length };
      }

      // Individual organization scan
      const { organizationId } = job.data;
      if (!organizationId) {
        throw new Error('Missing organizationId in job data');
      }

      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          user: {
            include: {
              githubAccount: true,
            },
          },
        },
      });

      if (!org) {
        console.warn(`[Worker] Organization ${organizationId} not found. Skipping.`);
        return { status: 'skipped', reason: 'Organization not found' };
      }

      const githubAccount = org.user.githubAccount;
      if (!githubAccount) {
        console.warn(`[Worker] User ${org.userId} has no GitHub account configured. Skipping scan.`);
        return { status: 'skipped', reason: 'GitHub PAT not configured' };
      }

      // Decrypt PAT
      const pat = decrypt(githubAccount.encryptedPat, githubAccount.iv, githubAccount.tag);
      console.log(`[Worker] Scanning organization: ${org.name} for user: ${org.user.email}`);

      // 1. Fetch repositories
      let reposData;
      try {
        reposData = await fetchOrgRepos(pat, org.name);
      } catch (err: any) {
        console.error(`[Worker] Error fetching repositories for org ${org.name}:`, err.message);
        throw err;
      }

      console.log(`[Worker] Found ${reposData.length} repositories for org ${org.name}.`);

      // We process repositories sequentially to respect rate limits and keep order
      for (const repoData of reposData) {
        const repoGithubId = BigInt(repoData.id);
        
        // Upsert repository in database
        const dbRepo = await prisma.repository.upsert({
          where: { githubId: repoGithubId },
          create: {
            githubId: repoGithubId,
            name: repoData.name,
            fullName: repoData.full_name,
            description: repoData.description,
            organizationId: org.id,
          },
          update: {
            name: repoData.name,
            fullName: repoData.full_name,
            description: repoData.description,
          },
        });

        // 2. Fetch open issues for repository
        let openIssuesData = [];
        try {
          openIssuesData = await fetchRepoIssues(pat, org.name, repoData.name, 'open');
        } catch (err: any) {
          console.error(`[Worker] Error fetching open issues for repo ${repoData.full_name}:`, err.message);
          continue; // Move to next repository
        }

        // Fetch closed issues for repository
        let closedIssuesData = [];
        try {
          closedIssuesData = await fetchRepoIssues(pat, org.name, repoData.name, 'closed');
        } catch (err: any) {
          console.warn(`[Worker] Error fetching closed issues for repo ${repoData.full_name}:`, err.message);
        }

        const activeOpenIssueIds = new Set<bigint>();

        const processIssue = async (issueData: any) => {
          const issueGithubId = BigInt(issueData.id);
          const labels = issueData.labels.map((l: any) => (typeof l === 'string' ? l : l.name || ''));

          const { hasBounty, amount } = parseBountyAmount(
            issueData.title,
            issueData.body || '',
            labels
          );

          // Find existing issue in DB
          const existingIssue = await prisma.issue.findUnique({
            where: { githubId: issueGithubId },
          });

          if (!existingIssue) {
            // New issue found
            const newIssue = await prisma.issue.create({
              data: {
                githubId: issueGithubId,
                number: issueData.number,
                title: issueData.title,
                body: issueData.body,
                url: issueData.html_url,
                state: issueData.state,
                bountyAmount: amount,
                hasBounty,
                labels,
                repositoryId: dbRepo.id,
              },
            });

            // If it has a bounty, trigger notification
            if (hasBounty) {
              const bountyMessage = `A new bounty of $${amount || 'unspecified'} was detected in ${dbRepo.fullName}#${issueData.number}: "${issueData.title}"`;
              
              // Create notification in DB
              const notif = await prisma.notification.create({
                data: {
                  userId: org.userId,
                  title: 'New Bounty Detected! 💰',
                  message: bountyMessage,
                },
              });

              // Emit via Socket.io
              sendNotificationToUser(org.userId, 'new_notification', {
                id: notif.id,
                title: notif.title,
                message: notif.message,
                isRead: notif.isRead,
                createdAt: notif.createdAt,
              });
              
              // Also emit real-time bounty update
              sendNotificationToUser(org.userId, 'new_bounty', {
                issue: {
                  ...newIssue,
                  githubId: newIssue.githubId.toString(),
                  repository: {
                    fullName: dbRepo.fullName
                  }
                }
              });
            }
          } else {
            // Existing issue: check for changes
            const bountyAmountChanged = existingIssue.bountyAmount !== amount;
            const hasBountyChanged = existingIssue.hasBounty !== hasBounty;
            const stateChanged = existingIssue.state !== issueData.state;

            if (bountyAmountChanged || hasBountyChanged || stateChanged) {
              // Create history entry
              await prisma.issueHistory.create({
                data: {
                  issueId: existingIssue.id,
                  oldAmount: existingIssue.bountyAmount,
                  newAmount: amount,
                  oldState: existingIssue.state,
                  newState: issueData.state,
                },
              });

              // Update issue
              const updatedIssue = await prisma.issue.update({
                where: { id: existingIssue.id },
                data: {
                  title: issueData.title,
                  body: issueData.body,
                  state: issueData.state,
                  bountyAmount: amount,
                  hasBounty,
                  labels,
                },
              });

              // Notify if bounty amount increased or a bounty was newly added
              const isNewOrHigherBounty = (hasBounty && !existingIssue.hasBounty) || 
                (hasBounty && existingIssue.hasBounty && amount && existingIssue.bountyAmount && amount > existingIssue.bountyAmount);

              if (isNewOrHigherBounty) {
                const amountText = amount ? `$${amount}` : 'unspecified';
                const oldAmountText = existingIssue.bountyAmount ? `$${existingIssue.bountyAmount}` : 'none';
                const bountyMessage = `Bounty updated in ${dbRepo.fullName}#${issueData.number}: from ${oldAmountText} to ${amountText}. Title: "${issueData.title}"`;

                const notif = await prisma.notification.create({
                  data: {
                    userId: org.userId,
                    title: 'Bounty Updated! 📈',
                    message: bountyMessage,
                  },
                });

                sendNotificationToUser(org.userId, 'new_notification', {
                  id: notif.id,
                  title: notif.title,
                  message: notif.message,
                  isRead: notif.isRead,
                  createdAt: notif.createdAt,
                });
              }

              // Notify if issue closed
              if (stateChanged && issueData.state === 'closed') {
                const closedMessage = `Bounty issue ${dbRepo.fullName}#${issueData.number} was closed. Title: "${issueData.title}"`;

                const notif = await prisma.notification.create({
                  data: {
                    userId: org.userId,
                    title: 'Bounty Issue Closed 🏁',
                    message: closedMessage,
                  },
                });

                sendNotificationToUser(org.userId, 'new_notification', {
                  id: notif.id,
                  title: notif.title,
                  message: notif.message,
                  isRead: notif.isRead,
                  createdAt: notif.createdAt,
                });
              }

              // Emit updates to UI
              sendNotificationToUser(org.userId, 'bounty_updated', {
                issue: {
                  ...updatedIssue,
                  githubId: updatedIssue.githubId.toString(),
                  repository: {
                    fullName: dbRepo.fullName
                  }
                }
              });
            }
          }
        };

        // Process open issues
        for (const issueData of openIssuesData) {
          activeOpenIssueIds.add(BigInt(issueData.id));
          await processIssue(issueData);
        }

        // Process closed issues
        for (const issueData of closedIssuesData) {
          await processIssue(issueData);
        }

        // 3. Mark issues as closed if they are no longer returned in the "open" issues call but are stored as "open" in our DB
        const storedOpenIssues = await prisma.issue.findMany({
          where: {
            repositoryId: dbRepo.id,
            state: 'open',
          },
        });

        for (const storedIssue of storedOpenIssues) {
          if (!activeOpenIssueIds.has(storedIssue.githubId)) {
            // This issue was closed (or deleted)
            const updated = await prisma.issue.update({
              where: { id: storedIssue.id },
              data: { state: 'closed' },
            });

            await prisma.issueHistory.create({
              data: {
                issueId: storedIssue.id,
                oldAmount: storedIssue.bountyAmount,
                newAmount: storedIssue.bountyAmount,
                oldState: 'open',
                newState: 'closed',
              },
            });

            if (storedIssue.hasBounty) {
              const closedMessage = `Bounty issue ${dbRepo.fullName}#${storedIssue.number} was closed. Title: "${storedIssue.title}"`;
              const notif = await prisma.notification.create({
                data: {
                  userId: org.userId,
                  title: 'Bounty Issue Closed 🏁',
                  message: closedMessage,
                },
              });

              sendNotificationToUser(org.userId, 'new_notification', {
                id: notif.id,
                title: notif.title,
                message: notif.message,
                isRead: notif.isRead,
                createdAt: notif.createdAt,
              });

              sendNotificationToUser(org.userId, 'bounty_updated', {
                issue: {
                  ...updated,
                  githubId: updated.githubId.toString(),
                  repository: {
                    fullName: dbRepo.fullName
                  }
                }
              });
            }
          }
        }
      }

      console.log(`[Worker] Completed scan for organization: ${org.name}`);
      return { status: 'completed', org: org.name };
    } catch (error: any) {
      console.error(`[Worker] Job ${job.name} failed with error:`, error);
      throw error;
    }
  },
  {
    connection: connectionOptions,
    concurrency: 1, // process one org at a time to prevent rate limits
  }
);

scannerWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.name} completed successfully`);
});

scannerWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.name} failed with error: ${err.message}`);
});
