import mongoose from 'mongoose';
import { env } from './env.ts';
import { logger } from '../utils/logger.ts';

export const connectDB = async () => {
  try {
    const uri = env.mongoUri;
    logger.info(`Connecting to MongoDB...`);
    const conn = await mongoose.connect(uri);
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB Connection Error: ${(error as Error).message}`);
    process.exit(1);
  }
};
