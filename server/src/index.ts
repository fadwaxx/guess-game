import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerSocketHandlers } from './socketHandlers';

const PORT = Number(process.env.PORT) || 4001;
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([
  ...configuredOrigins,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
]));

const originOption = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
  // يسمح بطلبات نفس الخادم وطلبات أدوات الاختبار، إضافة إلى الروابط المحددة في البيئة.
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error('هذا الرابط غير مسموح له بالاتصال بالخادم'));
};

const app = express();
app.use(cors({ origin: originOption }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'guess-game-server' });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: originOption, methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

// تشغيل الواجهة والخادم من خدمة استضافة واحدة بعد تنفيذ npm run build من جذر المشروع.
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io') || req.path === '/health') return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (error) => {
    if (error) next();
  });
});

httpServer.listen(PORT, () => {
  console.log(`✅ الموقع والخادم يعملان على المنفذ ${PORT}`);
});
