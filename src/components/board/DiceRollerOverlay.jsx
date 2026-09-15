import React, { useState, useEffect } from 'react';
import { sfx } from '../../utils/audio.js';
import { Dices, Sparkles } from 'lucide-react';
import { CHARACTERS } from '../../../server/game/characters.js';

export default function DiceRollerOverlay({ rolling, finalValue, player, onFinish }) {
  const [displayValue, setDisplayValue] = useState(1);
  const [animating, setAnimating] = useState(false);

  const diceFaces = [
    // 1
    <div key="1" className="w-full h-full flex items-center justify-center">
      <span className="w-5 h-5 rounded-full bg-slate-900 shadow-inner"></span>
    </div>,
    // 2
    <div key="2" className="w-full h-full flex justify-between p-3">
      <span className="w-4 h-4 rounded-full bg-slate-900"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-end"></span>
    </div>,
    // 3
    <div key="3" className="w-full h-full flex justify-between p-3">
      <span className="w-4 h-4 rounded-full bg-slate-900"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-center"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-end"></span>
    </div>,
    // 4
    <div key="4" className="w-full h-full grid grid-cols-2 p-3 place-content-between">
      <span className="w-4 h-4 rounded-full bg-slate-900"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 justify-self-end"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-end"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-end justify-self-end"></span>
    </div>,
    // 5
    <div key="5" className="w-full h-full relative p-3">
      <span className="w-4 h-4 rounded-full bg-slate-900 absolute top-3 left-3"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 absolute top-3 right-3"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 absolute bottom-3 left-3"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 absolute bottom-3 right-3"></span>
    </div>,
    // 6
    <div key="6" className="w-full h-full grid grid-cols-2 p-3 place-content-between">
      <span className="w-4 h-4 rounded-full bg-slate-900"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 justify-self-end"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-center"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-center justify-self-end"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-end"></span>
      <span className="w-4 h-4 rounded-full bg-slate-900 self-end justify-self-end"></span>
    </div>
  ];

  useEffect(() => {
    if (rolling) {
      setAnimating(true);
      sfx.playDice();

      let ticks = 0;
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
        ticks++;

        if (ticks > 12) {
          clearInterval(interval);
          setDisplayValue(finalValue || 1);
          setAnimating(false);
          sfx.playCoin();
          if (onFinish) {
            setTimeout(onFinish, 900);
          }
        }
      }, 70);

      return () => clearInterval(interval);
    }
  }, [rolling, finalValue]);

  if (!rolling && !animating) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-90 duration-300">
        {/* Player Who is Rolling */}
        {player && (
          <div className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-slate-900/95 border-2 border-amber-400 shadow-2xl text-white text-sm font-black uppercase tracking-wider">
            {(player.image || CHARACTERS[player.id]?.image) ? (
              <img src={player.image || CHARACTERS[player.id]?.image} alt={player.name} className="w-8 h-8 rounded-full object-cover object-top border border-amber-400 shadow" />
            ) : (
              <span className="text-xl">{player.avatar?.split(' ')[0]}</span>
            )}
            <span>{player.name} STA TIRANDO IL DADO!</span>
          </div>
        )}

        {/* Big 3D Glowing Die */}
        <div 
          className={`w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-white via-slate-100 to-slate-300 border-4 border-slate-400 shadow-[0_0_50px_rgba(251,191,36,0.6)] flex items-center justify-center transition-all ${
            animating ? 'animate-spin scale-110' : 'scale-100 ring-8 ring-amber-400/80 ring-offset-4 ring-offset-slate-950'
          }`}
        >
          {diceFaces[(displayValue - 1) % 6]}
        </div>

        {/* Result Announcement */}
        {!animating && (
          <div className="text-center animate-in bounce-in duration-300">
            <span className="text-3xl sm:text-4xl font-black font-arcade text-amber-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">
              È USCITO {displayValue}!
            </span>
            <p className="text-xs text-slate-300 mt-1 font-bold">
              Scegli la casella o avanza sul percorso!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
