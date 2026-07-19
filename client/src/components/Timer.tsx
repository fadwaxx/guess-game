import { useEffect, useState } from 'react';

interface TimerProps {
  endsAt: number; // Date.now() + بقية الوقت - قادم من الخادم (مصدر الحقيقة)
  isMyTurn: boolean;
}

export default function Timer({ endsAt, isMyTurn }: TimerProps) {
  const [remainingMs, setRemainingMs] = useState(Math.max(0, endsAt - Date.now()));

  useEffect(() => {
    setRemainingMs(Math.max(0, endsAt - Date.now()));
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, endsAt - Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [endsAt]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isUrgent = remainingMs <= 15000;

  return (
    <div
      className={`flex items-center justify-center rounded-2xl px-6 py-3 font-bold text-2xl tabular-nums transition-colors
        ${isUrgent ? 'bg-red-100 text-red-600 animate-pulse dark:bg-red-950 dark:text-red-400' : isMyTurn ? 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
