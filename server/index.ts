import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import os from 'node:os';
import path from 'node:path';
import { RoomManager } from './RoomManager';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// In produzione serve la build Vite (host + controller) dalla stessa origine.
app.use(express.static(path.resolve(process.cwd(), 'dist')));

// Endpoint per scoprire gli IP LAN (usato dall'host in dev per costruire il QR).
app.get('/api/network', (_req, res) => {
  const ips: string[] = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  res.json({ ips });
});

// Rete di sicurezza: un'eccezione in un handler/timer non deve abbattere tutte le stanze.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});

const rooms = new RoomManager(io);
io.on('connection', (socket) => rooms.handleConnection(socket));

const PORT = Number(process.env.PORT) || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server Ricchioni Party su http://localhost:${PORT}`);
});
