import React from 'react';
import { AlertCircle, HelpCircle, ArrowRight } from 'lucide-react';
import { sfx } from '../../utils/audio.js';

export default function EventModal({ event, players = {}, onChooseOption }) {
  if (!event) return null;

  const targetPlayer = players[event.targetPlayerId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-rose-500/80 rounded-3xl p-6 max-w-lg w-full shadow-[0_0_50px_rgba(244,63,94,0.3)] flex flex-col gap-4 text-slate-100 relative overflow-hidden">
        {/* Top Banner Tag */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1.5">
            <AlertCircle size={13} />
            CARTA EVENTO: ANZIO-NETTUNO
          </span>
          {targetPlayer && (
            <div className="flex items-center gap-2 text-xs text-slate-200 font-bold bg-slate-800 px-3 py-1 rounded-full border border-slate-700 shadow">
              {targetPlayer.image ? (
                <img src={targetPlayer.image} alt={targetPlayer.name} className="w-6 h-6 rounded-full object-cover object-top border border-amber-400" />
              ) : (
                <span>{targetPlayer.avatar.split(' ')[0]}</span>
              )}
              <span>Bersaglio: {targetPlayer.name}</span>
            </div>
          )}
        </div>

        {/* Title & Flavor */}
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">{event.title}</h2>
          <p className="text-sm text-slate-300 italic mt-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 leading-relaxed">
            "{event.flavor}"
          </p>
        </div>

        {/* Dilemma Prompt */}
        <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
          <HelpCircle size={16} />
          <span>{event.prompt}</span>
        </div>

        {/* Options / Choices */}
        <div className="flex flex-col gap-2.5 mt-1">
          {event.options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => {
                sfx.playCoin();
                onChooseOption && onChooseOption(event.targetPlayerId, idx);
              }}
              className="p-3.5 rounded-2xl bg-slate-950/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-400/80 text-left transition-all group flex flex-col gap-1 active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-white group-hover:text-amber-300 transition-colors">
                  {opt.text}
                </span>
                <ArrowRight size={16} className="text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-xs text-slate-400 group-hover:text-slate-300 leading-snug">
                {opt.effectText}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
