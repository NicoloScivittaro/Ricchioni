import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Header from './components/common/Header.jsx';
import GameBoard from './components/board/GameBoard.jsx';
import PlayerPhoneView from './components/controller/PlayerPhoneView.jsx';
import EventModal from './components/modals/EventModal.jsx';
import CombatModal from './components/modals/CombatModal.jsx';
import ClimaxModal from './components/modals/ClimaxModal.jsx';
import LobbyModal from './components/lobby/LobbyModal.jsx';
import { BOARD_NODES } from '../server/game/boardData.js';
import { CHARACTERS } from '../server/game/characters.js';
import { GameState } from '../server/game/gameState.js';
import { sfx } from './utils/audio.js';
import { AlertTriangle, Newspaper, Flame, Users, Dices, RefreshCw } from 'lucide-react';

let socket = null;

export default function App() {
  const [localGame, setLocalGame] = useState(() => new GameState("ANZIO"));
  const [gameState, setGameState] = useState(localGame);
  const [viewMode, setViewMode] = useState('tv'); // default to 'tv' full-screen for maximum immersion!
  const [selectedPlayerId, setSelectedPlayerId] = useState('nicolò');
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    try {
      socket = io("http://localhost:3001", {
        transports: ["websocket", "polling"],
        timeout: 2000
      });

      socket.on("connect", () => {
        setIsConnected(true);
        console.log("Connesso al server della Notte Brava!");
      });

      socket.on("game_state", (data) => {
        if (data && data.state) {
          setGameState(data.state);
        }
      });

      socket.on("game_state_update", (updated) => {
        if (updated) {
          setGameState({ ...updated });
        }
      });

      socket.on("play_sound", ({ soundId }) => {
        if (soundId === 'urlo') sfx.playBuzzer();
        if (soundId === 'sberla') sfx.playPunch();
        if (soundId === 'monete') sfx.playCoin();
        if (soundId === 'glitch') sfx.playGlitch();
      });

      socket.on("disconnect", () => {
        setIsConnected(false);
      });
    } catch (e) {
      console.warn("Server offline, uso motore locale integrato:", e);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Update selected player to match current turn automatically
  useEffect(() => {
    if (gameState.playerOrder && gameState.playerOrder.length > 0) {
      const current = gameState.playerOrder[gameState.currentTurnIndex];
      if (current) {
        setSelectedPlayerId(current);
      }
    }
  }, [gameState.currentTurnIndex, gameState.playerOrder]);

  const dispatchAction = (actionName, payload = {}) => {
    if (socket && isConnected) {
      socket.emit(actionName, payload);
    } else {
      // Local execution fallback
      const clone = Object.assign(Object.create(Object.getPrototypeOf(gameState)), gameState);
      if (actionName === "start_game") clone.startGame(payload.selectedPlayerIds);
      if (actionName === "open_lobby") clone.phase = "LOBBY";
      if (actionName === "roll_dice") clone.rollDice(payload.playerId);
      if (actionName === "choose_node") clone.moveToNode(payload.playerId, payload.targetNodeId);
      if (actionName === "event_choice") clone.resolveEventChoice(payload.playerId, payload.optionIndex);
      if (actionName === "combat_move") clone.submitCombatMove(payload.playerId, payload.move);
      if (actionName === "use_skill") clone.useSkill(payload.playerId, payload.skillId, payload.targetId);
      if (actionName === "judoka_interrupt") clone.triggerJudokaInterruption();
      if (actionName === "dismiss_interrupt") clone.dismissInterruption();
      if (actionName === "end_turn") clone.endTurn();
      if (actionName === "reset_game") {
        const fresh = new GameState("ANZIO");
        setGameState(fresh);
        return;
      }
      setGameState({ ...clone });
    }
  };

  const currentPlayer = gameState.getCurrentPlayer ? gameState.getCurrentPlayer() : gameState.players[gameState.playerOrder[gameState.currentTurnIndex]];
  const activeControllerPlayer = gameState.players[selectedPlayerId] || currentPlayer;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Header */}
      <Header
        viewMode={viewMode}
        setViewMode={setViewMode}
        round={gameState.round}
        playerCount={gameState.playerOrder?.length}
        currentPlayer={currentPlayer}
        onResetGame={() => dispatchAction("reset_game")}
        onOpenLobby={() => dispatchAction("open_lobby")}
      />

      {/* JUDOKA'S "NO, ASPETTA!" INTERRUPTION BANNER */}
      {gameState.activeInterruption && (
        <div className="bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white p-3 border-b-2 border-amber-300 shadow-xl flex items-center justify-between px-6 animate-pulse z-40">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥋🛑</span>
            <div>
              <strong className="font-arcade text-sm">NO, ASPETTA!</strong>
              <p className="text-xs text-amber-100">{gameState.activeInterruption.message}</p>
            </div>
          </div>
          <button
            onClick={() => dispatchAction("dismiss_interrupt")}
            className="px-3 py-1 bg-slate-950 text-amber-300 border border-amber-400 font-bold rounded-lg text-xs hover:bg-slate-900 active:scale-95 transition-all"
          >
            Archivia Contestazione
          </button>
        </div>
      )}

      {/* TICKER GOSSIP */}
      <div className="bg-slate-900/70 border-b border-slate-800/80 px-4 py-1.5 flex items-center gap-3 overflow-hidden text-xs">
        <span className="flex items-center gap-1 text-amber-400 font-bold uppercase tracking-wider shrink-0">
          <Newspaper size={13} /> Gossip Anzio-Nettuno:
        </span>
        <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-none text-slate-300">
          {gameState.newsFeed[0] || "In attesa delle prime bravate della notte..."}
        </div>
      </div>

      {/* MAIN VIEW CONTAINER: MAX WIDTH FULL-SCREEN (Takes entire viewport) */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto p-2 sm:p-4 flex flex-col gap-4">
        {/* CHARACTER SWITCHER (Quick Tabs when playing in Hotseat or Phone mode) */}
        {viewMode !== 'tv' && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 px-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Users size={14} /> Controller:
            </span>
            {gameState.playerOrder.map(charId => {
              const p = gameState.players[charId];
              if (!p) return null;
              const isSelected = p.id === selectedPlayerId;
              const isCurrentTurn = p.id === currentPlayer?.id;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayerId(p.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                    isSelected
                      ? 'bg-slate-800 border-amber-400 text-white shadow-lg ring-1 ring-amber-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {(p.image || CHARACTERS[p.id]?.image) ? (
                    <img src={p.image || CHARACTERS[p.id]?.image} alt={p.name} className="w-6 h-6 rounded-full object-cover object-top border border-amber-400/60 shadow" />
                  ) : (
                    <span>{p.avatar.split(' ')[0]}</span>
                  )}
                  <span>{p.name}</span>
                  {isCurrentTurn && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Turno Attivo"></span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 1. TV FULL-SCREEN MODE (Map spans the whole screen, players status bar on bottom with in-screen dice button) */}
        {viewMode === 'tv' && (
          <div className="flex flex-col gap-4 w-full">
            {/* THE FULLSCREEN BOARD */}
            <GameBoard
              nodes={BOARD_NODES}
              players={gameState.players}
              currentPlayerId={currentPlayer?.id}
              availableMoves={gameState.availableMoves || []}
              diceResult={gameState.diceResult}
              plannedPath={gameState.plannedPath || []}
              onRollDice={(playerId) => dispatchAction("roll_dice", { playerId })}
              onEndTurn={() => dispatchAction("end_turn")}
              onSelectNode={(nodeId) => dispatchAction("choose_node", { playerId: currentPlayer.id, targetNodeId: nodeId })}
            />

            {/* In-Screen Turn Action Bar for TV & Living Room */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-amber-400 bg-slate-950 shadow-lg shadow-amber-500/20 shrink-0 flex items-center justify-center">
                  {(currentPlayer?.image || CHARACTERS[currentPlayer?.id]?.image) ? (
                    <img src={currentPlayer?.image || CHARACTERS[currentPlayer?.id]?.image} alt={currentPlayer?.name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="text-3xl">{currentPlayer?.avatar?.split(' ')[0]}</div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-black uppercase text-amber-400 tracking-wider">Turno in corso</div>
                  <div className="text-base font-black text-white">{currentPlayer?.name} ({currentPlayer?.roleTitle})</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!gameState.diceResult ? (
                  <button
                    onClick={() => {
                      sfx.playDice();
                      dispatchAction("roll_dice", { playerId: currentPlayer.id });
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-black rounded-xl text-sm uppercase shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Dices size={18} />
                    <span>LANCIA IL DADO</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-full">
                      DADO: {gameState.diceResult}
                    </span>
                    <button
                      onClick={() => dispatchAction("end_turn")}
                      disabled={gameState.availableMoves && gameState.availableMoves.length > 0}
                      className={`px-5 py-2.5 font-black rounded-xl text-sm uppercase transition-all flex items-center gap-2 ${
                        gameState.availableMoves && gameState.availableMoves.length > 0
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg cursor-pointer active:scale-95'
                      }`}
                    >
                      <RefreshCw size={16} />
                      <span>{gameState.availableMoves && gameState.availableMoves.length > 0 ? 'SCEGLI IL NODO SULLA MAPPA' : 'PASSA IL TURNO'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 3 to 5 Active Players Status Bar */}
            <div className={`grid gap-3 ${
              gameState.playerOrder.length === 3 ? 'grid-cols-3' :
              gameState.playerOrder.length === 4 ? 'grid-cols-2 md:grid-cols-4' :
              'grid-cols-2 md:grid-cols-5'
            }`}>
              {gameState.playerOrder.map(charId => {
                const p = gameState.players[charId];
                if (!p) return null;
                const isCurrent = p.id === currentPlayer?.id;

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/50 shadow-xl'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shrink-0 flex items-center justify-center">
                        {(p.image || CHARACTERS[p.id]?.image) ? (
                          <img src={p.image || CHARACTERS[p.id]?.image} alt={p.name} className="w-full h-full object-cover object-top" />
                        ) : (
                          <span className="text-xl">{p.avatar}</span>
                        )}
                      </div>
                      <div className="flex-1 truncate">
                        <div className="font-extrabold text-sm text-white truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{p.roleTitle}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-2 pt-2 border-t border-slate-800">
                      <span className="text-rose-400 font-mono font-bold">{p.hp} HP</span>
                      <span className="text-sky-400 font-mono font-bold">{p.dignity} D</span>
                      <span className="text-amber-400 font-mono font-bold">{p.coins}€</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. HOTSEAT MODE (Full Map on top + Active Controller Console below) */}
        {viewMode === 'hotseat' && (
          <div className="flex flex-col gap-6 w-full">
            {/* The Fullscreen Board */}
            <GameBoard
              nodes={BOARD_NODES}
              players={gameState.players}
              currentPlayerId={currentPlayer?.id}
              availableMoves={gameState.availableMoves || []}
              diceResult={gameState.diceResult}
              plannedPath={gameState.plannedPath || []}
              onRollDice={(playerId) => dispatchAction("roll_dice", { playerId })}
              onEndTurn={() => dispatchAction("end_turn")}
              onSelectNode={(nodeId) => dispatchAction("choose_node", { playerId: currentPlayer.id, targetNodeId: nodeId })}
            />

            {/* Active Controller Console below map */}
            <div className="max-w-2xl mx-auto w-full">
              <PlayerPhoneView
                player={activeControllerPlayer}
                isCurrentTurn={activeControllerPlayer.id === currentPlayer?.id}
                diceResult={gameState.diceResult}
                hasAvailableMoves={gameState.availableMoves && gameState.availableMoves.length > 0}
                onRollDice={(playerId) => dispatchAction("roll_dice", { playerId })}
                onEndTurn={() => dispatchAction("end_turn")}
                onUseSkill={(playerId, skillId, targetId) => dispatchAction("use_skill", { playerId, skillId, targetId })}
                onJudokaInterrupt={() => dispatchAction("judoka_interrupt")}
                onPlaySound={(soundId) => {
                  if (socket && isConnected) socket.emit("sound_trigger", { soundId, fromPlayerId: activeControllerPlayer.id });
                }}
              />
            </div>
          </div>
        )}

        {/* 3. PHONE ONLY MODE (Clean mobile screen) */}
        {viewMode === 'phone' && (
          <div className="max-w-md mx-auto w-full">
            <PlayerPhoneView
              player={activeControllerPlayer}
              isCurrentTurn={activeControllerPlayer.id === currentPlayer?.id}
              diceResult={gameState.diceResult}
              hasAvailableMoves={gameState.availableMoves && gameState.availableMoves.length > 0}
              onRollDice={(playerId) => dispatchAction("roll_dice", { playerId })}
              onEndTurn={() => dispatchAction("end_turn")}
              onUseSkill={(playerId, skillId, targetId) => dispatchAction("use_skill", { playerId, skillId, targetId })}
              onJudokaInterrupt={() => dispatchAction("judoka_interrupt")}
              onPlaySound={(soundId) => {
                if (socket && isConnected) socket.emit("sound_trigger", { soundId, fromPlayerId: activeControllerPlayer.id });
              }}
            />
          </div>
        )}
      </main>

      {/* LOBBY MODAL: WHEN IN LOBBY PHASE (Select 3, 4 or 5 friends) */}
      {gameState.phase === 'LOBBY' && (
        <LobbyModal
          currentSelected={gameState.playerOrder}
          onStartGame={(selectedPlayerIds) => dispatchAction("start_game", { selectedPlayerIds })}
        />
      )}

      {/* EVENT POPUP */}
      {gameState.activeEvent && (
        <EventModal
          event={gameState.activeEvent}
          players={gameState.players}
          onChooseOption={(playerId, optionIndex) => dispatchAction("event_choice", { playerId, optionIndex })}
        />
      )}

      {/* COMBAT ARENA POPUP */}
      {gameState.activeCombat && (
        <CombatModal
          combat={gameState.activeCombat}
          players={gameState.players}
          onSelectMove={(playerId, move) => dispatchAction("combat_move", { playerId, move })}
        />
      )}

      {/* CLIMAX ENDGAME POPUP */}
      {gameState.phase === 'CLIMAX' && (
        <ClimaxModal
          players={gameState.players}
          onRestart={() => dispatchAction("reset_game")}
        />
      )}
    </div>
  );
}
