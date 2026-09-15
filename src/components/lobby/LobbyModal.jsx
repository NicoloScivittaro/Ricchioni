import React, { useState } from 'react';
import { CHARACTERS } from '../../../server/game/characters.js';
import { Users, CheckCircle2, Play, Sparkles } from 'lucide-react';
import { sfx } from '../../utils/audio.js';

export default function LobbyModal({ onStartGame, currentSelected = [] }) {
  const allCharacters = Object.values(CHARACTERS);
  const [selectedIds, setSelectedIds] = useState(
    currentSelected.length >= 2 ? currentSelected : ["nicolò", "christian", "victor", "judoka", "ciro"]
  );

  const togglePlayer = (id) => {
    sfx.playCoin();
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 2) {
        alert("Servono almeno 2 o 3 giocatori per giocare la Notte Brava!");
        return;
      }
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleStart = () => {
    sfx.playFanfare();
    onStartGame(selectedIds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-slate-900 border-2 border-amber-400/80 rounded-3xl p-5 sm:p-8 max-w-6xl w-full shadow-[0_0_80px_rgba(251,191,36,0.3)] flex flex-col gap-6 text-slate-100 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black uppercase tracking-wider mb-2">
            <Users size={14} />
            FORMAZIONE TAVOLO DELLA NOTTE
          </div>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-arcade">
            CHI C'È STASERA?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl mx-auto">
            Seleziona gli omini che parteciperanno alla partita (da 3 a 5 amici). Clicca sulle statuette per attivare o disattivare!
          </p>
          <div className="mt-2.5 inline-block bg-slate-950 px-4 py-1 rounded-full border border-slate-800 text-xs font-bold text-amber-400 font-mono">
            {selectedIds.length} DI 5 OMINI ATTIVI
          </div>
        </div>

        {/* 5 High-Res 3D Miniature Figurines Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {allCharacters.map(char => {
            const isSelected = selectedIds.includes(char.id);

            return (
              <div
                key={char.id}
                onClick={() => togglePlayer(char.id)}
                className={`relative rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between overflow-hidden select-none group ${
                  isSelected
                    ? 'bg-slate-950 shadow-2xl scale-[1.02]'
                    : 'bg-slate-950/40 border-slate-800 opacity-40 grayscale hover:grayscale-0 hover:opacity-80'
                }`}
                style={{
                  borderColor: isSelected ? char.color : '#334155',
                  boxShadow: isSelected ? `0 0 30px ${char.color}40` : 'none'
                }}
              >
                {/* 3D Figurine Image */}
                <div className="relative w-full aspect-[3/4] overflow-hidden bg-slate-900 border-b border-slate-800">
                  <img
                    src={char.image}
                    alt={char.name}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  
                  {/* Selection Badge in corner */}
                  <div className="absolute top-2.5 right-2.5">
                    {isSelected ? (
                      <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-sm shadow-lg ring-2 ring-emerald-300">
                        ✓
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-[10px] text-slate-400 font-bold">
                        Fuori
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3.5 flex flex-col gap-2">
                  <div>
                    <h3 className="font-extrabold text-base text-white tracking-wide">{char.name}</h3>
                    <div 
                      className="text-[10px] font-black uppercase tracking-wider mt-0.5"
                      style={{ color: char.color }}
                    >
                      {char.roleTitle}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 italic line-clamp-2">
                    "{char.quote}"
                  </p>

                  <div className="text-[10px] bg-slate-900/90 p-2 rounded-xl border border-slate-800 text-slate-300">
                    <span className="font-bold text-amber-300 block mb-0.5">Potere Speciale:</span>
                    <span>{char.resourceName}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          className="w-full py-4 bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 hover:from-amber-300 hover:via-rose-400 hover:to-purple-500 text-slate-950 font-black text-base rounded-2xl uppercase tracking-wider shadow-2xl shadow-rose-500/30 transition-all active:scale-98 flex items-center justify-center gap-3 cursor-pointer"
        >
          <Play size={20} className="fill-slate-950" />
          <span>AVVIA LA NOTTE BRAVA CON QUESTI OMINI ({selectedIds.length})</span>
        </button>
      </div>
    </div>
  );
}
