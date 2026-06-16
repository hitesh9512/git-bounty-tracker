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

  console.log('Fetching labels in calcom/cal.com...');
  try {
    const res = await octokit.issues.listLabelsForRepo({
      owner: 'calcom',
      repo: 'cal.com',
      per_page: 100,
    });
    const bountyLabels = res.data.filter((l: any) => 
      l.name.toLowerCase().includes('bounty') || l.name.toLowerCase().includes('reward')
    );
    console.log(`Found ${bountyLabels.length} labels matching bounty/reward:`);
    for (const label of bountyLabels) {
      console.log(`- ${label.name}`);
    }
  } catch (err: any) {
    console.error('Error fetching labels:', err.message);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
