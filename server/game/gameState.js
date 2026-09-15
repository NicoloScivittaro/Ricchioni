import { CHARACTERS } from "./characters.js";
import { BOARD_NODES } from "./boardData.js";
import { EVENT_CARDS } from "./eventsData.js";
import { ITEMS } from "./itemsData.js";

export class GameState {
  constructor(roomId = "ANZIO", selectedPlayerIds = ["nicolò", "christian", "victor", "judoka", "ciro"]) {
    this.roomId = roomId;
    this.phase = "LOBBY"; // LOBBY, PLAYING, EVENT, COMBAT, CLIMAX, GAME_OVER
    this.allCharacterIds = ["nicolò", "christian", "victor", "judoka", "ciro"];
    this.playerOrder = selectedPlayerIds.filter(id => this.allCharacterIds.includes(id));
    if (this.playerOrder.length < 2) {
      this.playerOrder = ["nicolò", "christian", "judoka"];
    }
    this.currentTurnIndex = 0;
    this.round = 1;
    this.diceResult = null;
    this.plannedPath = []; // Array of step-by-step node IDs for hopping animation
    this.availableMoves = []; // Destination choices
    this.activeEvent = null;
    this.activeCombat = null;
    this.activeInterruption = null; // e.g. "NO_ASPETTA"
    this.newsFeed = [
      "🔥 BENVENUTI ALLA NOTTE BRAVA PIÙ SPIETATA DI SEMPRE!",
      "Attenzione: ogni mossa può ribaltare la partita! Le caselle feudo sono letali.",
      "Seleziona i presenti al tavolo e preparati alle peggiori infamate tra Anzio e Nettuno."
    ];

    this.players = {};
    for (const charId of this.playerOrder) {
      const base = CHARACTERS[charId];
      this.players[charId] = {
        id: charId,
        name: base.name,
        roleTitle: base.roleTitle,
        avatar: base.avatar,
        image: base.image,
        color: base.color,
        quote: base.quote,
        hp: base.maxHp,
        maxHp: base.maxHp,
        dignity: base.maxDignity,
        maxDignity: base.maxDignity,
        coins: base.initialCoins,
        resourceName: base.resourceName,
        resourceValue: base.initialResource,
        resourceMax: base.resourceMax,
        resourceUnit: base.resourceUnit,
        position: 0,
        inventory: [charId === "ciro" ? "rolex_falso" : "kebab_completo"],
        connected: false,
        socketId: null,
        debts: charId === "ciro" ? 5 : 0,
        statusEffects: [],
        stats: { battlesWon: 0, timesHospitalized: 0, moneyStolen: 0, interruptions: 0 }
      };
    }
  }

  setLobbyPlayers(playerIds) {
    if (this.phase !== "LOBBY") return;
    const valid = playerIds.filter(id => this.allCharacterIds.includes(id));
    if (valid.length >= 2) {
      this.playerOrder = valid;
      this.players = {};
      for (const charId of this.playerOrder) {
        const base = CHARACTERS[charId];
        this.players[charId] = {
          id: charId,
          name: base.name,
          roleTitle: base.roleTitle,
          avatar: base.avatar,
          image: base.image,
          color: base.color,
          quote: base.quote,
          hp: base.maxHp,
          maxHp: base.maxHp,
          dignity: base.maxDignity,
          maxDignity: base.maxDignity,
          coins: base.initialCoins,
          resourceName: base.resourceName,
          resourceValue: base.initialResource,
          resourceMax: base.resourceMax,
          resourceUnit: base.resourceUnit,
          position: 0,
          inventory: [charId === "ciro" ? "rolex_falso" : "kebab_completo"],
          connected: false,
          socketId: null,
          debts: charId === "ciro" ? 5 : 0,
          statusEffects: [],
          stats: { battlesWon: 0, timesHospitalized: 0, moneyStolen: 0, interruptions: 0 }
        };
      }
      this.addNews(`👥 Formazione: ${this.playerOrder.map(id => CHARACTERS[id].name).join(", ")} (${this.playerOrder.length} giocatori)`);
    }
  }

  addNews(msg) {
    this.newsFeed.unshift(msg);
    if (this.newsFeed.length > 25) this.newsFeed.pop();
  }

  getCurrentPlayer() {
    const charId = this.playerOrder[this.currentTurnIndex];
    return this.players[charId];
  }

  startGame(selectedPlayerIds = null) {
    if (selectedPlayerIds && selectedPlayerIds.length >= 2) {
      this.setLobbyPlayers(selectedPlayerIds);
    }
    this.phase = "PLAYING";
    this.currentTurnIndex = 0;
    this.round = 1;
    const cp = this.getCurrentPlayer();
    this.addNews(`🚀 LA NOTTE HA INIZIO! Tocca a ${cp.name} (${cp.roleTitle}).`);
  }

  // ROLL DICE: DOES NOT AUTO-JUMP! Generates path and destinations for step-by-step hopping!
  rollDice(playerId) {
    const p = this.players[playerId];
    if (!p) return { error: "Giocatore non trovato" };
    if (this.phase !== "PLAYING") return { error: "Fase non valida per tirare" };
    if (p.id !== this.getCurrentPlayer().id) return { error: "Non è il tuo turno!" };

    let roll = Math.floor(Math.random() * 6) + 1;
    
    // Asymmetric bonuses
    if (p.id === "christian" && p.resourceValue > 0) {
      roll = Math.min(roll + 1, 6);
      this.addNews(`💡 Christian sfrutta il Focus (+1 al dado)!`);
    }
    if (p.id === "nicolò" && p.resourceValue > 70) {
      if (Math.random() < 0.3) {
        roll = 6;
        this.addNews(`🧟‍♂️ SBRONZA CRITICA: Nicolò trova un exploit e ottiene 6 automatico!`);
      }
    }

    this.diceResult = roll;

    // Calculate step-by-step path for the client animation (perimeter loop of 30 nodes)
    const totalNodes = BOARD_NODES.length; // 30
    const path = [];
    let curr = p.position;
    for (let i = 1; i <= roll; i++) {
      curr = (curr + 1) % totalNodes;
      path.push(curr);
      // If reached Casa di Carbo (id 21), stop there!
      if (curr === 21) break;
    }

    this.plannedPath = path;
    const finalDestination = path[path.length - 1];
    this.availableMoves = [finalDestination];

    this.addNews(`🎲 ${p.name} ha fatto ${roll}! Destinazione: ${BOARD_NODES[finalDestination].name}`);
    return { success: true, roll, path, availableMoves: this.availableMoves };
  }

  // MOVE TO NODE (Called after client finishes the step-by-step hopping animation!)
  moveToNode(playerId, targetNodeId) {
    const p = this.players[playerId];
    if (!p) return { error: "Giocatore non valido" };

    p.position = targetNodeId;
    this.availableMoves = [];
    this.plannedPath = [];
    const targetNode = BOARD_NODES.find(n => n.id === targetNodeId) || BOARD_NODES[targetNodeId];

    this.addNews(`📍 ${p.name} atterra su: ${targetNode.name}!`);

    // 1. ARRIVAL AT FINISH LINE (Casa di Carbo ARRIVO! id 21)
    if (targetNode.id === 21 || targetNode.type === "finish") {
      this.addNews(`👑 ${p.name} HA RAGGIUNTO CASA DI CARBO (ARRIVO)! Scatta la Notte delle Sentenze!`);
      this.phase = "CLIMAX";
      return { success: true, climax: true };
    }

    // 2. CHECK COLLISION WITH OTHER PLAYERS (SCAZZOTTATA IMMEDIATA!)
    const othersHere = Object.values(this.players).filter(other => other.id !== p.id && other.position === targetNode.id);
    if (othersHere.length > 0) {
      const victim = othersHere[0];
      this.addNews(`🚨 RISSA SPONTANEA: ${p.name} atterra sulla casella di ${victim.name}! Nessuna tregua al Borgo!`);
      this.startCombat(p.id, victim.id);
      return { success: true, combat: true };
    }

    // 3. RESOLVE HIGH-STAKES NODE EFFECT
    this.resolveNodeEffect(p, targetNode);
    return { success: true, node: targetNode };
  }

  resolveNodeEffect(player, node) {
    // 1. ULTRA-SWING FEUD CHECKS
    if (node.type === "feud_ciro" && player.id !== "ciro") {
      const tax = Math.min(player.coins, 4);
      player.coins -= tax;
      if (this.players.ciro) this.players.ciro.coins += tax;
      player.debts += 2;
      this.addNews(`💸 CASA DI CIRO: Ciro estorce ${tax} monete a ${player.name} e gli accolla 2 debiti tossici!`);
    } 
    else if (node.type === "feud_nicolo" && player.id !== "nicolò") {
      // 50% chance of swapping position with the leading player!
      if (Math.random() < 0.5) {
        const sorted = [...this.playerOrder].map(id => this.players[id]).sort((a, b) => b.position - a.position);
        const leader = sorted[0];
        if (leader.id !== player.id) {
          const tempPos = player.position;
          player.position = leader.position;
          leader.position = tempPos;
          this.addNews(`💥 GLITCH COSMICO: Nicolò ha invertito la posizione di ${player.name} con il capoclassifica ${leader.name}!`);
        }
      } else {
        player.hp = Math.max(1, player.hp - 3);
        this.addNews(`🍷 CASA DI MBRIACONE: Un server in fiamme esplode addosso a ${player.name} (-3 HP)!`);
      }
    } 
    else if (node.type === "feud_christian" && player.id !== "christian") {
      if (player.coins >= 3) {
        player.coins -= 3;
        if (this.players.christian) this.players.christian.coins += 3;
        this.addNews(`🥊 CASA DI CHRISTIAN: ${player.name} paga 3 monete di pizzo per non essere gonfiato di botte.`);
      } else {
        player.hp = Math.max(1, player.hp - 5);
        player.dignity = Math.max(0, player.dignity - 3);
        this.addNews(`🥊 CASA DI CHRISTIAN: Niente soldi? Christian abbatte ${player.name} con un gancio destro (-5 HP, -3 Dignità)!`);
      }
    } 
    else if (node.type === "feud_judoka" && player.id !== "judoka") {
      player.dignity = Math.max(0, player.dignity - 4);
      // Ippon throw backwards!
      player.position = Math.max(0, (player.position - 4 + 30) % 30);
      this.addNews(`🥋 SALOTTO DI ALEX: 'LEVA LE SCARPE!'. Il Judoka scaglia ${player.name} indietro di 4 caselle con un Ippon violento (-4 Dignità)!`);
    } 
    else if (node.type === "feud_victor" && player.id !== "victor") {
      if (Math.random() < 0.5) {
        player.hp = player.maxHp;
        this.addNews(`🧪 LABORATORIO DI VICTOR: Iniezione miracolosa! ${player.name} torna al 100% di salute!`);
      } else {
        player.hp = Math.max(1, Math.floor(player.hp / 2));
        player.dignity = Math.max(0, player.dignity - 3);
        this.addNews(`🧪 LABORATORIO DI VICTOR: Cocktail tossico radioattivo! La salute di ${player.name} viene DIMEZZATA!`);
      }
    }

    // 2. HAZARD & TRAPS
    if (node.type === "hazard" || node.type === "trap") {
      player.hp = Math.max(1, player.hp - 3);
      player.dignity = Math.max(0, player.dignity - 2);
      this.addNews(`⚠️ TRAPPOLA: ${player.name} finisce male su ${node.name} (-3 HP, -2 Dignità)!`);
    }

    // 3. RESTORATION & FOOD
    if (node.type === "rest" || node.type === "tavern") {
      player.hp = Math.min(player.maxHp, player.hp + 4);
      player.dignity = Math.min(player.maxDignity, player.dignity + 3);
      this.addNews(`🍕 ${node.name}: Sosta ristoratrice per ${player.name} (+4 HP, +3 Dignità).`);
    }

    // 4. POLICE RAID
    if (node.type === "police") {
      if (player.coins > 6) {
        const fine = Math.floor(player.coins / 2);
        player.coins -= fine;
        this.addNews(`🚓 POSTO DI BLOCCO: I Carabinieri perquisiscono ${player.name} e gli sequestrano ${fine} monete non dichiarate!`);
      } else {
        this.addNews(`🚓 POSTO DI BLOCCO: ${player.name} è troppo pezzente per essere multato: passa gratis!`);
      }
    }

    // 5. CHECK FATAL STATS (0 HP or 0 Dignity)
    this.checkPlayerVitals(player);

    // 6. EVENT CARD TRIGGER
    if (node.type === "event" || Math.random() < 0.55) {
      this.triggerRandomEvent(player);
    }
  }

  checkPlayerVitals(player) {
    if (player.hp <= 1) {
      player.hp = 10;
      player.position = 26; // Casa del Dottore / Ospedale
      player.coins = Math.max(0, player.coins - 4);
      player.stats.timesHospitalized++;
      this.addNews(`🚑 COMA ETILICO! ${player.name} sviene sull'asfalto e viene ricoverato d'urgenza da Victor (retrocesso a Casella 26)!`);
    }
    if (player.dignity <= 0) {
      player.dignity = 5;
      player.coins = Math.max(0, Math.floor(player.coins / 2));
      this.addNews(`🤡 GOGNA PUBBLICA AL BORGO! ${player.name} perde tutta la faccia: gli scippano metà dei soldi!`);
    }
  }

  triggerRandomEvent(player) {
    const randomIndex = Math.floor(Math.random() * EVENT_CARDS.length);
    const event = EVENT_CARDS[randomIndex];
    this.activeEvent = {
      ...event,
      targetPlayerId: player.id
    };
    this.phase = "EVENT";
    this.addNews(`⚡ EVENTO AD ALTA TENSIONE: "${event.title}" coinvolge ${player.name}!`);
  }

  resolveEventChoice(playerId, optionIndex) {
    if (!this.activeEvent) return { error: "Nessun evento attivo" };
    const p = this.players[playerId];
    const option = this.activeEvent.options[optionIndex];
    if (!option) return { error: "Opzione non valida" };

    this.addNews(`🗳️ ${p.name} sceglie: "${option.text}"`);

    if (option.action === "cliff_jump") {
      if (Math.random() > 0.4) {
        p.dignity = Math.min(p.maxDignity, p.dignity + 6);
        p.coins += 4;
        this.addNews(`🏊‍♂️ TUFFO LEGGENDARIO! ${p.name} salta tra gli applausi (+6 Dignità, +4 Monete)!`);
      } else {
        p.hp = Math.max(1, p.hp - 6);
        p.dignity = Math.max(0, p.dignity - 4);
        this.addNews(`🤕 SPANCIATA CLAMOROSA! ${p.name} si schianta sullo scoglio (-6 HP, -4 Dignità)!`);
      }
    } else if (option.action === "eat_fish") {
      if (Math.random() > 0.35) {
        p.hp = Math.min(p.maxHp, p.hp + 6);
        this.addNews(`🐟 Paranza sublime! ${p.name} recupera 6 HP.`);
      } else {
        p.hp = Math.max(1, p.hp - 7);
        this.addNews(`🤢 Paranza tossica! ${p.name} collassa in bagno (-7 HP)!`);
      }
    } else if (option.action === "bluff_check") {
      if (Math.random() > 0.5) {
        p.dignity = Math.min(p.maxDignity, p.dignity + 5);
        this.addNews(`🚓 Bluff riuscito! ${p.name} umilia le forze dell'ordine (+5 Dignità)!`);
      } else {
        p.coins = Math.max(0, p.coins - 5);
        p.debts += 3;
        this.addNews(`👮 Beccato! Multa di 5 monete e 3 debiti a carico di ${p.name}!`);
      }
    } else if (option.action === "fight_bouncer") {
      const defenderId = this.playerOrder.find(id => id !== "christian") || "ciro";
      this.startCombat(this.players.christian ? "christian" : p.id, defenderId);
      return;
    } else {
      this.addNews(`✨ Esito: ${option.effectText}`);
    }

    this.checkPlayerVitals(p);
    this.activeEvent = null;
    this.phase = "PLAYING";
  }

  startCombat(attackerId, defenderId) {
    this.phase = "COMBAT";
    this.activeCombat = {
      attackerId,
      defenderId,
      attackerMove: null,
      defenderMove: null,
      round: 1
    };
    const att = this.players[attackerId];
    const def = this.players[defenderId];
    this.addNews(`🥊 SCONTRO DIRETTO! ${att?.name || attackerId} e ${def?.name || defenderId} si affrontano a muso duro!`);
  }

  submitCombatMove(playerId, move) {
    if (!this.activeCombat) return { error: "Nessun combattimento attivo" };
    if (playerId === this.activeCombat.attackerId) {
      this.activeCombat.attackerMove = move;
    } else if (playerId === this.activeCombat.defenderId) {
      this.activeCombat.defenderMove = move;
    } else {
      return { error: "Non sei parte dello scontro!" };
    }

    if (this.activeCombat.attackerMove && this.activeCombat.defenderMove) {
      this.resolveCombatRound();
    }
  }

  resolveCombatRound() {
    const { attackerId, defenderId, attackerMove, defenderMove } = this.activeCombat;
    const att = this.players[attackerId];
    const def = this.players[defenderId];

    const beats = {
      punch: "trick",
      throw: "punch",
      trick: "throw"
    };

    let winner = null;
    let loser = null;

    if (attackerMove === defenderMove) {
      this.addNews(`💥 Doppia sberla in faccia! Sia ${att.name} che ${def.name} perdono 2 HP!`);
      att.hp = Math.max(1, att.hp - 2);
      def.hp = Math.max(1, def.hp - 2);
    } else if (beats[attackerMove] === defenderMove) {
      winner = att;
      loser = def;
    } else {
      winner = def;
      loser = att;
    }

    if (winner && loser) {
      const damage = winner.id === "christian" ? 6 : 4;
      loser.hp = Math.max(1, loser.hp - damage);
      loser.dignity = Math.max(0, loser.dignity - 3);
      winner.dignity = Math.min(winner.maxDignity, winner.dignity + 3);
      const stolen = Math.min(loser.coins, 4);
      loser.coins -= stolen;
      winner.coins += stolen;
      winner.stats.battlesWon++;
      // Knockback loser backwards by 2 nodes!
      loser.position = Math.max(0, (loser.position - 2 + 30) % 30);
      this.addNews(`🏆 ${winner.name} DISINTEGRA ${loser.name}! (-${damage} HP, rubate ${stolen} monete e spinto indietro di 2 caselle!)`);
    }

    this.checkPlayerVitals(att);
    this.checkPlayerVitals(def);
    this.activeCombat = null;
    this.phase = "PLAYING";
  }

  // JUDOKA "NO, ASPETTA!"
  triggerJudokaInterruption() {
    const judoka = this.players.judoka;
    if (!judoka) return { error: "Il Judoka non è in partita!" };
    if (judoka.resourceValue < 15) {
      return { error: "Granita insufficiente per contestare!" };
    }
    judoka.resourceValue -= 15;
    judoka.stats.interruptions++;
    this.activeInterruption = {
      by: "judoka",
      title: "NO, ASPETTA!",
      message: "Il Judoka blocca il tavolo: 'In realtà secondo il comma 4 del regolamento...'"
    };
    this.addNews(`🛑 CONTESTAZIONE UFFICIALE: Il Judoka ha premuto 'NO, ASPETTA'!`);
  }

  dismissInterruption() {
    this.activeInterruption = null;
    this.addNews("⚖️ Contestazione archiviata, si riprende a giocare!");
  }

  useSkill(playerId, skillId, targetId = null) {
    const p = this.players[playerId];
    const target = targetId ? this.players[targetId] : null;

    if (skillId === "dupe_glitch" && p.id === "nicolò") {
      p.resourceValue = Math.min(100, p.resourceValue + 20);
      p.coins += 5;
      this.addNews(`🧟‍♂️ GLITCH FINANZIARIO: Nicolò sdoppia 5 monete dalla memoria RAM! (Alcol: ${p.resourceValue}%)`);
      return { success: true };
    }

    if (skillId === "segna_sul_conto" && p.id === "ciro") {
      p.coins += 6;
      p.debts += 8;
      this.addNews(`👨‍🦲 TRUFFA DI CIRO: Incassa 6 monete e ne segna 8 di debito a nome del gruppo!`);
      return { success: true };
    }

    if (skillId === "due_mani_e_basta" && p.id === "christian") {
      const oppId = targetId || this.playerOrder.find(id => id !== "christian") || "judoka";
      this.startCombat(p.id, oppId);
      return { success: true };
    }

    if (skillId === "diagnosi_a_caso" && p.id === "victor") {
      const opp = target || this.players[this.playerOrder.find(id => id !== "victor")];
      if (opp) {
        opp.dignity = Math.max(0, opp.dignity - 4);
        opp.hp = Math.max(1, opp.hp - 2);
        this.addNews(`💉 DIAGNOSI DI VICTOR: Diagnosi infame a ${opp.name}: 'Incurabile idiozia notturna' (-4 Dignità, -2 HP)!`);
      }
      return { success: true };
    }

    if (skillId === "seoi_nage" && p.id === "judoka") {
      const opp = target || this.players[this.playerOrder.find(id => id !== "judoka")];
      if (opp) {
        opp.position = Math.max(0, (opp.position - 4 + 30) % 30);
        this.addNews(`🥋 PROIEZIONE DEL JUDOKA: ${opp.name} viene lanciato indietro di 4 caselle!`);
      }
      return { success: true };
    }

    return { error: "Abilità non riconosciuta" };
  }

  endTurn() {
    this.diceResult = null;
    this.availableMoves = [];
    this.plannedPath = [];
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerOrder.length;
    if (this.currentTurnIndex === 0) {
      this.round++;
      this.addNews(`🌙 ROUND ${this.round}! La notte ad Anzio-Nettuno diventa sempre più selvaggia.`);
    }
    const nextPlayer = this.getCurrentPlayer();
    this.addNews(`👉 Tocca a ${nextPlayer.name} (${nextPlayer.roleTitle})`);
  }
}
