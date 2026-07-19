import { useEffect, useState } from 'react';
import { socket } from '../socket';
import { PublicRoomState } from '../types';

interface HomeProps {
  onRoomReady: (room: PublicRoomState) => void;
  onError: (message: string) => void;
}

export default function Home({ onRoomReady, onError }: HomeProps) {
  const [mode, setMode] = useState<'idle' | 'join'>('idle');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeFromUrl = params.get('room');
    if (codeFromUrl) {
      setRoomCode(codeFromUrl.toUpperCase());
      setMode('join');
    }
  }, []);

  function persistName(name: string) {
    setPlayerName(name);
    localStorage.setItem('playerName', name);
  }

  function handleCreate() {
    if (!playerName.trim()) return onError('اكتب اسمك أولًا');
    setLoading(true);
    socket.emit('room:create', { playerName }, (res: any) => {
      setLoading(false);
      if (res.ok) {
        onRoomReady(res.room);
        const url = new URL(window.location.href);
        url.searchParams.set('room', res.room.code);
        window.history.replaceState({}, '', url.toString());
      } else {
        onError(res.error || 'تعذر إنشاء الغرفة');
      }
    });
  }

  function handleJoin() {
    if (!playerName.trim()) return onError('اكتب اسمك أولًا');
    if (!roomCode.trim()) return onError('اكتب رمز الغرفة');
    setLoading(true);
    socket.emit('room:join', { code: roomCode.trim().toUpperCase(), playerName }, (res: any) => {
      setLoading(false);
      if (res.ok) {
        onRoomReady(res.room);
        const url = new URL(window.location.href);
        url.searchParams.set('room', res.room.code);
        window.history.replaceState({}, '', url.toString());
      } else {
        onError(res.error || 'تعذر الانضمام للغرفة');
      }
    });
  }

  return (
    <div className="home-entry mx-auto flex min-h-[72vh] max-w-md items-center justify-center py-8">
      <section className="retro-entry-panel w-full px-5 py-7 sm:px-8">
        <div className="mb-7 text-center">
          <div className="mb-1 text-5xl drop-shadow-sm">🕵️‍♂️</div>
          <h2 className="retro-title text-2xl font-extrabold">لعبة تخمين العنصر</h2>
          <p className="retro-description mt-2 text-sm">
            أنشئ غرفة جديدة أو انضم إلى صديقك باستخدام رمز الغرفة
          </p>
        </div>

        <div className="retro-field-group">
          <label className="retro-label">اسمك</label>
          <input
            value={playerName}
            onChange={(e) => persistName(e.target.value)}
            placeholder="اكتب اسمك هنا"
            maxLength={20}
            className="retro-input"
          />
        </div>

        {mode === 'idle' && (
          <div className="mt-6 flex flex-col gap-5">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="retro-action-button retro-action-button--blue"
            >
              <span>{loading ? 'جارٍ الإنشاء...' : 'إنشاء غرفة جديدة'}</span>
              <span className="retro-button-icon">⊕</span>
            </button>

            <button
              onClick={() => setMode('join')}
              className="retro-action-button retro-action-button--green"
            >
              <span>الانضمام إلى غرفة</span>
              <span className="retro-button-icon">🔑</span>
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="mt-5 flex flex-col gap-4">
            <div className="retro-field-group">
              <label className="retro-label">رمز الغرفة</label>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="مثال: A52K9"
                maxLength={6}
                className="retro-input retro-code-input"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={loading}
              className="retro-action-button retro-action-button--green"
            >
              <span>{loading ? 'جارٍ الانضمام...' : 'الانضمام الآن'}</span>
              <span className="retro-button-icon">🔑</span>
            </button>

            <button onClick={() => setMode('idle')} className="retro-back-button">
              رجوع
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
