import React from 'react';
import { CHARACTERS } from '../../../server/game/characters.js';
import { sfx } from '../../utils/audio.js';
import { 
  Heart, 
  ShieldAlert, 
  Coins, 
  Dices, 
  Flame, 
  Volume2, 
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Skull
} from 'lucide-react';

export default function PlayerPhoneView({
  player,
  isCurrentTurn,
  diceResult,
  hasAvailableMoves,
  onRollDice,
  onEndTurn,
  onUseSkill,
  onJudokaInterrupt,
  onPlaySound
}) {
  if (!player) return null;

  const baseChar = CHARACTERS[player.id];

  // Specific visual gauge based on unique character resource
  const renderResourceGauge = () => {
    switch (player.id) {
      case "nicolò": {
        const val = player.resourceValue;
        let statusText = "Sobrio";
        let statusColor = "text-emerald-400";
        if (val > 80) { statusText = "DEVASTATO"; statusColor = "text-red-500 animate-pulse"; }
        else if (val > 55) { statusText = "GOBLIN"; statusColor = "text-amber-400"; }
        else if (val > 25) { statusText = "Brillo"; statusColor = "text-yellow-300"; }

        return (
          <div className="bg-emerald-950/40 border border-emerald-800/60 p-2.5 rounded-xl">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-emerald-300 font-bold flex items-center gap-1">
                🍷 {player.resourceName}
              </span>
              <span className={`font-mono font-bold ${statusColor}`}>{player.resourceValue}% ({statusText})</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-emerald-900">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-600 transition-all duration-300"
                style={{ width: `${Math.min(100, player.resourceValue)}%` }}
              />
            </div>
          </div>
        );
      }
      case "christian": {
        return (
          <div className="bg-red-950/40 border border-red-800/60 p-2.5 rounded-xl">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-red-300 font-bold flex items-center gap-1">
                💡 {player.resourceName}
              </span>
              <span className="text-amber-300 font-bold text-sm">
                {"💡".repeat(player.resourceValue) || "Nessuna (Incompreso)"}
              </span>
            </div>
            <p className="text-[10px] text-red-200/70">Più subisci colpi, più impari e diventi inarrestabile!</p>
          </div>
        );
      }
      case "victor": {
        return (
          <div className="bg-cyan-950/40 border border-cyan-800/60 p-2.5 rounded-xl">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-cyan-300 font-bold flex items-center gap-1">
                🧪 {player.resourceName}
              </span>
              <span className="text-cyan-300 font-mono font-bold">{player.resourceValue} / 5 Provette</span>
            </div>
            <div className="flex gap-1.5 mt-1">
              {[1, 2, 3, 4, 5].map(idx => (
                <div 
                  key={idx}
                  className={`flex-1 h-3 rounded-full border transition-all ${
                    idx <= player.resourceValue 
                      ? 'bg-cyan-400 border-cyan-200 shadow-[0_0_6px_#06b6d4]' 
                      : 'bg-slate-900 border-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        );
      }
      case "judoka": {
        return (
          <div className="bg-amber-950/40 border border-amber-800/60 p-2.5 rounded-xl">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-amber-300 font-bold flex items-center gap-1">
                🍧 {player.resourceName}
              </span>
              <span className="text-amber-400 font-mono font-bold">{player.resourceValue}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-amber-900">
              <div 
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${Math.min(100, player.resourceValue)}%` }}
              />
            </div>
          </div>
        );
      }
      case "ciro": {
        return (
          <div className="bg-purple-950/40 border border-purple-800/60 p-2.5 rounded-xl">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-purple-300 font-bold flex items-center gap-1">
                💈 {player.resourceName}
              </span>
              <span className="text-amber-300 font-black tracking-widest text-sm">
                {"💈 ".repeat(player.resourceValue) || "PELATO GLOBALE 👨‍🦲"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-purple-200/80 mt-1">
              <span>Debiti Pendenti: <strong className="text-rose-400 font-mono">{player.debts} Monete</strong></span>
              <span>Usa un capello per annullare la morte!</span>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-4 text-slate-100">
      {/* Character Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <div 
          className="w-16 h-16 rounded-2xl overflow-hidden shadow-inner border-2 shrink-0 bg-slate-950 flex items-center justify-center"
          style={{ borderColor: player.color }}
        >
          {player.image ? (
            <img src={player.image} alt={player.name} className="w-full h-full object-cover object-top" />
          ) : (
            <span className="text-3xl">{player.avatar}</span>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-lg tracking-tight">{player.name}</h3>
            <span 
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full"
              style={{ backgroundColor: player.color + '30', color: player.color }}
            >
              {player.roleTitle}
            </span>
          </div>
          <p className="text-xs text-slate-400 italic mt-0.5 line-clamp-1">"{player.quote}"</p>
        </div>
      </div>

      {/* Vital Stats: HP, Dignità, Monete */}
      <div className="grid grid-cols-3 gap-2">
        {/* HP */}
        <div className="bg-slate-950/60 border border-slate-800 p-2 rounded-xl">
          <div className="flex items-center gap-1 text-[11px] text-rose-400 font-bold">
            <Heart size={13} className="fill-rose-500" />
            <span>SALUTE</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-rose-300 font-mono">{player.hp}</span>
            <span className="text-[10px] text-slate-500">/{player.maxHp}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-rose-500 transition-all"
              style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
            />
          </div>
        </div>

        {/* Dignità */}
        <div className="bg-slate-950/60 border border-slate-800 p-2 rounded-xl">
          <div className="flex items-center gap-1 text-[11px] text-sky-400 font-bold">
            <ShieldAlert size={13} />
            <span>DIGNITÀ</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-sky-300 font-mono">{player.dignity}</span>
            <span className="text-[10px] text-slate-500">/{player.maxDignity}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-sky-400 transition-all"
              style={{ width: `${(player.dignity / player.maxDignity) * 100}%` }}
            />
          </div>
        </div>

        {/* Monete */}
        <div className="bg-slate-950/60 border border-slate-800 p-2 rounded-xl">
          <div className="flex items-center gap-1 text-[11px] text-amber-400 font-bold">
            <Coins size={13} />
            <span>MONETE</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-black text-amber-300 font-mono">{player.coins}</span>
            <span className="text-[10px] text-amber-500/70">€</span>
          </div>
          <div className="text-[9px] text-slate-400 mt-1 truncate">
            {player.debts > 0 ? `-${player.debts} Debiti` : 'Pulito'}
          </div>
        </div>
      </div>

      {/* Asymmetric Resource Gauge */}
      {renderResourceGauge()}

      {/* Passive Ability Banner */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold">
          <Sparkles size={14} />
          <span>PASSIVA: {baseChar.passive.name}</span>
        </div>
        <p className="text-slate-300 text-[11px] mt-1 leading-relaxed">{baseChar.passive.desc}</p>
      </div>

      {/* ACTIVE TURN CONTROLS */}
      {isCurrentTurn ? (
        <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-2 border-amber-400/80 p-3 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-black uppercase text-amber-300 tracking-wider">
            <span>🎲 È IL TUO TURNO!</span>
            {diceResult && <span className="font-mono bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-bold">Tiro: {diceResult}</span>}
          </div>

          <div className="flex gap-2 mt-1">
            {!diceResult ? (
              <button
                onClick={() => {
                  sfx.playDice();
                  onRollDice && onRollDice(player.id);
                }}
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black rounded-xl text-sm uppercase shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Dices size={18} />
                <span>LANCIA IL DADO</span>
              </button>
            ) : (
              <button
                onClick={() => onEndTurn && onEndTurn()}
                disabled={hasAvailableMoves}
                className={`flex-1 py-3 font-black rounded-xl text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                  hasAvailableMoves 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-95 shadow-lg shadow-emerald-500/20'
                }`}
              >
                <RefreshCw size={16} />
                <span>{hasAvailableMoves ? 'SCEGLI IL PERCORSO SULLA MAPPA' : 'PASSA IL TURNO'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-800/60 p-2.5 rounded-xl text-center text-xs text-slate-400">
          In attesa del turno altrui... Prepara le infamate o i contenziosi!
        </div>
      )}

      {/* Asymmetric Skills Deck */}
      <div>
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Flame size={14} className="text-rose-400" />
          <span>ABILITÀ SPECIALI</span>
        </h4>
        <div className="flex flex-col gap-2">
          {baseChar.skills.map(skill => (
            <button
              key={skill.id}
              onClick={() => {
                sfx.playGlitch();
                onUseSkill && onUseSkill(player.id, skill.id);
              }}
              className="w-full text-left p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 transition-all group flex flex-col gap-0.5"
            >
              <div className="flex justify-between items-center text-xs font-bold text-slate-200 group-hover:text-amber-300">
                <span>{skill.name}</span>
                {skill.cost > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    Costo: {skill.cost}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">{skill.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* EMERGENCY BUZZER: JUDOKA'S "NO, ASPETTA!" */}
      {player.id === "judoka" && (
        <button
          onClick={() => {
            sfx.playBuzzer();
            onJudokaInterrupt && onJudokaInterrupt();
          }}
          className="w-full py-3 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-black text-sm rounded-xl uppercase tracking-wider shadow-xl shadow-red-900/30 border-2 border-amber-300 animate-pulse active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <AlertTriangle size={18} />
          <span>🛑 NO, ASPETTA! (BLOCCA TUTTO)</span>
        </button>
      )}

      {/* Soundboard Quick Reactions */}
      <div className="border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold mb-2">
          <span className="flex items-center gap-1"><Volume2 size={13} /> SOUNDBOARD DISTURBO</span>
          <span className="text-[10px] text-slate-500">Suona sulla TV</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <button 
            onClick={() => { sfx.playBuzzer(); onPlaySound && onPlaySound('urlo'); }}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-lg text-xs font-bold text-slate-200 transition-all text-center truncate"
          >
            📢 Urlo
          </button>
          <button 
            onClick={() => { sfx.playPunch(); onPlaySound && onPlaySound('sberla'); }}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-lg text-xs font-bold text-slate-200 transition-all text-center truncate"
          >
            🥊 Sberla
          </button>
          <button 
            onClick={() => { sfx.playCoin(); onPlaySound && onPlaySound('monete'); }}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-lg text-xs font-bold text-slate-200 transition-all text-center truncate"
          >
            💰 Spicci
          </button>
          <button 
            onClick={() => { sfx.playGlitch(); onPlaySound && onPlaySound('glitch'); }}
            className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded-lg text-xs font-bold text-slate-200 transition-all text-center truncate"
          >
            👾 Bug
          </button>
        </div>
      </div>
    </div>
  );
}
