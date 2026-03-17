import http from 'http';
import { Server } from 'socket.io';
import app from './app.ts';
import { connectDB } from './config/db.ts';
import { env } from './config/env.ts';
import { logger } from './utils/logger.ts';
import { setupSocket } from './socket/socketHandler.ts';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import express from 'express';

import { notFound, errorHandler } from './middleware/errorMiddleware.ts';

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  setupSocket(io);

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  server.listen(env.port, () => {
    logger.info(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
  });
};

startServer();
