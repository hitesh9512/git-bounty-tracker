import { Router } from 'express';
import authRoutes from './auth';
import githubRoutes from './github';
import orgRoutes from './organizations';
import issueRoutes from './issues';
import notificationRoutes from './notifications';

const router = Router();

router.use('/auth', authRoutes);
router.use('/github', githubRoutes);
router.use('/organizations', orgRoutes);
router.use('/issues', issueRoutes);
router.use('/notifications', notificationRoutes);

export default router;
