import { prisma } from '../config/prisma';

async function main() {
  const orgs = await prisma.organization.findMany({
    include: {
      repos: {
        select: {
          name: true,
          fullName: true,
        }
      }
    }
  });
  console.log('Tracked Organizations:');
  for (const org of orgs) {
    console.log(`- ID: ${org.id}, Name: ${org.name}, Repos: ${org.repos.length}`);
    if (org.repos.length > 0) {
      console.log(`  Repos: ${org.repos.map(r => r.name).slice(0, 10).join(', ')}`);
    }
  }
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
