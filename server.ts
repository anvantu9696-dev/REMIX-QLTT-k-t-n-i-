import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { v4 as uuidv4 } from 'uuid';

import authRoutes from './server/routes/auth';
import userRoutes from './server/routes/users';
import roleRoutes from './server/routes/roles';
import auditRoutes from './server/routes/auditLogs';
import dashboardRoutes from './server/routes/dashboard';
import notificationRoutes from './server/routes/notifications';
import documentRoutes from './server/routes/documents';
import guideRoutes from './server/routes/guides';
import substationRoutes from './server/routes/substations';
import feederRoutes from './server/routes/feeders';
import deviceRoutes from './server/routes/devices';
import loopRoutes from './server/routes/loops';
import approvalRoutes from './server/routes/approvals';
import taskRoutes from './server/routes/tasks';
import checklistRoutes from './server/routes/checklists';
import scheduleRoutes from './server/routes/schedules';
import issueRoutes from './server/routes/issues';
import importRoutes from './server/routes/import';
import migrateRoutes from './server/routes/migrate';
import reportRoutes from './server/routes/reports';
import proposalRoutes from './server/routes/proposals';
import systemRoutes from './server/routes/system';
import passwordRoutes from './server/routes/password';
import adminDataRecoveryRoutes from './server/routes/adminDataRecovery';
import healthRoutes from './server/routes/health';
import { registerEventsEndpoint } from './server/events';

async function startServer() {
  const app = express();
  const PORT = 3000;

  
  

  // Middleware
  app.use(express.json({ limit: '50mb' }));


  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Request ID Middleware
  app.use((req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
    next();
  });

  // API Routes Cache Headers
  app.use('/api', (req, res, next) => {
    const method = req.method.toUpperCase();
    const url = req.originalUrl || req.url;

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isAuth = url.startsWith('/api/auth');

    const staticRoutes = ['/api/substations', '/api/feeders', '/api/roles', '/api/guides'];
    const isStaticGet = method === 'GET' && staticRoutes.some(r => url === r || url.startsWith(`${r}/`) || url.startsWith(`${r}?`));

    if (isStaticGet && !isMutation && !isAuth) {
      res.setHeader('Cache-Control', 'private, max-age=120, stale-while-revalidate=600');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });
  app.use('/api/health', healthRoutes);
  app.use('/api/password', passwordRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/roles', roleRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/guides', guideRoutes);
  app.use('/api/substations', substationRoutes);
  app.use('/api/feeders', feederRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/loops', loopRoutes);
  app.use('/api/loop-connections', loopRoutes);
  app.use('/api/approvals', approvalRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/checklists', checklistRoutes);
  app.use('/api/schedules', scheduleRoutes);
  app.use('/api/issues', issueRoutes);
  app.use('/api/import', importRoutes);
app.use('/api', migrateRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/proposals', proposalRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/admin/data-recovery', adminDataRecoveryRoutes);

  // Register Server-Sent Events (SSE) real-time sync endpoint
  registerEventsEndpoint(app);

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const requestId = req.headers['x-request-id'] || 'no-id';
    console.error(`[${requestId}] Error:`, err);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      requestId: requestId
    });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Quản Lý Thiết Bị Lưới Điện running on http://0.0.0.0:${PORT}`);
  });
  
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use, skipping listen.`);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
