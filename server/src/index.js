import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure server/.env is loaded even if CWD is repository root or another folder
if (!process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
}
if (!process.env.MONGO_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

import connectDB from './config/db.js';

// Route imports
import customerRoutes from './routes/customerRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import clockRoutes from './routes/clockRoutes.js';
import outboxRoutes from './routes/outboxRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Core Health Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TiffinTrack API is running'
  });
});

// API Routes
app.use('/api/customers', customerRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/clock', clockRoutes);

// T1 Outbox endpoints (support both /outbox and /api/outbox for test harness compatibility)
app.use('/outbox', outboxRoutes);
app.use('/api/outbox', outboxRoutes);

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export const startServer = async () => {
  try {
    // 1. Connect to MongoDB Atlas first
    await connectDB();

    // 2. Start Express server ONLY after successful DB connection
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    return server;
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

// Start the server ONLY when executed directly, NOT when imported in tests
const isMainModule = process.argv[1] && (
  path.resolve(process.argv[1]) === __filename ||
  process.argv[1].endsWith('index.js')
);

if (isMainModule && process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
