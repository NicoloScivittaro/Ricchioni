import React from 'react';
import { sfx } from '../../utils/audio.js';
import { Swords, Hand, ShieldAlert, Sparkles } from 'lucide-react';

export default function CombatModal({ combat, players = {}, onSelectMove }) {
  if (!combat) return null;

  const attacker = players[combat.attackerId];
  const defender = players[combat.defenderId];

  const moves = [
    {
      id: "punch",
      name: "Cazzotto da Orbo",
      subtitle: "Batte l'Infamata, perde contro la Presa",
      icon: "🥊",
      color: "from-red-600 to-rose-700"
    },
    {
      id: "throw",
      name: "Presa / Leva da Judo",
      subtitle: "Batte il Cazzotto, perde contro l'Infamata",
      icon: "🥋",
      color: "from-amber-600 to-yellow-700"
    },
    {
      id: "trick",
      name: "Dito nell'Occhio / Infamata",
      subtitle: "Batte la Presa, perde contro il Cazzotto",
      icon: "🤏",
      color: "from-purple-600 to-indigo-700"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-red-500 rounded-3xl p-6 max-w-lg w-full shadow-[0_0_60px_rgba(239,68,68,0.4)] flex flex-col gap-5 text-slate-100 relative">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-black uppercase tracking-wider mb-2">
            <Swords size={14} />
            SCAZZOTTATA AL PUB
          </div>
          <h2 className="text-2xl font-black text-white">DUEL TRA AMICI!</h2>
          <p className="text-xs text-slate-400">Scegli la tua mossa in segreto: Morra Cinese Violenta!</p>
        </div>

        {/* Versus Faceoff Banner */}
        <div className="flex items-center justify-around bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
          {/* Attacker */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div 
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-xl bg-slate-900 flex items-center justify-center"
              style={{ borderColor: attacker?.color || '#ef4444' }}
            >
              {attacker?.image ? (
                <img src={attacker.image} alt={attacker.name} className="w-full h-full object-cover object-top" />
              ) : (
                <span className="text-3xl">{attacker?.avatar}</span>
              )}
            </div>
            <span className="font-extrabold text-sm text-rose-400">{attacker?.name}</span>
            <span className="text-[10px] text-slate-500">HP: {attacker?.hp}</span>
            {combat.attackerMove ? (
              <span className="text-xs font-bold text-emerald-400 mt-0.5">✓ Pronto!</span>
            ) : (
              <span className="text-xs text-amber-400 mt-0.5 animate-pulse">Sceglie...</span>
            )}
          </div>

          <span className="text-2xl font-black text-slate-600 font-arcade">VS</span>

          {/* Defender */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div 
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-xl bg-slate-900 flex items-center justify-center"
              style={{ borderColor: defender?.color || '#38bdf8' }}
            >
              {defender?.image ? (
                <img src={defender.image} alt={defender.name} className="w-full h-full object-cover object-top" />
              ) : (
                <span className="text-3xl">{defender?.avatar}</span>
              )}
            </div>
            <span className="font-extrabold text-sm text-sky-400">{defender?.name}</span>
            <span className="text-[10px] text-slate-500">HP: {defender?.hp}</span>
            {combat.defenderMove ? (
              <span className="text-xs font-bold text-emerald-400 mt-0.5">✓ Pronto!</span>
            ) : (
              <span className="text-xs text-amber-400 mt-0.5 animate-pulse">Sceglie...</span>
            )}
          </div>
        </div>

        {/* Moves Selection */}
        <div className="flex flex-col gap-2">
          {moves.map(move => (
            <button
              key={move.id}
              onClick={() => {
                sfx.playPunch();
                // If attacker hasn't moved, pick for attacker, otherwise defender
                const activeTurnPlayerId = !combat.attackerMove ? combat.attackerId : combat.defenderId;
                onSelectMove && onSelectMove(activeTurnPlayerId, move.id);
              }}
              className={`p-3.5 rounded-2xl bg-gradient-to-r ${move.color} text-white font-black text-left shadow-lg transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-between`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{move.icon}</span>
                <div>
                  <div className="text-sm font-black">{move.name}</div>
                  <div className="text-[11px] font-normal text-white/80">{move.subtitle}</div>
                </div>
              </div>
              <span className="text-xs uppercase bg-black/30 px-2.5 py-1 rounded-lg">SCEGLI</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
