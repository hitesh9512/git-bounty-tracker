import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { decrypt } from '../services/encryption';
import { fetchOrgRepos } from '../services/github';
import { addOrgScanJob } from '../queue/scannerQueue';

const router = Router();

/**
 * @route GET /api/organizations
 * @desc Get all organizations tracked by the authenticated user
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { userId: req.userId! },
      include: {
        _count: {
          select: { repos: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // We can also fetch the number of bounty issues per org
    const orgsWithBounties = await Promise.all(
      orgs.map(async (org) => {
        const repoIds = await prisma.repository.findMany({
          where: { organizationId: org.id },
          select: { id: true },
        }).then(repos => repos.map(r => r.id));

        const bountyCount = await prisma.issue.count({
          where: {
            repositoryId: { in: repoIds },
            hasBounty: true,
            state: 'open',
          },
        });

        return {
          id: org.id,
          name: org.name,
          createdAt: org.createdAt,
          reposCount: org._count.repos,
          bountyCount,
        };
      })
    );

    return res.json(orgsWithBounties);
  } catch (err: any) {
    console.error('Error fetching organizations:', err);
    return res.status(500).json({ error: 'Failed to retrieve organizations' });
  }
});

/**
 * @route POST /api/organizations
 * @desc Add a new organization to track
 */
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Organization name is required' });
  }

  const cleanName = name.trim();

  try {
    // 1. Fetch user's github account to decrypt PAT
    const userGithub = await prisma.githubAccount.findUnique({
      where: { userId: req.userId! },
    });

    if (!userGithub) {
      return res.status(400).json({ error: 'Please link your GitHub Personal Access Token first' });
    }

    // 2. Check if already tracked by this user
    const existing = await prisma.organization.findFirst({
      where: {
        name: cleanName,
        userId: req.userId!,
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Organization is already tracked' });
    }

    // 3. Verify organization exists on GitHub
    const pat = decrypt(userGithub.encryptedPat, userGithub.iv, userGithub.tag);
    
    try {
      await fetchOrgRepos(pat, cleanName);
    } catch (err: any) {
      console.warn(`Error verifying org existence on GitHub:`, err.message);
      if (err.status === 404) {
        return res.status(404).json({ error: `GitHub Organization or User "${cleanName}" not found` });
      }
      return res.status(400).json({ error: `Failed to verify organization with GitHub: ${err.message}` });
    }

    // 4. Create in DB
    const org = await prisma.organization.create({
      data: {
        name: cleanName,
        userId: req.userId!,
      },
    });

    // 5. Trigger background scan immediately
    await addOrgScanJob(org.id);

    return res.status(201).json({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      reposCount: 0,
      bountyCount: 0,
    });
  } catch (err: any) {
    console.error('Error adding organization:', err);
    return res.status(500).json({ error: 'Failed to add organization' });
  }
});

/**
 * @route DELETE /api/organizations/:id
 * @desc Stop tracking an organization
 */
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const org = await prisma.organization.findFirst({
      where: {
        id,
        userId: req.userId!,
      },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Delete organization (Cascade will delete Repos, Issues, etc.)
    await prisma.organization.delete({
      where: { id },
    });

    return res.json({ message: 'Stopped tracking organization successfully' });
  } catch (err: any) {
    console.error('Error deleting organization:', err);
    return res.status(500).json({ error: 'Failed to delete organization' });
  }
});

/**
 * @route POST /api/organizations/:id/scan
 * @desc Manually trigger scanning for an organization
 */
router.post('/:id/scan', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const org = await prisma.organization.findFirst({
      where: {
        id,
        userId: req.userId!,
      },
    });

    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Trigger background scan job
    await addOrgScanJob(org.id);

    return res.json({ message: 'Background scan job triggered' });
  } catch (err: any) {
    console.error('Error triggering manual scan:', err);
    return res.status(500).json({ error: 'Failed to trigger scan' });
  }
});

export default router;
