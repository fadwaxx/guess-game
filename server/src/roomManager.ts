import { RoomState, PlayerInfo, RoomSettings } from './types';

// تخزين الغرف مؤقتًا في ذاكرة السيرفر.
// لاحقًا يمكن استبداله بقاعدة بيانات مع المحافظة على نفس الدوال.
const rooms = new Map<string, RoomState>();

// استبعاد الأحرف والأرقام التي قد يلتبس شكلها:
// O و0 وI و1
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const ROOM_CODE_LENGTH = 5;
const MAX_CODE_GENERATION_ATTEMPTS = 100;

// مدة صلاحية الغرفة: 3 ساعات
const ROOM_EXPIRY_MS = 1000 * 60 * 60 * 3;

function generateRoomCode(): string {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const code = Array.from({ length: ROOM_CODE_LENGTH }, () => {
      const randomIndex = Math.floor(
        Math.random() * ROOM_CODE_CHARS.length
      );

      return ROOM_CODE_CHARS[randomIndex];
    }).join('');

    // لا نرجع الرمز إلا إذا لم تكن هناك غرفة تستخدمه.
    if (!rooms.has(code)) {
      return code;
    }
  }

  throw new Error('تعذر إنشاء رمز غرفة فريد، يرجى المحاولة مرة أخرى');
}

const DEFAULT_SETTINGS: RoomSettings = {
  categoryId: 'animals',
  turnDurationMs: 2 * 60 * 1000,
  roundsMode: 1,
};

export function createRoom(
  hostSocketId: string,
  hostName: string
): RoomState {
  const cleanHostName = hostName.trim();

  if (!cleanHostName) {
    throw new Error('يرجى إدخال اسم اللاعب');
  }

  const code = generateRoomCode();

  const host: PlayerInfo = {
    id: hostSocketId,
    name: cleanHostName,
    isHost: true,
    isReady: false,
    connected: true,
    score: 0,
  };

  const room: RoomState = {
    code,
    status: 'lobby',
    players: [host],
    settings: { ...DEFAULT_SETTINGS },
    round: null,
    scores: {
      [hostSocketId]: 0,
    },
    createdAt: Date.now(),
    hostId: hostSocketId,
    cardState: { [hostSocketId]: { redAvailable: true, blueAvailable: true } },
    totalRoundsPlayed: 0,
  };

  rooms.set(code, room);

  return room;
}

export function getRoom(code: string): RoomState | undefined {
  return rooms.get(code.trim().toUpperCase());
}

export function deleteRoom(code: string): void {
  rooms.delete(code.trim().toUpperCase());
}

export function joinRoom(
  code: string,
  socketId: string,
  name: string
): { room?: RoomState; error?: string } {
  const normalizedCode = code.trim().toUpperCase();
  const cleanName = name.trim();

  if (!normalizedCode) {
    return { error: 'يرجى إدخال رمز الغرفة' };
  }

  if (!cleanName) {
    return { error: 'يرجى إدخال اسم اللاعب' };
  }

  const room = getRoom(normalizedCode);

  if (!room) {
    return { error: 'الغرفة غير موجودة أو انتهت صلاحيتها' };
  }

  if (Date.now() - room.createdAt > ROOM_EXPIRY_MS) {
    deleteRoom(normalizedCode);
    return { error: 'انتهت صلاحية هذه الغرفة' };
  }

  const existingPlayer = room.players.find(
    (player) => player.id === socketId
  );

  if (existingPlayer) {
    existingPlayer.connected = true;
    return { room };
  }

  const activePlayers = room.players.filter(
    (player) => player.connected
  );

  if (activePlayers.length >= 2) {
    return { error: 'الغرفة ممتلئة بالفعل' };
  }

  const newPlayer: PlayerInfo = {
    id: socketId,
    name: cleanName,
    isHost: false,
    isReady: false,
    connected: true,
    score: 0,
  };

  room.players.push(newPlayer);
  room.scores[socketId] = 0;
  room.cardState[socketId] = { redAvailable: true, blueAvailable: true };

  return { room };
}

export function findRoomBySocketId(
  socketId: string
): RoomState | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((player) => player.id === socketId)) {
      return room;
    }
  }

  return undefined;
}

export function removePlayerFromRoom(
  code: string,
  socketId: string
): void {
  const room = getRoom(code);

  if (!room) return;

  room.players = room.players.filter(
    (player) => player.id !== socketId
  );

  delete room.scores[socketId];
  delete room.cardState[socketId];

  if (room.players.length === 0) {
    deleteRoom(code);
    return;
  }

  // إذا خرج صاحب الغرفة، ينقل الاستضافة إلى اللاعب المتبقي.
  if (room.hostId === socketId) {
    const newHost = room.players[0];

    newHost.isHost = true;
    room.hostId = newHost.id;
  }
}

export function markPlayerConnection(
  code: string,
  socketId: string,
  connected: boolean
): void {
  const room = getRoom(code);

  if (!room) return;

  const player = room.players.find(
    (currentPlayer) => currentPlayer.id === socketId
  );

  if (player) {
    player.connected = connected;
  }
}