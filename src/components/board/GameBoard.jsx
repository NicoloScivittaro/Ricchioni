import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, Sparkles, Dices, RefreshCw } from 'lucide-react';
import { sfx } from '../../utils/audio.js';
import DiceRollerOverlay from './DiceRollerOverlay.jsx';
import { CHARACTERS } from '../../../server/game/characters.js';

export default function GameBoard({
  nodes = [],
  players = {},
  currentPlayerId,
  availableMoves = [],
  diceResult,
  plannedPath = [],
  onSelectNode,
  onRollDice,
  onEndTurn
}) {
  const [inspectedNodeId, setInspectedNodeId] = useState(null);
  const [isRollingAnimation, setIsRollingAnimation] = useState(false);
  const [steppingPlayerId, setSteppingPlayerId] = useState(null);
  const [animatedStepPosition, setAnimatedStepPosition] = useState(null);

  const currentPlayer = players[currentPlayerId];
  const isMovingRef = useRef(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleRollClick = () => {
    if (!diceResult && onRollDice && currentPlayerId && !isMovingRef.current) {
      setIsRollingAnimation(true);
      onRollDice(currentPlayerId);
    }
  };

  // When dice roll animation finishes: trigger step-by-step hopping!
  const handleDiceAnimationFinish = () => {
    setIsRollingAnimation(false);

    if (!currentPlayer || isMovingRef.current) return;

    // Determine path steps
    let steps = [];
    if (plannedPath && plannedPath.length > 0) {
      steps = [...plannedPath];
    } else if (diceResult && diceResult > 0) {
      let curr = currentPlayer.position;
      for (let i = 1; i <= diceResult; i++) {
        curr = (curr + 1) % nodes.length;
        steps.push(curr);
        if (curr === 21) break; // Casa di Carbo ARRIVO
      }
    }

    if (steps.length === 0) return;

    isMovingRef.current = true;
    setSteppingPlayerId(currentPlayer.id);

    // Hop tile-by-tile with sound and animation
    steps.forEach((targetStepNode, index) => {
      setTimeout(() => {
        setAnimatedStepPosition(targetStepNode);
        sfx.playPunch(); // Subtle step/hop impact sound

        // When arrived on the final tile
        if (index === steps.length - 1) {
          setTimeout(() => {
            isMovingRef.current = false;
            setSteppingPlayerId(null);
            setAnimatedStepPosition(null);
            sfx.playCoin();
            if (onSelectNode) {
              onSelectNode(targetStepNode);
            }
          }, 350);
        }
      }, (index + 1) * 300); // 300ms per tile step!
    });
  };

  const inspectedNode = nodes.find(n => n.id === inspectedNodeId);

  return (
    <div className="relative w-full flex flex-col items-center select-none">
      {/* 3D DICE ROLLER OVERLAY POPUP */}
      <DiceRollerOverlay
        rolling={isRollingAnimation}
        finalValue={diceResult}
        player={currentPlayer}
        onFinish={handleDiceAnimationFinish}
      />

      {/* Top Quick Bar: Fullscreen & Status */}
      <div className="w-full max-w-6xl flex items-center justify-between gap-3 px-4 py-2 mb-2 bg-slate-900/90 rounded-2xl border border-slate-800 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1 text-amber-400 font-extrabold uppercase tracking-wider">
            <Sparkles size={14} /> TABELLONE AD ALTA TENSIONE
          </span>
          <span className="hidden sm:inline text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-400">
            Ogni mossa può ribaltare tutto! Attento ai feudi e alle risse sul posto.
          </span>
        </div>

        <button
          onClick={toggleFullscreen}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 shadow cursor-pointer active:scale-95"
          title="Schermo Intero per TV / Monitor"
        >
          <Maximize2 size={13} />
          <span>Schermo Intero</span>
        </button>
      </div>

      {/* THE MAIN BOARD */}
      <div className="relative w-full max-w-6xl aspect-[1024/768] rounded-3xl overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.8)] border-4 border-slate-800/90 bg-slate-950">
        {/* Real Board Artwork Background */}
        <img
          src="/board_bg.jpg"
          alt="Tabellone Anzio-Nettuno"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />

        {/* Subtle Ambient Vignette */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/35 via-transparent to-black/15" />

        {/* INTERACTIVE DYNAMIC TILE OVERLAYS */}
        {nodes.map(node => {
          const isSelectable = availableMoves.includes(node.id) && !isMovingRef.current;
          
          // Compute players on this tile, accounting for active stepping animation
          const playersHere = Object.values(players).filter(p => {
            if (steppingPlayerId === p.id && animatedStepPosition !== null) {
              return node.id === animatedStepPosition;
            }
            return p.position === node.id && (steppingPlayerId !== p.id);
          });

          const isInspected = inspectedNodeId === node.id;
          const left = `${node.xPct}%`;
          const top = `${node.yPct}%`;

          return (
            <div
              key={node.id}
              style={{
                left,
                top,
                transform: 'translate(-50%, -50%)'
              }}
              onClick={() => {
                sfx.playCoin();
                setInspectedNodeId(node.id);
                if (isSelectable && onSelectNode && !isMovingRef.current) {
                  onSelectNode(node.id);
                }
              }}
              className={`absolute cursor-pointer transition-all duration-300 z-20 ${
                isSelectable ? 'scale-125 z-40' : 'hover:scale-110 hover:z-30'
              }`}
            >
              {/* Dynamic Interactive Tile Center Hotspot */}
              <div
                className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isSelectable
                    ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-950 bg-amber-400/40 shadow-[0_0_25px_#fbbf24] animate-bounce'
                    : isInspected
                    ? 'ring-2 ring-white bg-white/20 shadow-[0_0_15px_rgba(255,255,255,0.6)]'
                    : 'hover:bg-amber-400/20 hover:ring-2 hover:ring-amber-300/60'
                }`}
              >
                {/* Feud / Finish Badges */}
                {node.type === 'finish' && (
                  <span className="absolute -top-3 -right-2 text-base animate-pulse">👑</span>
                )}
                {node.type === 'feud_nicolo' && (
                  <span className="absolute -top-2 -right-1 text-xs">🍷</span>
                )}
                {node.type === 'feud_christian' && (
                  <span className="absolute -top-2 -right-1 text-xs">🥊</span>
                )}
                {node.type === 'feud_victor' && (
                  <span className="absolute -top-2 -right-1 text-xs">🧪</span>
                )}
                {node.type === 'feud_judoka' && (
                  <span className="absolute -top-2 -right-1 text-xs">🥋</span>
                )}
                {node.type === 'feud_ciro' && (
                  <span className="absolute -top-2 -right-1 text-xs">💸</span>
                )}

                {/* Destination Action Prompt */}
                {isSelectable && (
                  <div className="absolute -bottom-6 px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[9px] rounded-full uppercase shadow-xl tracking-wider animate-pulse whitespace-nowrap">
                    VAI QUI!
                  </div>
                )}
              </div>

              {/* DYNAMIC PLAYER TOKENS: CENTERED IF 1, NEATLY SPREAD IF MULTIPLE */}
              {playersHere.length > 0 && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {playersHere.map((p, idx) => {
                    const total = playersHere.length;
                    
                    let offsetX = 0;
                    let offsetY = 0;

                    if (total > 1) {
                      const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
                      offsetX = Math.cos(angle) * 15;
                      offsetY = Math.sin(angle) * 15;
                    }

                    const isCurrent = p.id === currentPlayerId;
                    const isSteppingThis = steppingPlayerId === p.id;

                    const pImg = p.image || CHARACTERS[p.id]?.image;
                    const currentPImg = currentPlayer?.image || (currentPlayer ? CHARACTERS[currentPlayer.id]?.image : null);

                    return (
                      <div
                        key={p.id}
                        title={`${p.name} (${p.roleTitle})`}
                        style={{
                          transform: `translate(${offsetX}px, ${offsetY}px)`,
                          borderColor: p.color
                        }}
                        className={`absolute w-12 h-16 sm:w-14 sm:h-18 rounded-2xl border-2 shadow-[0_8px_20px_rgba(0,0,0,0.95)] overflow-hidden transition-all pointer-events-auto flex flex-col items-center justify-between bg-slate-950 ${
                          isSteppingThis
                            ? 'scale-150 -translate-y-4 ring-4 ring-white z-50 animate-bounce'
                            : isCurrent
                            ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-950 scale-125 z-50 animate-pulse'
                            : 'z-40 hover:scale-115'
                        }`}
                      >
                        <div className="w-full h-full relative overflow-hidden bg-slate-900">
                          {pImg ? (
                            <img
                              src={pImg}
                              alt={p.name}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <span className="text-xl flex items-center justify-center h-full">{p.avatar}</span>
                          )}
                        </div>
                        {/* Pedestal base */}
                        <div 
                          className="w-full py-0.5 text-center text-[8px] font-black uppercase text-white truncate shrink-0 tracking-wider shadow"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.name.split(' ')[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* ON-BOARD PROMINENT INTERACTIVE DICE WIDGET */}
        <div className="absolute top-4 left-4 z-40 bg-slate-950/95 border-2 border-amber-400/80 rounded-2xl p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.85)] backdrop-blur-md flex items-center gap-3">
          {currentPlayer && (
            <div className="w-11 h-11 rounded-xl overflow-hidden border border-amber-400/80 bg-slate-900 shrink-0 shadow flex items-center justify-center">
              {(currentPlayer.image || CHARACTERS[currentPlayer.id]?.image) ? (
                <img 
                  src={currentPlayer.image || CHARACTERS[currentPlayer.id]?.image} 
                  alt={currentPlayer.name} 
                  className="w-full h-full object-cover object-top" 
                />
              ) : (
                <div className="text-xl">{currentPlayer.avatar?.split(' ')[0]}</div>
              )}
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
              {currentPlayer?.name || "Giocatore"}
            </span>
            <span className="text-xs font-bold text-white">
              {diceResult ? `Dado: ${diceResult}` : "Tira per muovere"}
            </span>
          </div>

          {!diceResult ? (
            <button
              onClick={handleRollClick}
              disabled={isMovingRef.current}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-black rounded-xl text-xs uppercase shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Dices size={16} />
              <span>LANCIA DADO</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black font-mono text-base flex items-center justify-center shadow">
                {diceResult}
              </span>
              <button
                onClick={() => onEndTurn && onEndTurn()}
                disabled={isMovingRef.current || (availableMoves && availableMoves.length > 0)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
                  isMovingRef.current || (availableMoves && availableMoves.length > 0)
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md cursor-pointer active:scale-95'
                }`}
              >
                <RefreshCw size={13} />
                <span>{availableMoves && availableMoves.length > 0 ? 'In Movimento...' : 'Passa'}</span>
              </button>
            </div>
          )}
        </div>

        {/* DETAIL CARD POPUP */}
        {inspectedNode && (
          <div className="absolute bottom-4 left-4 z-40 max-w-xs sm:max-w-sm bg-slate-950/95 border-2 border-amber-400/80 rounded-2xl p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">{inspectedNode.icon}</span>
                <h4 className="font-extrabold text-sm text-white tracking-wide">
                  {inspectedNode.name}
                </h4>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setInspectedNodeId(null); }}
                className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              {inspectedNode.desc}
            </p>
            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
              <span className="uppercase font-bold tracking-wider text-amber-400">
                Zona: {inspectedNode.region}
              </span>
              <span className="font-mono">Casella #{inspectedNode.id}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
