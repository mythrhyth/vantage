import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes';
import { errorHandlerMiddleware } from './middleware/error.middleware';

dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());

// Register API Routes
app.use('/api', apiRouter);

// Register Global Error Handling Middleware
app.use(errorHandlerMiddleware);
