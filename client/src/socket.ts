import { io, Socket } from 'socket.io-client';

// أثناء التطوير يتصل بمنفذ الخادم المحلي، وفي النسخة المنشورة يستخدم نفس رابط الموقع.
const SERVER_URL = import.meta.env.VITE_SERVER_URL
  || (import.meta.env.DEV ? 'http://localhost:4001' : window.location.origin);

export const socket: Socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});
