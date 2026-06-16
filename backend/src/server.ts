// Add custom BigInt JSON serialization support
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { config } from './config';
import apiRouter from './routes';
import { initSocket } from './sockets/socketManager';
import { setupRepeatableScan } from './queue/scannerQueue';

// Import the worker to start listening/processing jobs in the background
import './queue/worker';

const app = express();
const httpServer = createServer(app);

// Initialize WebSocket Server
initSocket(httpServer);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start Server
const PORT = config.PORT;
httpServer.listen(PORT, async () => {
  console.log(`🚀 GitHub Bounty Tracker Server running on port ${PORT}`);
  
  // Setup the background scanning cron-like queue schedule
  try {
    await setupRepeatableScan();
  } catch (err) {
    console.error('Failed to setup repeatable scanning cron job:', err);
  }
});
