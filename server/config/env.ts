import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/whiteboard',
  jwtSecret: process.env.JWT_SECRET || 'supersecretkey',
  nodeEnv: process.env.NODE_ENV || 'development',
};
