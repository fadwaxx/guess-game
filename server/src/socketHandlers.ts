import { Server, Socket } from 'socket.io';
import {
  createRoom,
  getRoom,
  joinRoom,
  findRoomBySocketId,
  removePlayerFromRoom,
  markPlayerConnection,
} from './roomManager';
import {
  startNewRound,
  switchTurn,
  processGuess,
  checkMatchWinner,
  buildPublicRoomState,
} from './gameLogic';
import { ALL_CATEGORIES, getCategoryById, getRandomItem } from './data/categories';
import { RoomState, RoundsMode } from './types';

// مؤقتات انتهاء الدور لكل غرفة (خادم-محوري، لا يعتمد على العميل)
const turnTimeouts = new Map<string, NodeJS.Timeout>();
// مؤقتات مهلة إعادة الاتصال بعد الانقطاع
const disconnectGraceTimeouts = new Map<string, NodeJS.Timeout>();

const RECONNECT_GRACE_MS = 5 * 60 * 1000; // 5 دقائق

function clearTurnTimer(roomCode: string) {
  const existing = turnTimeouts.get(roomCode);
  if (existing) {
    clearTimeout(existing);
    turnTimeouts.delete(roomCode);
  }
}

function broadcastRoomState(io: Server, room: RoomState) {
  for (const player of room.players) {
    if (!player.connected) continue;
    const publicState = buildPublicRoomState(room, player.id);
    io.to(player.id).emit('room:state', publicState);
  }
}

function scheduleTurnTimeout(io: Server, room: RoomState) {
  clearTurnTimer(room.code);
  if (!room.round || room.status !== 'playing') return;

  const delay = Math.max(0, room.round.turnEndsAt - Date.now());
  const timeout = setTimeout(() => {
    // إعادة التحقق من الحالة قبل التنفيذ (قد تكون الجولة انتهت أثناء الانتظار)
    const currentRoom = getRoom(room.code);
    if (!currentRoom || !currentRoom.round || currentRoom.status !== 'playing') return;
    if (Date.now() < currentRoom.round.turnEndsAt) return; // تم تجديد المؤقت

    const timedOutPlayerId = currentRoom.round.currentTurnPlayerId;
    switchTurn(currentRoom);
    io.to(currentRoom.code).emit('turn:timeout', { previousPlayerId: timedOutPlayerId });
    broadcastRoomState(io, currentRoom);
    scheduleTurnTimeout(io, currentRoom);
  }, delay);

  turnTimeouts.set(room.code, timeout);
}

export function registerSocketHandlers(io: Server, socket: Socket) {
  // -------------------- الفئات المتاحة --------------------
  socket.on('categories:list', (callback: (categories: typeof ALL_CATEGORIES) => void) => {
    // نرسل الفئات بدون العناصر لتخفيف الحمولة (الواجهة تحتاج الاسم والأيقونة فقط عند الاختيار)
    const lightCategories = ALL_CATEGORIES.map((c) => ({ ...c, items: [] }));
    callback(lightCategories as any);
  });

  // -------------------- إنشاء غرفة --------------------
socket.on(
  'room:create',
  (
    payload: { playerName?: string },
    callback: (res: any) => void
  ) => {
    try {
      const name = String(payload?.playerName ?? '')
        .trim()
        .slice(0, 20);

      if (!name) {
        callback({
          ok: false,
          error: 'يرجى إدخال اسم اللاعب',
        });
        return;
      }

      // السيرفر ينشئ رمزًا فريدًا تلقائيًا من 5 خانات
      const room = createRoom(socket.id, name);

      // إدخال منشئ الغرفة إلى قناة Socket.IO الخاصة بها
      socket.join(room.code);

      callback({
        ok: true,
        code: room.code,
        room: buildPublicRoomState(room, socket.id),
      });

      console.log(`✅ تم إنشاء الغرفة ${room.code} بواسطة ${name}`);
    } catch (error) {
      console.error('❌ خطأ أثناء إنشاء الغرفة:', error);

      callback({
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'تعذر إنشاء الغرفة، يرجى المحاولة مرة أخرى',
      });
    }
  }
);

// -------------------- الانضمام لغرفة --------------------
socket.on(
  'room:join',
  (
    payload: { code?: string; playerName?: string },
    callback: (res: any) => void
  ) => {
    try {
      const name = String(payload?.playerName ?? '')
        .trim()
        .slice(0, 20);

      const code = String(payload?.code ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

      if (!name) {
        callback({
          ok: false,
          error: 'يرجى إدخال اسم اللاعب',
        });
        return;
      }

      if (!code) {
        callback({
          ok: false,
          error: 'يرجى إدخال رمز الغرفة',
        });
        return;
      }

      if (code.length !== 5) {
        callback({
          ok: false,
          error: 'رمز الغرفة يجب أن يتكون من 5 خانات',
        });
        return;
      }

      const { room, error } = joinRoom(
        code,
        socket.id,
        name
      );

      if (error || !room) {
        callback({
          ok: false,
          error: error || 'تعذر الانضمام إلى الغرفة',
        });
        return;
      }

      socket.join(room.code);

      callback({
        ok: true,
        code: room.code,
        room: buildPublicRoomState(room, socket.id),
      });

      broadcastRoomState(io, room);

      socket.to(room.code).emit('player:joined', {
        playerId: socket.id,
        name,
      });

      console.log(`👤 انضم ${name} إلى الغرفة ${room.code}`);
    } catch (error) {
      console.error('❌ خطأ أثناء الانضمام للغرفة:', error);

      callback({
        ok: false,
        error: 'حدث خطأ أثناء الانضمام إلى الغرفة',
      });
    }
  }
);
  // -------------------- تحديث الإعدادات (المضيف فقط) --------------------
  socket.on(
    'room:updateSettings',
    (payload: { code: string; categoryId?: string; turnDurationMs?: number; roundsMode?: RoundsMode }, callback: (res: any) => void) => {
      const room = getRoom(payload.code);
      if (!room) return callback({ ok: false, error: 'الغرفة غير موجودة' });
      if (room.hostId !== socket.id) return callback({ ok: false, error: 'فقط منشئ الغرفة يستطيع تغيير الإعدادات' });
      if (room.status !== 'lobby' && room.status !== 'settings') {
        return callback({ ok: false, error: 'لا يمكن تغيير الإعدادات بعد بدء المباراة' });
      }

      if (payload.categoryId && getCategoryById(payload.categoryId)) {
        room.settings.categoryId = payload.categoryId;
      }
      if (payload.turnDurationMs && payload.turnDurationMs >= 15000) {
        room.settings.turnDurationMs = payload.turnDurationMs;
      }
      if (payload.roundsMode === 1 || payload.roundsMode === 3 || payload.roundsMode === 5) {
        room.settings.roundsMode = payload.roundsMode;
      }
      // أي تغيير في الإعدادات يلغي جاهزية اللاعب الآخر لضمان موافقته على الفئة الجديدة
      room.players.forEach((p) => (p.isReady = false));

      callback({ ok: true });
      broadcastRoomState(io, room);
    }
  );

  // -------------------- جاهزية اللاعب --------------------
  socket.on('room:setReady', (payload: { code: string; ready: boolean }, callback?: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room) return callback?.({ ok: false, error: 'الغرفة غير موجودة' });
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return callback?.({ ok: false, error: 'أنت لست داخل هذه الغرفة' });

    player.isReady = payload.ready;
    callback?.({ ok: true });

    const bothReady = room.players.length === 2 && room.players.every((p) => p.isReady);
    if (bothReady && room.status !== 'playing') {
      const round = startNewRound(room);
      broadcastRoomState(io, room);
      scheduleTurnTimeout(io, room);
      return;
    }
    broadcastRoomState(io, room);
  });

  // -------------------- تقييم إجابة اللاعب بواسطة منافسه --------------------
  socket.on('answer:judge', (payload: { code: string; correct: boolean }, callback?: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room || !room.round || room.status !== 'playing') {
      return callback?.({ ok: false, error: 'لا توجد جولة نشطة' });
    }

    const guessedPlayerId = room.round.currentTurnPlayerId;
    if (socket.id === guessedPlayerId) {
      return callback?.({ ok: false, error: 'منافسك هو من يقيّم إجابتك' });
    }
    if (!room.players.some((player) => player.id === socket.id)) {
      return callback?.({ ok: false, error: 'أنت لست داخل هذه الغرفة' });
    }

    const guessedPlayer = room.players.find((player) => player.id === guessedPlayerId);
    if (!guessedPlayer) return callback?.({ ok: false, error: 'تعذر تحديد صاحب الدور' });

    if (payload.correct) {
      clearTurnTimer(room.code);
      room.round.winnerPlayerId = guessedPlayerId;
      room.round.revealed = true;
      room.scores[guessedPlayerId] = (room.scores[guessedPlayerId] ?? 0) + 1;
      guessedPlayer.score = room.scores[guessedPlayerId];

      room.totalRoundsPlayed += 1;
      room.status = 'roundEnd';
      io.to(room.code).emit('answer:judged', { correct: true, guessedPlayerId, guessedPlayerName: guessedPlayer.name });
      io.to(room.code).emit('round:end', { winnerId: guessedPlayerId });
      broadcastRoomState(io, room);
    } else {
      switchTurn(room);
      io.to(room.code).emit('answer:judged', { correct: false, guessedPlayerId, guessedPlayerName: guessedPlayer.name, action: 'turnPassed' });
      broadcastRoomState(io, room);
      scheduleTurnTimeout(io, room);
    }

    callback?.({ ok: true });
  });

  // -------------------- البطاقة الحمراء: تغيير عنصر المنافس --------------------
  socket.on('card:changeOpponent', (payload: { code: string }, callback?: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room || !room.round || room.status !== 'playing') {
      return callback?.({ ok: false, error: 'يمكن استخدام البطاقة أثناء اللعب فقط' });
    }
    const player = room.players.find((item) => item.id === socket.id);
    const opponent = room.players.find((item) => item.id !== socket.id);
    if (!player || !opponent) return callback?.({ ok: false, error: 'اللاعب الآخر غير موجود' });

    const cards = room.cardState[socket.id];
    if (!cards?.redAvailable) return callback?.({ ok: false, error: 'استخدمت البطاقة الحمراء سابقًا في هذه الغرفة' });

    const currentOpponentItem = room.round.assignments[opponent.id];
    const myHiddenItem = room.round.assignments[player.id];
    const replacement = getRandomItem(room.settings.categoryId, [currentOpponentItem, myHiddenItem]);
    room.round.assignments[opponent.id] = replacement.id;
    cards.redAvailable = false;

    io.to(room.code).emit('card:used', { type: 'red', playerId: socket.id, playerName: player.name });
    broadcastRoomState(io, room);
    callback?.({ ok: true });
  });

  // -------------------- البطاقة الزرقاء: ثلاثة أدوار متتالية --------------------
  socket.on('card:tripleTurn', (payload: { code: string }, callback?: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room || !room.round || room.status !== 'playing') {
      return callback?.({ ok: false, error: 'يمكن استخدام البطاقة أثناء اللعب فقط' });
    }
    if (room.round.currentTurnPlayerId !== socket.id) {
      return callback?.({ ok: false, error: 'استخدم البطاقة الزرقاء أثناء دورك فقط' });
    }
    const player = room.players.find((item) => item.id === socket.id);
    if (!player) return callback?.({ ok: false, error: 'أنت لست داخل الغرفة' });
    const cards = room.cardState[socket.id];
    if (!cards?.blueAvailable) return callback?.({ ok: false, error: 'استخدمت البطاقة الزرقاء سابقًا في هذه الغرفة' });
    if (room.round.blueActivePlayerId) return callback?.({ ok: false, error: 'هناك بطاقة زرقاء فعالة بالفعل' });

    cards.blueAvailable = false;
    room.round.blueActivePlayerId = socket.id;
    room.round.blueExtraTurnsRemaining = 2;
    io.to(room.code).emit('card:used', { type: 'blue', playerId: socket.id, playerName: player.name });
    broadcastRoomState(io, room);
    callback?.({ ok: true, turns: 3 });
  });

  // -------------------- خروج اختياري من الغرفة --------------------
  socket.on('room:leave', (payload: { code: string }, callback?: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room) return callback?.({ ok: true });

    removePlayerFromRoom(room.code, socket.id);
    socket.leave(room.code);
    clearTurnTimer(room.code);

    const remainingRoom = getRoom(room.code);
    if (remainingRoom) {
      remainingRoom.status = 'lobby';
      remainingRoom.round = null;
      remainingRoom.totalRoundsPlayed = 0;
      remainingRoom.players.forEach((player) => {
        player.isReady = false;
        player.score = 0;
        remainingRoom.scores[player.id] = 0;
        remainingRoom.cardState[player.id] = { redAvailable: true, blueAvailable: true };
      });
      broadcastRoomState(io, remainingRoom);
      io.to(remainingRoom.code).emit('player:left', { playerId: socket.id });
    }
    callback?.({ ok: true });
  });

  // -------------------- إنهاء الدور يدويًا --------------------
  socket.on('turn:end', (payload: { code: string }, callback?: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room || !room.round || room.status !== 'playing') return callback?.({ ok: false });
    if (room.round.currentTurnPlayerId !== socket.id) return callback?.({ ok: false, error: 'ليس دورك' });

    switchTurn(room);
    callback?.({ ok: true });
    io.to(room.code).emit('turn:manualEnd', { previousPlayerId: socket.id });
    broadcastRoomState(io, room);
    scheduleTurnTimeout(io, room);
  });

  // -------------------- التخمين --------------------
  socket.on('guess:submit', (payload: { code: string; text: string }, callback: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room) return callback({ ok: false, error: 'الغرفة غير موجودة' });

    const result = processGuess(room, socket.id, payload.text || '');

    switch (result.status) {
      case 'correct': {
        clearTurnTimer(room.code);
        callback({ ok: true, correct: true });
        io.to(room.code).emit('guess:result', { playerId: socket.id, correct: true });
        broadcastRoomState(io, room);

        const winnerId = checkMatchWinner(room);
        if (winnerId) {
          room.status = 'matchEnd';
          io.to(room.code).emit('match:end', { winnerId });
          broadcastRoomState(io, room);
        }
        break;
      }
      case 'incorrect':
        callback({ ok: true, correct: false });
        io.to(room.code).emit('guess:result', { playerId: socket.id, correct: false });
        break;
      case 'notYourTurn':
        callback({ ok: false, error: 'ليس دورك الآن' });
        break;
      case 'cooldown':
        callback({ ok: false, error: 'انتظر قليلاً قبل التخمين مرة أخرى', remainingMs: result.remainingMs });
        break;
      default:
        callback({ ok: false, error: 'reason' in result ? result.reason : 'خطأ غير معروف' });
    }
  });

  // -------------------- التحضير لجولة جديدة مع الاحتفاظ بالنقاط والبطاقات المستهلكة --------------------
  socket.on('round:prepare', (payload: { code: string }, callback?: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room || room.status !== 'roundEnd') return callback?.({ ok: false, error: 'الجولة لم تنته بعد' });
    room.round = null;
    room.status = 'lobby';
    room.players.forEach((p) => (p.isReady = false));
    callback?.({ ok: true });
    broadcastRoomState(io, room);
  });

  // -------------------- الجولة التالية --------------------
  socket.on(
    'round:next',
    (payload: { code: string }, callback?: (res: any) => void) => {
      const room = getRoom(payload.code);
  
      if (!room) {
        return callback?.({
          ok: false,
          error: 'الغرفة غير موجودة',
        });
      }
  
      if (room.status !== 'roundEnd') {
        return callback?.({
          ok: false,
          error: 'الجولة لم تنته بعد',
        });
      }
  
      // إلغاء جاهزية اللاعبين حتى يوافق الاثنان على الجولة الجديدة
      room.players.forEach((player) => {
        player.isReady = false;
      });
  
      // إزالة بيانات الجولة السابقة
      room.round = null;
  
      // العودة لشاشة الإعدادات بدل بدء الجولة مباشرة
      room.status = 'settings';
  
      callback?.({ ok: true });
  
      broadcastRoomState(io, room);
    }
  );

  // -------------------- جولة جديدة في نفس الغرفة (لا تصفير للنقاط أو البطاقات) --------------------
  socket.on('match:rematch', (payload: { code: string }, callback?: (res: any) => void) => {
    const room = getRoom(payload.code);
    if (!room) return callback?.({ ok: false });
    room.players.forEach((p) => (p.isReady = false));
    room.round = null;
    room.status = 'lobby';
    callback?.({ ok: true });
    broadcastRoomState(io, room);
  });

  // -------------------- قطع الاتصال --------------------
  socket.on('disconnect', () => {
    const room = findRoomBySocketId(socket.id);
    if (!room) return;

    markPlayerConnection(room.code, socket.id, false);
    io.to(room.code).emit('player:disconnected', { playerId: socket.id });
    broadcastRoomState(io, room);

    // مهلة 5 دقائق لعودة اللاعب قبل حذف الغرفة نهائيًا
    const graceTimeout = setTimeout(() => {
      const stillRoom = getRoom(room.code);
      if (!stillRoom) return;
      const player = stillRoom.players.find((p) => p.id === socket.id);
      if (player && !player.connected) {
        removePlayerFromRoom(room.code, socket.id);
        io.to(room.code).emit('room:closed', { reason: 'انتهت مهلة عودة اللاعب المنقطع' });
        clearTurnTimer(room.code);
      }
      disconnectGraceTimeouts.delete(socket.id);
    }, RECONNECT_GRACE_MS);
    disconnectGraceTimeouts.set(socket.id, graceTimeout);
  });
}
