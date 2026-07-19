import { RoomState, RoundState, PublicRoomState, PublicRoundState } from './types';
import { getItemById, getRandomItem, getAllAcceptedNames } from './data/categories';
import { isGuessCorrect } from './normalize';

const GUESS_COOLDOWN_MS = 5000;

export function startNewRound(room: RoomState, previousRoundStarterId?: string): RoundState {
  const [p1, p2] = room.players;
  if (!p1 || !p2) throw new Error('لا يمكن بدء الجولة بأقل من لاعبين');

  const item1 = getRandomItem(room.settings.categoryId);
  const item2 = getRandomItem(room.settings.categoryId, [item1.id]);

  let starterId: string;
  if (previousRoundStarterId) {
    starterId = previousRoundStarterId === p1.id ? p2.id : p1.id;
  } else {
    starterId = Math.random() < 0.5 ? p1.id : p2.id;
  }

  const roundNumber = room.totalRoundsPlayed + 1;
  const round: RoundState = {
    roundNumber,
    assignments: { [p1.id]: item1.id, [p2.id]: item2.id },
    currentTurnPlayerId: starterId,
    turnEndsAt: Date.now() + room.settings.turnDurationMs,
    lastGuessAtByPlayer: {},
    winnerPlayerId: null,
    revealed: false,
    blueActivePlayerId: null,
    blueExtraTurnsRemaining: 0,
  };

  room.round = round;
  room.status = 'playing';
  return round;
}

/** ينهي المحاولة الحالية. إذا كانت البطاقة الزرقاء فعالة يبقى الدور لنفس اللاعب حتى يكتمل مجموع 3 أدوار. */
export function switchTurn(room: RoomState): void {
  if (!room.round) return;
  const round = room.round;
  const currentId = round.currentTurnPlayerId;

  if (round.blueActivePlayerId === currentId && round.blueExtraTurnsRemaining > 0) {
    round.blueExtraTurnsRemaining -= 1;
    round.turnEndsAt = Date.now() + room.settings.turnDurationMs;
    if (round.blueExtraTurnsRemaining === 0) {
      // يبقى هذا هو الدور الثالث، وبعد إنهائه ستتم العودة للتناوب الطبيعي.
    }
    return;
  }

  if (round.blueActivePlayerId === currentId) {
    round.blueActivePlayerId = null;
    round.blueExtraTurnsRemaining = 0;
  }

  const otherPlayer = room.players.find((p) => p.id !== currentId);
  if (!otherPlayer) return;
  round.currentTurnPlayerId = otherPlayer.id;
  round.turnEndsAt = Date.now() + room.settings.turnDurationMs;
}

export type GuessResult =
  | { status: 'correct' }
  | { status: 'incorrect' }
  | { status: 'cooldown'; remainingMs: number }
  | { status: 'notYourTurn' }
  | { status: 'invalid'; reason: string };

export function processGuess(room: RoomState, playerId: string, guessText: string): GuessResult {
  const round = room.round;
  if (!round || room.status !== 'playing') return { status: 'invalid', reason: 'لا توجد جولة نشطة' };
  if (round.currentTurnPlayerId !== playerId) return { status: 'notYourTurn' };

  const lastGuessAt = round.lastGuessAtByPlayer[playerId] ?? 0;
  const elapsed = Date.now() - lastGuessAt;
  if (elapsed < GUESS_COOLDOWN_MS) return { status: 'cooldown', remainingMs: GUESS_COOLDOWN_MS - elapsed };
  round.lastGuessAtByPlayer[playerId] = Date.now();

  const myItemId = round.assignments[playerId];
  const myItem = getItemById(room.settings.categoryId, myItemId);
  if (!myItem) return { status: 'invalid', reason: 'تعذر تحديد العنصر' };

  const correct = isGuessCorrect(guessText, getAllAcceptedNames(myItem));
  if (correct) {
    round.winnerPlayerId = playerId;
    round.revealed = true;
    room.status = 'roundEnd';
    room.scores[playerId] = (room.scores[playerId] ?? 0) + 1;
    room.totalRoundsPlayed += 1;
    const player = room.players.find((p) => p.id === playerId);
    if (player) player.score = room.scores[playerId];
    return { status: 'correct' };
  }
  return { status: 'incorrect' };
}

export function winsNeeded(roundsMode: number): number { return Math.ceil(roundsMode / 2); }
export function checkMatchWinner(_room: RoomState): string | null { return null; }

export function buildPublicRoomState(room: RoomState, forPlayerId: string): PublicRoomState {
  let publicRound: PublicRoundState | null = null;

  if (room.round) {
    const round = room.round;
    const opponent = room.players.find((p) => p.id !== forPlayerId);
    const opponentItemId = opponent ? round.assignments[opponent.id] : undefined;
    const opponentItem = opponentItemId ? getItemById(room.settings.categoryId, opponentItemId) ?? null : null;
    const blueTurnsLeftIncludingCurrent = round.blueActivePlayerId === round.currentTurnPlayerId
      ? round.blueExtraTurnsRemaining + 1
      : 0;

    publicRound = {
      roundNumber: round.roundNumber,
      currentTurnPlayerId: round.currentTurnPlayerId,
      turnEndsAt: round.turnEndsAt,
      winnerPlayerId: round.winnerPlayerId,
      revealed: round.revealed,
      opponentItemForMe: opponentItem,
      blueActivePlayerId: round.blueActivePlayerId,
      blueTurnsLeftIncludingCurrent,
    };

    if (round.revealed) {
      const revealedItems: { [playerId: string]: any } = {};
      for (const p of room.players) {
        const item = getItemById(room.settings.categoryId, round.assignments[p.id]);
        if (item) revealedItems[p.id] = item;
      }
      publicRound.revealedItems = revealedItems;
    }
  }

  return {
    code: room.code,
    status: room.status,
    players: room.players,
    settings: room.settings,
    scores: room.scores,
    round: publicRound,
    cardState: room.cardState,
    totalRoundsPlayed: room.totalRoundsPlayed,
  };
}
