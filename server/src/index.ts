import 'dotenv/config';

import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { Server } from 'socket.io';

import { registerSocketHandlers } from './socketHandlers';

const app = express();
const httpServer = http.createServer(app);

const PORT = Number(process.env.PORT) || 4001;

/*
بعد البناء يكون ملف السيرفر هنا:
server/dist/index.js

ومجلد الواجهة هنا:
client/dist

لذلك نرجع مستويين من server/dist للوصول إلى جذر المشروع.
*/
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');
const assetsPath = path.join(clientDistPath, 'assets');

/* الروابط المسموح لها بالاتصال بـ Socket.IO */
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const renderExternalUrl = process.env.RENDER_EXTERNAL_URL?.trim();

const allowedOrigins = Array.from(
  new Set(
    [
      ...configuredOrigins,
      renderExternalUrl,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:4001',
    ].filter((value): value is string => Boolean(value)),
  ),
);

const originOption = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => {
  /*
  الطلبات التي لا تحتوي Origin تشمل:
  - طلبات نفس الخادم
  - أدوات الفحص
  - بعض طلبات Render
  */
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }

  console.warn(`⛔ Origin غير مسموح: ${origin}`);
  callback(new Error('هذا الرابط غير مسموح له بالاتصال بالخادم'));
};

/* الإعدادات العامة */
app.disable('x-powered-by');

app.use(
  cors({
    origin: originOption,
    methods: ['GET', 'POST'],
    credentials: true,
  }),
);

app.use(express.json());

/* فحص حالة الخادم */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'guess-game-server',
  });
});

/* إعداد Socket.IO */
const io = new Server(httpServer, {
  cors: {
    origin: originOption,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`🟢 اتصال لاعب: ${socket.id}`);

  registerSocketHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`🔴 انقطع اتصال اللاعب: ${socket.id}`);
  });
});

/*
خدمة ملفات الواجهة.

وضعنا مجلد assets بشكل صريح حتى لا يتم إرجاع index.html
عند فقد ملف CSS أو JavaScript؛ لأن ذلك يسبب خطأ MIME type.
*/
app.use(
  '/assets',
  express.static(assetsPath, {
    fallthrough: false,
    immutable: true,
    maxAge: '1y',
  }),
);

app.use(
  express.static(clientDistPath, {
    index: false,
  }),
);

/*
أي رابط خاص بتطبيق React يعيد index.html.

أما طلبات الملفات مثل CSS وJS والصور فلا يجب تحويلها إلى index.html
إذا كان الملف غير موجود.
*/
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (
    req.path === '/health' ||
    req.path.startsWith('/socket.io') ||
    req.path.startsWith('/assets/')
  ) {
    next();
    return;
  }

  const acceptsHtml = req.accepts('html');

  if (!acceptsHtml) {
    res.status(404).json({
      ok: false,
      message: 'الملف أو المسار غير موجود',
    });
    return;
  }

  if (!fs.existsSync(clientIndexPath)) {
    console.error(`❌ لم يتم العثور على index.html في: ${clientIndexPath}`);

    res.status(500).json({
      ok: false,
      message: 'لم يتم العثور على ملفات الواجهة بعد البناء',
    });
    return;
  }

  res.sendFile(clientIndexPath);
});

/* معالجة أخطاء الملفات والمسارات */
app.use(
  (
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error(`❌ خطأ في المسار ${req.method} ${req.path}:`, error.message);

    if (req.path.startsWith('/assets/')) {
      res.status(404).type('text/plain').send('Asset not found');
      return;
    }

    res.status(500).json({
      ok: false,
      message: 'حدث خطأ في الخادم',
    });
  },
);

/* تشغيل الخادم */
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ الموقع والخادم يعملان على المنفذ ${PORT}`);
  console.log(`📁 مسار ملفات الواجهة: ${clientDistPath}`);
  console.log(
    `📄 index.html موجود: ${fs.existsSync(clientIndexPath) ? 'نعم' : 'لا'}`,
  );
  console.log(
    `🎨 مجلد assets موجود: ${fs.existsSync(assetsPath) ? 'نعم' : 'لا'}`,
  );
  console.log(`🌐 الروابط المسموحة: ${allowedOrigins.join(', ')}`);
});