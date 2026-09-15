import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { GameState } from "../server/game/gameState.js";
import { BOARD_NODES, REGIONS } from "../server/game/boardData.js";
import { CHARACTERS } from "../server/game/characters.js";
import { ITEMS } from "../server/game/itemsData.js";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Global Game Instance
const game = new GameState("ANZIO");

// API Endpoints for quick status checks or static data
app.get("/api/game-info", (req, res) => {
  res.json({
    status: "ok",
    roomId: game.roomId,
    boardNodes: BOARD_NODES,
    regions: REGIONS,
    characters: CHARACTERS,
    items: ITEMS
  });
});

io.on("connection", (socket) => {
  console.log(`[Socket] Connesso: ${socket.id}`);

  // Send initial state
  socket.emit("game_state", {
    state: game,
    boardNodes: BOARD_NODES,
    regions: REGIONS,
    characters: CHARACTERS,
    items: ITEMS
  });

  // Start game trigger with selected players
  socket.on("start_game", (payload) => {
    const selected = payload?.selectedPlayerIds;
    game.startGame(selected);
    broadcastState();
  });

  // Return to Lobby to change players
  socket.on("open_lobby", () => {
    game.phase = "LOBBY";
    broadcastState();
  });

  // Roll dice
  socket.on("roll_dice", ({ playerId }) => {
    const res = game.rollDice(playerId);
    broadcastState();
  });

  // Choose branch/node
  socket.on("choose_node", ({ playerId, targetNodeId }) => {
    const res = game.moveToNode(playerId, targetNodeId);
    broadcastState();
  });

  // Event choice
  socket.on("event_choice", ({ playerId, optionIndex }) => {
    game.resolveEventChoice(playerId, optionIndex);
    broadcastState();
  });

  // Combat move
  socket.on("combat_move", ({ playerId, move }) => {
    game.submitCombatMove(playerId, move);
    broadcastState();
  });

  // Asymmetric skill
  socket.on("use_skill", ({ playerId, skillId, targetId }) => {
    game.useSkill(playerId, skillId, targetId);
    broadcastState();
  });

  // Judoka interruption "NO, ASPETTA!"
  socket.on("judoka_interrupt", () => {
    game.triggerJudokaInterruption();
    broadcastState();
  });

  socket.on("dismiss_interrupt", () => {
    game.dismissInterruption();
    broadcastState();
  });

  // End turn
  socket.on("end_turn", () => {
    game.endTurn();
    broadcastState();
  });

  // Sound effect trigger broadcast
  socket.on("sound_trigger", ({ soundId, fromPlayerId }) => {
    io.emit("play_sound", { soundId, fromPlayerId });
  });

  // Reset/Restart Game
  socket.on("reset_game", () => {
    const newGame = new GameState("ANZIO");
    Object.assign(game, newGame);
    broadcastState();
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnesso: ${socket.id}`);
  });
});

function broadcastState() {
  io.emit("game_state_update", game);
}

export default app;
