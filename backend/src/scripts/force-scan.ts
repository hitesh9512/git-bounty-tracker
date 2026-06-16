import { prisma } from '../config/prisma';
import { decrypt } from '../services/encryption';
import { fetchOrgRepos, fetchRepoIssues, parseBountyAmount } from '../services/github';

async function main() {
  const orgs = await prisma.organization.findMany({
    include: {
      user: {
        include: {
          githubAccount: true,
        },
      },
    },
  });

  console.log(`Found ${orgs.length} organizations in the DB.`);

  for (const org of orgs) {
    console.log(`\n==================================================`);
    console.log(`Scanning organization: ${org.name}`);
    console.log(`==================================================`);

    const githubAccount = org.user.githubAccount;
    if (!githubAccount) {
      console.warn(`User ${org.userId} has no GitHub account configured. Skipping.`);
      continue;
    }

    const pat = decrypt(githubAccount.encryptedPat, githubAccount.iv, githubAccount.tag);
    
    let reposData;
    try {
      reposData = await fetchOrgRepos(pat, org.name);
    } catch (err: any) {
      console.error(`Error fetching repositories for org ${org.name}:`, err.message);
      continue;
    }

    console.log(`Found ${reposData.length} repositories for org ${org.name}.`);

    for (const repoData of reposData) {
      const repoGithubId = BigInt(repoData.id);
      
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

      console.log(`Checking repo: ${repoData.full_name}`);

      // Fetch open issues
      let openIssuesData = [];
      try {
        openIssuesData = await fetchRepoIssues(pat, org.name, repoData.name, 'open');
      } catch (err: any) {
        console.error(`  Error fetching open issues for repo ${repoData.full_name}:`, err.message);
        continue;
      }

      // Fetch closed issues
      let closedIssuesData = [];
      try {
        closedIssuesData = await fetchRepoIssues(pat, org.name, repoData.name, 'closed');
      } catch (err: any) {
        console.warn(`  Error fetching closed issues for repo ${repoData.full_name}:`, err.message);
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
          await prisma.issue.create({
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
          if (hasBounty) {
            console.log(`  [NEW BOUNTY] #${issueData.number}: ${issueData.title} ($${amount})`);
          }
        } else {
          const bountyAmountChanged = existingIssue.bountyAmount !== amount;
          const hasBountyChanged = existingIssue.hasBounty !== hasBounty;
          const stateChanged = existingIssue.state !== issueData.state;

          if (bountyAmountChanged || hasBountyChanged || stateChanged) {
            await prisma.issueHistory.create({
              data: {
                issueId: existingIssue.id,
                oldAmount: existingIssue.bountyAmount,
                newAmount: amount,
                oldState: existingIssue.state,
                newState: issueData.state,
              },
            });

            await prisma.issue.update({
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
            console.log(`  [UPDATED] #${issueData.number}: ${issueData.title} (bounty=${hasBounty}, amount=${amount}, state=${issueData.state})`);
          }
        }
      };

      for (const issueData of openIssuesData) {
        activeOpenIssueIds.add(BigInt(issueData.id));
        await processIssue(issueData);
      }

      for (const issueData of closedIssuesData) {
        await processIssue(issueData);
      }

      // Mark issues as closed if they are no longer returned in the "open" issues call but are stored as "open" in our DB
      const storedOpenIssues = await prisma.issue.findMany({
        where: {
          repositoryId: dbRepo.id,
          state: 'open',
        },
      });

      for (const storedIssue of storedOpenIssues) {
        if (!activeOpenIssueIds.has(storedIssue.githubId)) {
          await prisma.issue.update({
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
          console.log(`  [AUTO-CLOSED] #${storedIssue.number}: ${storedIssue.title}`);
        }
      }
    }
  }

  console.log('\nAll scans finished successfully.');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
