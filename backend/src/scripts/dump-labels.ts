/**
 * Diagnostic: dump all unique labels stored in the DB
 */
import { prisma } from '../config/prisma';

async function main() {
  const issues = await prisma.issue.findMany({
    select: { id: true, title: true, labels: true, hasBounty: true, state: true },
  });

  // Collect all unique labels
  const labelCounts = new Map<string, number>();
  for (const issue of issues) {
    const labels = (issue.labels as string[]) ?? [];
    for (const label of labels) {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }
  }

  // Sort by count descending
  const sorted = [...labelCounts.entries()].sort((a, b) => b[1] - a[1]);

  console.log(`Total issues: ${issues.length}`);
  console.log(`Total unique labels: ${sorted.length}`);
  console.log(`\nTop 50 labels:`);
  for (const [label, count] of sorted.slice(0, 50)) {
    console.log(`  ${count}x  "${label}"`);
  }

  // Also check: how many issues have hasBounty=true?
  const bountyIssues = issues.filter(i => i.hasBounty);
  console.log(`\nIssues with hasBounty=true: ${bountyIssues.length}`);
  if (bountyIssues.length > 0) {
    for (const i of bountyIssues.slice(0, 10)) {
      console.log(`  "${i.title}" labels=[${(i.labels as string[]).join(', ')}]`);
    }
  }

  // Check for any label containing "bounty" or "reward" (case-insensitive)
  const bountyLabels = sorted.filter(([label]) => 
    label.toLowerCase().includes('bounty') || label.toLowerCase().includes('reward')
  );
  console.log(`\nLabels containing "bounty" or "reward": ${bountyLabels.length}`);
  for (const [label, count] of bountyLabels) {
    console.log(`  ${count}x  "${label}"`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
