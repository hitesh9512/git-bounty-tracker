import { prisma } from '../config/prisma';
import { addOrgScanJob } from '../queue/scannerQueue';

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log(`Found ${orgs.length} organizations to trigger scans for.`);
  
  for (const org of orgs) {
    console.log(`Triggering scan for ${org.name} (ID: ${org.id})...`);
    await addOrgScanJob(org.id);
  }
  
  console.log('Successfully triggered all scans.');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
