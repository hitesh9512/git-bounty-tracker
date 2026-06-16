import { prisma } from '../config/prisma';
import { addOrgScanJob } from '../queue/scannerQueue';

async function main() {
  // Find the first user in the DB
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in the database.');
    return;
  }

  console.log(`Tracking organization "lobster-trap" for user ${user.email}...`);

  // Check if already tracked
  let org = await prisma.organization.findFirst({
    where: {
      name: 'lobster-trap',
      userId: user.id,
    },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'lobster-trap',
        userId: user.id,
      },
    });
    console.log(`Created organization track for "lobster-trap" (ID: ${org.id}).`);
  } else {
    console.log(`"lobster-trap" is already tracked (ID: ${org.id}).`);
  }

  // Trigger scan
  await addOrgScanJob(org.id);
  console.log('Triggered scan job in BullMQ queue.');

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
