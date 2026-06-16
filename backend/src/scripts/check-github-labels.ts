import { prisma } from '../config/prisma';
import { decrypt } from '../services/encryption';
import { Octokit } from '@octokit/rest';

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

  for (const org of orgs) {
    console.log(`Checking GitHub for org: ${org.name}`);
    const githubAccount = org.user.githubAccount;
    if (!githubAccount) {
      console.log(`No github account for org ${org.name}`);
      continue;
    }
    const pat = decrypt(githubAccount.encryptedPat, githubAccount.iv, githubAccount.tag);
    const octokit = new Octokit({ auth: pat });

    try {
      // Search for issues in this org with label "bounty"
      const resBounty = await octokit.search.issuesAndPullRequests({
        q: `org:${org.name} is:issue label:bounty`,
        per_page: 5,
      });
      console.log(`  Issues with label "bounty" in org ${org.name}: ${resBounty.data.total_count}`);
      for (const issue of resBounty.data.items) {
        console.log(`    - [${issue.repository_url.split('/').pop()}] #${issue.number}: ${issue.title} (labels: ${issue.labels.map((l: any) => l.name).join(', ')})`);
      }
    } catch (err: any) {
      console.error(`  Error searching bounty for ${org.name}:`, err.message);
    }

    try {
      // Search for issues in this org with label "reward"
      const resReward = await octokit.search.issuesAndPullRequests({
        q: `org:${org.name} is:issue label:reward`,
        per_page: 5,
      });
      console.log(`  Issues with label "reward" in org ${org.name}: ${resReward.data.total_count}`);
      for (const issue of resReward.data.items) {
        console.log(`    - [${issue.repository_url.split('/').pop()}] #${issue.number}: ${issue.title} (labels: ${issue.labels.map((l: any) => l.name).join(', ')})`);
      }
    } catch (err: any) {
      console.error(`  Error searching reward for ${org.name}:`, err.message);
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
