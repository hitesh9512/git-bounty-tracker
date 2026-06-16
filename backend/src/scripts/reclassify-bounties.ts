/**
 * One-shot script: re-evaluate hasBounty on every issue in the DB
 * using the current label-only logic (isBountyLabel).
 *
 * Run with: npx ts-node -r tsconfig-paths/register src/scripts/reclassify-bounties.ts
 */
import { prisma } from '../config/prisma';
import { isBountyLabel, parseBountyAmount } from '../services/github';

async function main() {
  const issues = await prisma.issue.findMany({
    select: { id: true, title: true, body: true, labels: true, hasBounty: true, bountyAmount: true },
  });

  console.log(`Found ${issues.length} issues to reclassify.`);

  let updated = 0;
  let skipped = 0;

  for (const issue of issues) {
    const labels: string[] = (issue.labels as string[]) ?? [];
    const { hasBounty, amount } = parseBountyAmount(issue.title, issue.body ?? '', labels);

    const changed =
      issue.hasBounty !== hasBounty ||
      issue.bountyAmount !== amount;

    if (changed) {
      await prisma.issue.update({
        where: { id: issue.id },
        data: { hasBounty, bountyAmount: amount },
      });
      updated++;
      console.log(
        `[UPDATED] ${issue.id.slice(0, 8)}… labels=[${labels.join(', ')}] hasBounty=${hasBounty} amount=${amount}`
      );
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. Updated: ${updated} | Unchanged: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
