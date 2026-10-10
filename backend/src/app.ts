import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandlerMiddleware } from './middleware/error.middleware';
import { prisma } from './db';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check failed: database unavailable', error);
    res.status(503).json({ status: 'unavailable', database: 'disconnected' });
  }
});

// Register API Routes
app.use('/api', apiRouter);

// Register Global Error Handling Middleware
app.use(errorHandlerMiddleware);
