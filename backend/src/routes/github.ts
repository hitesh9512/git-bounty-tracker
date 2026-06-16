import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { verifyPat } from '../services/github';
import { encrypt } from '../services/encryption';

const router = Router();

/**
 * @route POST /api/github/pat
 * @desc Verify and save GitHub Personal Access Token (PAT)
 */
router.post('/pat', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { pat } = req.body;

  if (!pat) {
    return res.status(400).json({ error: 'GitHub PAT is required' });
  }

  try {
    // 1. Verify PAT with GitHub API
    const { username, avatarUrl } = await verifyPat(pat);

    // 2. Encrypt token
    const { encryptedPat, iv, tag } = encrypt(pat);

    // 3. Upsert into database
    const githubAccount = await prisma.githubAccount.upsert({
      where: { userId: req.userId! },
      create: {
        userId: req.userId!,
        encryptedPat,
        iv,
        tag,
        username,
        avatarUrl,
      },
      update: {
        encryptedPat,
        iv,
        tag,
        username,
        avatarUrl,
      },
    });

    return res.json({
      message: 'GitHub PAT linked successfully',
      githubUsername: username,
      githubAvatarUrl: avatarUrl,
    });
  } catch (err: any) {
    console.error('Error saving GitHub PAT:', err);
    if (err.status === 401) {
      return res.status(400).json({ error: 'Invalid GitHub PAT' });
    }
    return res.status(500).json({ error: 'Failed to verify and save GitHub PAT' });
  }
});

/**
 * @route DELETE /api/github/pat
 * @desc Remove/Unlink GitHub PAT
 */
router.delete('/pat', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const existing = await prisma.githubAccount.findUnique({
      where: { userId: req.userId! },
    });

    if (!existing) {
      return res.status(404).json({ error: 'No GitHub account linked to this user' });
    }

    await prisma.githubAccount.delete({
      where: { userId: req.userId! },
    });

    return res.json({ message: 'GitHub account unlinked successfully' });
  } catch (err: any) {
    console.error('Error unlinking GitHub account:', err);
    return res.status(500).json({ error: 'Failed to unlink GitHub account' });
  }
});

export default router;
