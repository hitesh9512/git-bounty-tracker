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

  const first = orgs.find(o => o.user.githubAccount);
  if (!first || !first.user.githubAccount) {
    console.log('No user with github account.');
    return;
  }

  const pat = decrypt(first.user.githubAccount.encryptedPat, first.user.githubAccount.iv, first.user.githubAccount.tag);
  const octokit = new Octokit({ auth: pat });

  console.log('Searching GitHub globally for issues with label "bounty"...');
  try {
    const res = await octokit.search.issuesAndPullRequests({
      q: 'is:issue label:bounty state:open',
      per_page: 10,
    });
    console.log(`Total active bounty issues found globally: ${res.data.total_count}`);
    for (const issue of res.data.items) {
      console.log(`- Repo: ${issue.repository_url.replace('https://api.github.com/repos/', '')} | Title: ${issue.title} | Labels: ${issue.labels.map((l: any) => l.name).join(', ')}`);
    }
  } catch (err: any) {
    console.error('Error during global search:', err.message);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
