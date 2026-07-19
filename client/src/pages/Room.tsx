import { useEffect, useMemo, useState } from 'react';
import { socket } from '../socket';
import { GameCategoryLight, PublicRoomState } from '../types';
import Timer from '../components/Timer';

interface RoomProps {
  room: PublicRoomState;
  myId: string;
  onLeave: () => void;
}

const TURN_DURATION_OPTIONS = [
  { label: '60 ثانية', value: 60_000 },
  { label: 'دقيقتان', value: 120_000 },
  { label: '3 دقائق', value: 180_000 },
];

export default function Room({ room, myId, onLeave }: RoomProps) {
  const [categories, setCategories] = useState<GameCategoryLight[]>([]);
  const [feedback, setFeedback] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const actualMyId = myId || socket.id || '';
  const me = room.players.find((player) => player.id === actualMyId);
  const opponent = room.players.find((player) => player.id !== actualMyId);
  const isHost = me?.isHost ?? false;
  const round = room.round;
  const isMyTurn = round?.currentTurnPlayerId === actualMyId;
  const currentTurnPlayer = room.players.find((player) => player.id === round?.currentTurnPlayerId);
  const canJudge = room.status === 'playing' && Boolean(round) && !isMyTurn && Boolean(opponent);
  const category = useMemo(
    () => categories.find((item) => item.id === room.settings.categoryId),
    [categories, room.settings.categoryId]
  );

  useEffect(() => {
    socket.emit('categories:list', (list: GameCategoryLight[]) => setCategories(list));
  }, []);

  useEffect(() => {
    const showBriefly = (text: string) => {
      setFeedback(text);
      window.setTimeout(() => setFeedback(''), 3000);
    };
    const onJudged = (payload: { correct: boolean; guessedPlayerName: string }) =>
      showBriefly(payload.correct ? `🎉 ${payload.guessedPlayerName} خمن العنصر وفاز!` : `↪ انتهت محاولة ${payload.guessedPlayerName} وانتقل الدور`);
    const onTimeout = () => showBriefly('⏳ انتهت الدقيقتان قبل طرح السؤال، وانتقل الدور للمنافس');
    const onCardUsed = (payload: { playerName: string; type: 'red' | 'blue' }) =>
      showBriefly(payload.type === 'red' ? `🟥 ${payload.playerName} غيّر عنصر المنافس` : `🟦 ${payload.playerName} فعّل 3 أدوار متتالية`);

    socket.on('answer:judged', onJudged);
    socket.on('turn:timeout', onTimeout);
    socket.on('card:used', onCardUsed);
    return () => {
      socket.off('answer:judged', onJudged);
      socket.off('turn:timeout', onTimeout);
      socket.off('card:used', onCardUsed);
    };
  }, []);

  function updateSettings(patch: Partial<{ categoryId: string; turnDurationMs: number }>) {
    socket.emit('room:updateSettings', { code: room.code, ...patch }, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) setFeedback(result.error ?? 'تعذر تحديث الإعدادات');
    });
  }

  function toggleReady() {
    socket.emit('room:setReady', { code: room.code, ready: !me?.isReady });
  }

  function judgeAnswer(correct: boolean) {
    if (!canJudge) return;
    socket.emit('answer:judge', { code: room.code, correct }, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) setFeedback(result.error ?? 'تعذر تسجيل الإجابة');
    });
  }

  function useRedCard() {
    socket.emit('card:changeOpponent', { code: room.code }, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) setFeedback(result.error ?? 'تعذر استخدام البطاقة الحمراء');
    });
  }

  function useBlueCard() {
    socket.emit('card:tripleTurn', { code: room.code }, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) setFeedback(result.error ?? 'تعذر استخدام البطاقة الزرقاء');
    });
  }

  function prepareNextRound() {
    socket.emit(
      'round:next',
      { code: room.code },
      (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setFeedback(result.error ?? 'تعذر بدء الجولة التالية');
        }
      }
    );
  }

  function leaveRoom() {
    socket.emit('room:leave', { code: room.code }, () => onLeave());
  }

  async function copyCode() {
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const lobby = room.status === 'lobby' || room.status === 'settings';
  const item = round?.opponentItemForMe;
  const myCardState = room.cardState?.[actualMyId] ?? { redAvailable: true, blueAvailable: true };
  const blueActiveForMe = round?.blueActivePlayerId === actualMyId;

  return (
    <section className="scrap-room" aria-label="غرفة اللعبة">
      <button className="paper-button leave-button" onClick={leaveRoom}>🚪 خروج من الغرفة</button>
      <button className="paper-button settings-button" onClick={() => setShowSettings((value) => !value)}>⚙ الإعدادات</button>
     
      <footer className="creator-credit">
  <span className="creator-star">✦</span>

  <span className="creator-text">Crafted by</span>

  <a
    href="https://www.tiktok.com/@fadwa.s10"
    target="_blank"
    rel="noopener noreferrer"
  >
    @fadwa.s10
  </a>

  <span className="creator-dot">•</span>

  <a
    href="https://رابط_البورتفوليو"
    target="_blank"
    rel="noopener noreferrer"
  >
    Portfolio
  </a>
</footer>

      <button className="room-code paper-panel" onClick={copyCode} title="نسخ الرمز">
        <span>كود الغرفة</span>
        <strong>{room.code}</strong>
        <b>{copied ? '✓' : '⧉'}</b>
      </button>

      <aside className="players-paper paper-panel">
        <h2>اللاعبين</h2>
        <div className="players-list">
          {room.players.map((player) => (
            <div className={`drawn-player ${round?.currentTurnPlayerId === player.id ? 'active-turn' : ''}`} key={player.id}>
              <div className={`player-avatar avatar-${room.players.indexOf(player) % 2}`}>{player.name.charAt(0)}</div>
              <div>
                <strong>{player.name} {player.id === actualMyId && <small>أنت</small>}</strong>
                <span>{player.isHost ? 'المضيف' : player.connected ? 'متصل' : 'غير متصل'}</span>
              </div>
              <b className="player-score">{room.scores[player.id] ?? 0}</b>
              {player.isHost && <i>♛</i>}
            </div>
          ))}
          {room.players.length < 2 && <p className="waiting-line">بانتظار اللاعب الثاني...</p>}
        </div>
        <div className="ready-note">👥 {room.players.length === 2 ? 'اللاعبان موجودان' : 'شارك الكود مع صديقك'}</div>
        {lobby && !showSettings && (
  <button
    className={`start-paper-button ${me?.isReady ? 'ready' : ''}`}
    disabled={room.players.length < 2}
    onClick={toggleReady}
  >
    {me?.isReady ? '✓ أنت جاهز' : 'ابدأ اللعبة'}
  </button>
)}
      </aside>

      <aside className="secret-card paper-panel">
        <h3>بطاقاتك السرية</h3>
        <div className="secret-card-actions">
          <button
            className="red-secret-card"
            onClick={useRedCard}
            disabled={!round || room.status !== 'playing' || !myCardState.redAvailable}
          >
            <span className="cards-icon">🟥</span>
            <strong>تغيير العنصر</strong>
            <small>{myCardState.redAvailable ? 'مرة واحدة طوال الغرفة' : 'تم استخدامها'}</small>
          </button>
          <button
            className="blue-secret-card"
            onClick={useBlueCard}
            disabled={!round || room.status !== 'playing' || !isMyTurn || !myCardState.blueAvailable}
          >
            <span className="cards-icon">🟦</span>
            <strong>3 أدوار متتالية</strong>
            <small>{myCardState.blueAvailable ? 'تُستخدم أثناء دورك' : 'تم استخدامها'}</small>
          </button>
        </div>
      </aside>

      <main className="black-stage paper-panel">
        {lobby ? (
          <div className="stage-message">
            <div>👥</div>
            <h2>{room.players.length < 2 ? 'بانتظار انضمام لاعب آخر...' : 'اللاعبان جاهزان للتحدي'}</h2>
            <p>كل لاعب يرى عنصر منافسه ويحاول المنافس تخمينه</p>
          </div>
        ) : item ? (
          <div className="challenge-item">
            <span className="stage-label">عنصر منافسك</span>
            {item.imageUrl ? <img src={item.imageUrl} alt={item.nameAr} /> : <div className="giant-emoji" role="img" aria-label={item.nameAr}>{item.emoji}</div>}
            <h2>{item.nameAr}</h2>
            <p>أجب عن أسئلة منافسك، ولا تقل له الاسم مباشرة</p>
          </div>
        ) : (
          <div className="stage-message"><div>❓</div><h2>العنصر مخفي</h2></div>
        )}
      </main>

      {showSettings && lobby && (
  <div className="settings-drawer paper-panel">
    <h3>إعدادات الغرفة</h3>

    {!isHost && (
      <p>المضيف فقط يستطيع تعديل الإعدادات.</p>
    )}

    <div className="setting-row">
      <b>الفئة</b>

      <div>
        {categories.map((cat) => (
          <button
            key={cat.id}
            disabled={!isHost}
            className={cat.id === room.settings.categoryId ? "selected" : ""}
            onClick={() => updateSettings({ categoryId: cat.id })}
          >
            {cat.icon} {cat.nameAr}
          </button>
        ))}
      </div>
    </div>

    <div className="setting-row">
      <b>مدة الدور</b>

      <div>
        {TURN_DURATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            disabled={!isHost}
            className={
              opt.value === room.settings.turnDurationMs ? "selected" : ""
            }
            onClick={() =>
              updateSettings({ turnDurationMs: opt.value })
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>

    {isHost && (
      <button
        className="settings-ok-button"
        onClick={() => setShowSettings(false)}
      >
        ✅ موافق
      </button>
    )}
  </div>
)}

      {!lobby && round && !round.revealed && (
        <div className="turn-paper paper-panel">
          <strong>{isMyTurn ? 'دورك الآن' : `دور ${currentTurnPlayer?.name ?? 'المنافس'}`}</strong>
          <Timer endsAt={round.turnEndsAt} isMyTurn={isMyTurn} />
          {blueActiveForMe && <em className="blue-turn-note">🟦 بطاقتك فعالة — المتبقي {round.blueTurnsLeftIncludingCurrent} أدوار مع الدور الحالي</em>}
          <small>{isMyTurn ? 'فكّر ثم اطرح سؤالًا أو تخمينًا واحدًا قبل انتهاء الوقت' : 'استمع لسؤاله، ثم أنهِ محاولته أو أعلن فوزه'}</small>
        </div>
      )}

      {!lobby && !round?.revealed && (
        <div className="judge-paper paper-panel">
          <button className="wrong-answer" disabled={!canJudge} onClick={() => judgeAnswer(false)}>↪ انتقال الدور</button>
          <button className="correct-answer" disabled={!canJudge} onClick={() => judgeAnswer(true)}>✓ خمن العنصر</button>
          <small>{canJudge ? `اضغط «خمن العنصر» فقط إذا ذكر ${currentTurnPlayer?.name ?? 'المنافس'} الاسم الصحيح، وإلا انقل الدور` : 'الأزرار تظهر لصاحب العنصر فقط'}</small>
        </div>
      )}

      <footer className="game-info paper-panel">
        <div><span>{category?.icon ?? '🎲'}</span><b>الفئة</b><strong>{category?.nameAr ?? room.settings.categoryId}</strong></div>
        <div><span>♾️</span><b>المحاولات</b><strong>غير محدودة</strong></div>
        <div><span>⏱</span><b>مهلة السؤال</b><strong>{Math.round(room.settings.turnDurationMs / 1000)} ثانية</strong></div>
      </footer>

            {room.status === 'roundEnd' && (
        <div className="result-modal paper-panel">
          <h2>انتهت الجولة 🏆</h2>
          <p>الفائز: {room.players.find((player) => player.id === round?.winnerPlayerId)?.name}</p>
          <p>النتيجة محفوظة داخل هذه الغرفة، والبطاقات المستخدمة لن تعود.</p>
          <button onClick={prepareNextRound}>اختيار الفئة والجولة التالية</button>
        </div>
      )}

      {feedback && <div className="toast-message">{feedback}</div>}
 
    </section>
  );
}
