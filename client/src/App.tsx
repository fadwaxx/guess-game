import { useEffect, useState, useCallback } from 'react';
import { socket } from './socket';
import { PublicRoomState } from './types';
import Home from './pages/Home';
import Room from './pages/Room';
import IntroVideo from './components/IntroVideo';

export default function App() {
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [myId] = useState<string>(() => { const saved=localStorage.getItem('guess-player-token'); if(saved) return saved; const token=crypto.randomUUID(); localStorage.setItem('guess-player-token',token); return token; });
  const [error, setError] = useState<string>('');
  const [darkMode, setDarkMode] = useState(false);
  const [showIntro, setShowIntro] = useState(
    () => window.sessionStorage.getItem('guess-game-intro-seen') !== 'true'
  );

  useEffect(() => {
    function onConnect() {
      const code = new URLSearchParams(window.location.search).get('room');
      const playerName = localStorage.getItem('playerName');
      if (code && playerName) {
        socket.emit('room:join', { code, playerName, playerToken: myId }, (res: any) => {
          if (res?.ok) setRoom(res.room);
        });
      }
    }
    function onRoomState(state: PublicRoomState) {
      setRoom(state);
    }
    function onRoomClosed() {
      setError('تم إغلاق الغرفة (انقطع اللاعب الآخر ولم يعد خلال المهلة المسموحة)');
      setRoom(null);
    }

    socket.on('connect', onConnect);
    socket.on('room:state', onRoomState);
    socket.on('room:closed', onRoomClosed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('room:state', onRoomState);
      socket.off('room:closed', onRoomClosed);
    };
  }, [myId]);

  const goHome = useCallback(() => {
    setRoom(null);
    setError('');
  }, []);

  return (
    <div dir="rtl" className={darkMode ? 'dark' : ''}>
      {showIntro && <IntroVideo onFinished={() => setShowIntro(false)} />}
      <div className="game-background min-h-screen text-slate-800 transition-colors dark:text-slate-100">
        <div className="game-background-overlay min-h-screen">
        <header className="flex items-center justify-between px-4 py-3 sm:px-8">
          <h1 className="text-lg font-extrabold text-blue-600 dark:text-blue-400">🎯 خمّن العنصر</h1>
          <button
            onClick={() => setDarkMode((d) => !d)}
            className="rounded-full bg-white/70 px-3 py-1.5 text-sm shadow-sm ring-1 ring-slate-200 hover:bg-white dark:bg-slate-800 dark:ring-slate-700"
          >
            {darkMode ? '☀️ فاتح' : '🌙 داكن'}
          </button>
        </header>

        {error && (
          <div className="mx-4 mb-4 rounded-xl bg-red-50 px-4 py-3 text-center text-red-600 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </div>
        )}

        <main className="px-4 pb-10 sm:px-8">
          {room ? (
            <Room room={room} myId={myId} onLeave={goHome} />
          ) : (
            <Home onRoomReady={setRoom} onError={setError} />
          )}
        </main>
        </div>
      </div>
    </div>
  );
}
