import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Award, Skull, Flame, RefreshCw } from 'lucide-react';
import { sfx } from '../../utils/audio.js';

export default function ClimaxModal({ players = {}, onRestart }) {
  useEffect(() => {
    sfx.playFanfare();
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
  }, []);

  // Calculate final score for each player:
  // Coins + (Dignity * 2) + (HP) - (Debts * 2)
  const ranked = Object.values(players).map(p => {
    const score = p.coins + (p.dignity * 2) + Math.floor(p.hp / 2) - (p.debts * 2);
    return { ...p, score };
  }).sort((a, b) => b.score - a.score);

  const winner = ranked[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-lg animate-in fade-in duration-300">
      <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 max-w-xl w-full shadow-[0_0_80px_rgba(251,191,36,0.4)] flex flex-col gap-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Crown & Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-lg mb-2 animate-bounce">
            👑
          </div>
          <h2 className="text-3xl font-black text-amber-300 font-arcade tracking-wide">
            SERATA CONCLUSA!
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Il Tavolo VIP al Borgo di Nettuno è stato conquistato! Ecco chi paga il conto e chi entra nella leggenda.
          </p>
        </div>

        {/* The Champion Card */}
        {winner && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 border-2 border-amber-400/80 text-center flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest">
              CAMPIONE DELLA NOTTE BRAVA
            </span>
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-2 border-amber-400 shadow-2xl my-2 bg-slate-950">
              {winner.image ? (
                <img src={winner.image} alt={winner.name} className="w-full h-full object-cover object-top" />
              ) : (
                <div className="text-4xl flex items-center justify-center h-full">{winner.avatar}</div>
              )}
            </div>
            <h3 className="text-xl font-black text-white">{winner.name}</h3>
            <p className="text-xs text-amber-300 font-bold">{winner.roleTitle}</p>
            <div className="mt-2 text-2xl font-black font-mono text-amber-400">
              {winner.score} Punti Leggendarietà
            </div>
          </div>
        )}

        {/* Full Leaderboard */}
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classifica Finale</h4>
          {ranked.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800"
            >
              <div className="flex items-center gap-3">
                <span className="font-black text-sm text-slate-500 font-mono w-4">#{idx + 1}</span>
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-700 bg-slate-900 shrink-0">
                  {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <span className="text-xl flex items-center justify-center h-full">{p.avatar}</span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{p.name}</div>
                  <div className="text-[10px] text-slate-400">
                    {p.coins}€ | {p.dignity} Dignità | {p.hp} HP {p.debts > 0 ? `| -${p.debts} Debiti` : ''}
                  </div>
                </div>
              </div>
              <span className="font-black text-base font-mono text-amber-300">
                {p.score} pts
              </span>
            </div>
          ))}
        </div>

        {/* Special Awards */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-rose-400 font-bold flex items-center gap-1">
              <Flame size={13} /> Sacco da Boxe
            </span>
            <p className="text-[11px] text-slate-300 mt-1">Chi ha preso più sberle al pub.</p>
          </div>
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-purple-400 font-bold flex items-center gap-1">
              <Skull size={13} /> Il Pelato d'Oro
            </span>
            <p className="text-[11px] text-slate-300 mt-1">Per chi ha perso sia i capelli che la dignità.</p>
          </div>
        </div>

        {/* Restart Game */}
        <button
          onClick={() => onRestart && onRestart()}
          className="w-full py-3 bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-black rounded-2xl uppercase tracking-wider shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 mt-1"
        >
          <RefreshCw size={18} />
          <span>INIZIA UN'ALTRA NOTTE BRAVA</span>
        </button>
      </div>
    </div>
  );
}
