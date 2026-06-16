import { Router, Response } from 'express';
import { prisma } from '../config/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/notifications
 * @desc Get all notifications for the authenticated user
 */
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
      take: 50, // limit to latest 50 notifications
    });

    return res.json(notifications);
  } catch (err: any) {
    console.error('Error fetching notifications:', err);
    return res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
});

/**
 * @route POST /api/notifications/mark-all-read
 * @desc Mark all notifications as read
 */
router.post('/mark-all-read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.userId!,
        isRead: false,
      },
      data: { isRead: true },
    });

    return res.json({ message: 'All notifications marked as read' });
  } catch (err: any) {
    console.error('Error marking all notifications as read:', err);
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
});

/**
 * @route POST /api/notifications/:id/read
 * @desc Mark a specific notification as read
 */
router.post('/:id/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const notif = await prisma.notification.findFirst({
      where: {
        id,
        userId: req.userId!,
      },
    });

    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json({ message: 'Notification marked as read' });
  } catch (err: any) {
    console.error('Error marking notification as read:', err);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
});

export default router;
