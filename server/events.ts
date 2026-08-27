import express from 'express';
import { authenticateToken, AuthenticatedRequest } from './middleware';
import { pushRealtimeEvent } from './firestore';

let sseClients: Array<{ id: number; res: express.Response }> = [];
let clientIdCounter = 0;

export function registerEventsEndpoint(app: express.Application) {
  app.get('/api/events', authenticateToken, (req: AuthenticatedRequest, res: express.Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = ++clientIdCounter;
    const newClient = { id: clientId, res };
    sseClients.push(newClient);

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

    // Keep alive ping every 25s
    const pingInterval = setInterval(() => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'PING', timestamp: Date.now() })}\n\n`);
      } catch (e) {
        console.warn(`[SSE] Ping failed for client ${clientId}, closing.`);
        clearInterval(pingInterval);
        res.end();
        sseClients = sseClients.filter(c => c.id !== clientId);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients = sseClients.filter(client => client.id !== clientId);
    });
  });
}

export function broadcastRealtimeEvent(event: { type: string; entity: string; action?: string; id?: number | string; data?: any }) {
  // 1. SSE Broadcast
  const payload = `data: ${JSON.stringify({ ...event, timestamp: Date.now() })}\n\n`;
  const healthyClients: Array<{ id: number; res: express.Response }> = [];
  
  sseClients.forEach(client => {
    try {
      client.res.write(payload);
      healthyClients.push(client);
    } catch (e) {
      console.warn(`[SSE] Broadcast failed for client ${client.id}, removing.`);
      try { client.res.end(); } catch (err) {}
    }
  });
  
  sseClients = healthyClients;

  // 2. Firestore Sync - OPTIONAL/DEPRECATED
  // pushRealtimeEvent(event).catch(err => console.error('[Realtime] Firestore sync failed:', err));
}
