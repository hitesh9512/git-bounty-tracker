import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { Prisma } from '@prisma/client';
import { decrypt } from '../services/encryption';
import { getGlobalTopBountyTargets } from '../services/github';

const router = Router();

/**
 * @route GET /api/issues
 * @desc Get all tracked issues with sorting, filtering, and pagination
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;
    
    // Parse query params
    const orgId = req.query.orgId as string | undefined;
    const hasBounty = req.query.hasBounty === 'false' ? undefined : true; // default: only show bounties
    const state = (req.query.state as string) || 'open'; // default: open
    const search = req.query.search as string | undefined;
    const minBounty = req.query.minBounty ? parseFloat(req.query.minBounty as string) : undefined;
    const maxBounty = req.query.maxBounty ? parseFloat(req.query.maxBounty as string) : undefined;
    
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '10', 10);
    const skip = (page - 1) * limit;

    const sortBy = (req.query.sortBy as string) || 'bountyAmount';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Build Prisma where clause
    const where: Prisma.IssueWhereInput = {
      repository: {
        organization: {
          userId,
        },
      },
    };

    if (orgId) {
      where.repository = {
        organizationId: orgId,
        organization: { userId }, // make sure user owns the org
      };
    }

    if (hasBounty !== undefined) {
      where.hasBounty = hasBounty;
    }

    if (state !== 'all') {
      where.state = state;
    }

    if (minBounty !== undefined || maxBounty !== undefined) {
      where.bountyAmount = {};
      if (minBounty !== undefined) {
        where.bountyAmount.gte = minBounty;
      }
      if (maxBounty !== undefined) {
        where.bountyAmount.lte = maxBounty;
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === 'repository') {
      orderBy.repository = { fullName: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // Query database
    const [issues, totalCount] = await Promise.all([
      prisma.issue.findMany({
        where,
        include: {
          repository: {
            select: {
              fullName: true,
              name: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.issue.count({ where }),
    ]);

    // Format BigInt to string for JSON serialization
    const serializedIssues = issues.map((issue) => ({
      ...issue,
      githubId: issue.githubId.toString(),
    }));

    return res.json({
      issues: serializedIssues,
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (err: any) {
    console.error('Error fetching issues:', err);
    return res.status(500).json({ error: 'Failed to retrieve issues' });
  }
});

/**
 * @route GET /api/issues/stats
 * @desc Get aggregated stats for the dashboard (counters & trends)
 */
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // 1. Counters
    const orgsCount = await prisma.organization.count({ where: { userId } });
    
    const reposCount = await prisma.repository.count({
      where: { organization: { userId } },
    });

    const activeBountiesCount = await prisma.issue.count({
      where: {
        repository: { organization: { userId } },
        hasBounty: true,
        state: 'open',
      },
    });

    const totalBountySum = await prisma.issue.aggregate({
      where: {
        repository: { organization: { userId } },
        hasBounty: true,
        state: 'open',
      },
      _sum: {
        bountyAmount: true,
      },
    });

    // 2. Fetch global top bounty targets via GitHub API (if PAT is available)
    let topRepositories: any[] = [];
    let topOrganizations: any[] = [];

    const githubAccount = await prisma.githubAccount.findUnique({
      where: { userId },
    });

    if (githubAccount) {
      try {
        const pat = decrypt(githubAccount.encryptedPat, githubAccount.iv, githubAccount.tag);
        const globalTargets = await getGlobalTopBountyTargets(pat);
        topRepositories = globalTargets.topRepositories;
        topOrganizations = globalTargets.topOrganizations;
      } catch (err: any) {
        console.error('Error fetching global bounty targets:', err.message);
      }
    }

    // 3. Recent Bounties (limit 5)
    const recentBounties = await prisma.issue.findMany({
      where: {
        repository: { organization: { userId } },
        hasBounty: true,
        state: 'open',
      },
      include: {
        repository: {
          select: { fullName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const serializedRecent = recentBounties.map((issue) => ({
      ...issue,
      githubId: issue.githubId.toString(),
    }));

    return res.json({
      stats: {
        organizations: orgsCount,
        repositories: reposCount,
        activeBounties: activeBountiesCount,
        totalBountyValue: totalBountySum._sum.bountyAmount || 0,
      },
      topRepositories,
      topOrganizations,
      recentBounties: serializedRecent,
    });
  } catch (err: any) {
    console.error('Error fetching dashboard stats:', err);
    return res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
  }
});

/**
 * @route GET /api/issues/:id/history
 * @desc Get bounty revision history for a specific issue
 */
router.get('/:id/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const issue = await prisma.issue.findFirst({
      where: {
        id,
        repository: {
          organization: { userId: req.userId! },
        },
      },
    });

    if (!issue) {
      return res.status(404).json({ error: 'Issue not found' });
    }

    const history = await prisma.issueHistory.findMany({
      where: { issueId: id },
      orderBy: { changedAt: 'desc' },
    });

    return res.json(history);
  } catch (err: any) {
    console.error('Error fetching issue history:', err);
    return res.status(500).json({ error: 'Failed to retrieve issue history' });
  }
});

export default router;
