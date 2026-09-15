import React from 'react';
import { Tv, Smartphone, LayoutGrid, RotateCcw, Users, Sparkles } from 'lucide-react';
import { sfx } from '../../utils/audio.js';
import { CHARACTERS } from '../../../server/game/characters.js';

export default function Header({
  viewMode,
  setViewMode,
  round,
  playerCount,
  currentPlayer,
  onResetGame,
  onOpenLobby
}) {
  const currentImg = currentPlayer ? (currentPlayer.image || CHARACTERS[currentPlayer.id]?.image) : null;

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-400 flex items-center justify-center text-xl shadow-lg shadow-rose-500/20">
            🎲
          </div>
          <div>
            <h1 className="font-arcade text-base sm:text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-rose-400 to-purple-400 leading-tight">
              NOTTE BRAVA
            </h1>
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-wide uppercase">
              ANZIO vs NETTUNO | Party Game Digitale
            </div>
          </div>
        </div>

        {/* Round & Current Turn Indicator */}
        {currentPlayer && (
          <div className="flex items-center gap-3 bg-slate-950/90 px-4 py-1.5 rounded-full border border-slate-800 shadow-inner">
            <div className="text-xs font-mono font-black text-amber-400">
              ROUND {round}
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span>Tocca a:</span>
              <span className="font-extrabold text-white flex items-center gap-1.5">
                {currentImg ? (
                  <img src={currentImg} alt={currentPlayer.name} className="w-5 h-5 rounded-full object-cover object-top border border-amber-400 shadow-sm" />
                ) : (
                  <span>{currentPlayer.avatar?.split(' ')[0]}</span>
                )}
                <span style={{ color: currentPlayer.color }}>{currentPlayer.name}</span>
              </span>
            </div>
            {playerCount && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                <span className="text-[11px] font-bold text-slate-400 font-mono">
                  {playerCount} Amici
                </span>
              </>
            )}
          </div>
        )}

        {/* View Mode Switcher + Controls */}
        <div className="flex items-center gap-2">
          {/* Change Players (Lobby) Button */}
          <button
            onClick={() => onOpenLobby && onOpenLobby()}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/80 rounded-xl text-xs font-bold text-slate-300 hover:text-amber-300 transition-all flex items-center gap-1.5"
            title="Cambia Giocatori al Tavolo (3, 4 o 5)"
          >
            <Users size={14} className="text-amber-400" />
            <span className="hidden md:inline">Giocatori</span>
          </button>

          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setViewMode('hotseat')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'hotseat'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mappa + Controller insieme (Test Rapido)"
            >
              <LayoutGrid size={13} />
              <span className="hidden lg:inline">Tutto in Uno</span>
            </button>

            <button
              onClick={() => setViewMode('tv')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'tv'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Schermo TV / Monitor per Salotto"
            >
              <Tv size={13} />
              <span className="hidden lg:inline">Schermo TV</span>
            </button>

            <button
              onClick={() => setViewMode('phone')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'phone'
                  ? 'bg-purple-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Controller Smartphone"
            >
              <Smartphone size={13} />
              <span className="hidden lg:inline">Telefono</span>
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              if (window.confirm("Vuoi ricominciare la Notte Brava da capo?")) {
                onResetGame && onResetGame();
              }
            }}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition-colors"
            title="Ricomincia Partita"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
