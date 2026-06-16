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

  const calcom = orgs.find(o => o.name.toLowerCase() === 'calcom');
  if (!calcom || !calcom.user.githubAccount) {
    console.log('Calcom org not found or no github account.');
    return;
  }

  const pat = decrypt(calcom.user.githubAccount.encryptedPat, calcom.user.githubAccount.iv, calcom.user.githubAccount.tag);
  const octokit = new Octokit({ auth: pat });

  console.log('Searching for issues in calcom/cal.com with label: bounty');
  try {
    const res = await octokit.issues.listForRepo({
      owner: 'calcom',
      repo: 'cal.com',
      labels: 'bounty',
      state: 'all',
      per_page: 10,
    });
    console.log(`Found ${res.data.length} issues in calcom/cal.com:`);
    for (const issue of res.data) {
      console.log(`- #${issue.number}: ${issue.title} (state: ${issue.state})`);
    }
  } catch (err: any) {
    console.error('Error fetching calcom/cal.com issues:', err.message);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
