import { PlayerInfo } from '../types';

interface PlayerCardProps {
  player: PlayerInfo;
  isCurrentTurn: boolean;
  align: 'right' | 'left';
}

export default function PlayerCard({ player, isCurrentTurn, align }: PlayerCardProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-all
        ${isCurrentTurn ? 'border-orange-400 bg-orange-50 shadow-md dark:bg-orange-950/40' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}
        ${align === 'left' ? 'flex-row-reverse text-left' : 'text-right'}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white
          ${player.connected ? 'bg-blue-500' : 'bg-slate-400'}`}
      >
        {player.name.charAt(0)}
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-800 dark:text-slate-100">
          {player.name} {player.isHost && <span className="text-xs text-orange-500">(المضيف)</span>}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {player.connected ? `النقاط: ${player.score}` : 'غير متصل'}
        </p>
      </div>
      {isCurrentTurn && (
        <span className="mr-auto rounded-full bg-orange-500 px-2 py-1 text-xs font-bold text-white">دوره الآن</span>
      )}
    </div>
  );
}
