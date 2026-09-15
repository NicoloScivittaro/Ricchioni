export const REGIONS = {
  ANZIO: { 
    id: "anzio", 
    name: "ANZIO", 
    subtitle: "Porto Innocenziano, Riviera Zanardelli & Piazza Pia",
    color: "#0284c7" 
  },
  COLLINE: { 
    id: "colline", 
    name: "LE COLLINE & I LOCALI", 
    subtitle: "Pizzeria Gusto, Kebabbaro, Lidl & Case degli Amici",
    color: "#eab308" 
  },
  NETTUNO: { 
    id: "nettuno", 
    name: "NETTUNO", 
    subtitle: "Il Fortino, Borgo, Fontane & Casa di Carbo ARRIVO!",
    color: "#a855f7" 
  }
};

// 30 Interactive Tiles tracing the exact perimeter of the board shown in the artwork
export const BOARD_NODES = [
  // ================= LATO SINISTRO (Dal Basso verso l'Alto) =================
  {
    id: 0,
    name: "Porto di Anzio",
    icon: "⚓",
    color: "#0284c7",
    region: "anzio",
    type: "start",
    desc: "Partenza storica tra i pescherecci e l'aria di mare!",
    xPct: 8.5, yPct: 68.0,
    next: [1]
  },
  {
    id: 1,
    name: "Spiaggia di Anzio",
    icon: "🏖️",
    color: "#38bdf8",
    region: "anzio",
    type: "event",
    desc: "Ombrelloni e onde. Tuffo con evento a sorpresa!",
    xPct: 10.5, yPct: 58.5,
    next: [2]
  },
  {
    id: 2,
    name: "Lungomare",
    icon: "🌴",
    color: "#0ea5e9",
    region: "anzio",
    type: "speed",
    desc: "Passeggiata veloce con vista sul porto.",
    xPct: 13.5, yPct: 49.5,
    next: [3]
  },
  {
    id: 3,
    name: "Gelateria",
    icon: "🍦",
    color: "#ec4899",
    region: "anzio",
    type: "tavern",
    desc: "Gelato gigante con panna: ricarica 3 di Dignità!",
    xPct: 17.5, yPct: 41.5,
    next: [4]
  },
  {
    id: 4,
    name: "Piazza del Mercato",
    icon: "🏪",
    color: "#eab308",
    region: "anzio",
    type: "shop",
    desc: "Bancarelle e mercanzie a buon mercato.",
    xPct: 19.5, yPct: 32.0,
    next: [5]
  },
  {
    id: 5,
    name: "Stazione",
    icon: "🚆",
    color: "#0284c7",
    region: "anzio",
    type: "event",
    desc: "Treno da Termini in ritardo di 80 minuti. Pendolari furiosi!",
    xPct: 23.5, yPct: 22.5,
    next: [6]
  },

  // ================= LATO SUPERIORE (Da Sinistra verso Destra) =================
  {
    id: 6,
    name: "Parco da Cip",
    icon: "🌳",
    color: "#16a34a",
    region: "colline",
    type: "rest",
    desc: "Ombra tra i pini. Recupera 2 HP al fresco.",
    xPct: 29.0, yPct: 13.5,
    next: [7]
  },
  {
    id: 7,
    name: "San Giacomo",
    icon: "⛪",
    color: "#65a30d",
    region: "colline",
    type: "sanctuary",
    desc: "Campane a festa. Penitenza o benedizione (+3 Dignità).",
    xPct: 34.5, yPct: 14.0,
    next: [8]
  },
  {
    id: 8,
    name: "Casa di Alex",
    icon: "🥋",
    color: "#0d9488",
    region: "colline",
    type: "feud_judoka",
    desc: "Salotto del Judoka! 'Levateve 'ste scarpe!' o pagate pedaggio.",
    xPct: 41.0, yPct: 13.5,
    next: [9]
  },
  {
    id: 9,
    name: "Casa di Mbriacone",
    icon: "🍺",
    color: "#eab308",
    region: "colline",
    type: "feud_nicolo",
    desc: "FEUDO DI NICOLÒ! Pieno di birre e server hackerati. Glitch garantito!",
    xPct: 47.5, yPct: 10.0,
    next: [10]
  },
  {
    id: 10,
    name: "Pizzeria Gusto",
    icon: "🍕",
    color: "#ef4444",
    region: "colline",
    type: "rest",
    desc: "Pizza calda fumante. Christian recupera 8 HP!",
    xPct: 53.5, yPct: 10.5,
    next: [11]
  },
  {
    id: 11,
    name: "Kebabbaro",
    icon: "🥙",
    color: "#f97316",
    region: "colline",
    type: "shop",
    desc: "Spiedo gigante alle 3 di notte: compra Kebab Completo.",
    xPct: 60.0, yPct: 13.0,
    next: [12]
  },
  {
    id: 12,
    name: "Lidl",
    icon: "🛒",
    color: "#0284c7",
    region: "colline",
    type: "shop",
    desc: "Offerte folli nel cestone centrale. Ciro tenta lo scippo!",
    xPct: 66.5, yPct: 14.5,
    next: [13]
  },
  {
    id: 13,
    name: "Carrefour",
    icon: "🛍️",
    color: "#2563eb",
    region: "colline",
    type: "shop",
    desc: "Aperto H24. Compra energy drink e cibarie per il viaggio.",
    xPct: 73.0, yPct: 14.5,
    next: [14]
  },
  {
    id: 14,
    name: "Casa di Ciro",
    icon: "🏡",
    color: "#84cc16",
    region: "colline",
    type: "feud_ciro",
    desc: "FEUDO DI CIRO! Pacchi, contratti e riscossione crediti.",
    xPct: 82.0, yPct: 16.0,
    next: [15]
  },

  // ================= LATO DESTRO (Dall'Alto verso il Basso) =================
  {
    id: 15,
    name: "Via Gramsci",
    icon: "🏮",
    color: "#ca8a04",
    region: "nettuno",
    type: "police",
    desc: "Posto di blocco sotto i lampioni storici.",
    xPct: 86.5, yPct: 24.5,
    next: [16]
  },
  {
    id: 16,
    name: "Piazza dei Leoni",
    icon: "🦁",
    color: "#d97706",
    region: "nettuno",
    type: "combat_arena",
    desc: "Statua maestosa e arena di duelli. Sfida gli amici!",
    xPct: 87.5, yPct: 32.5,
    next: [17]
  },
  {
    id: 17,
    name: "Villa Sarsina",
    icon: "🏛️",
    color: "#06b6d4",
    region: "nettuno",
    type: "hazard",
    desc: "Gradini scivolosi e antiche rovine romane.",
    xPct: 92.5, yPct: 40.0,
    next: [18]
  },
  {
    id: 18,
    name: "Spiaggia di Nettuno",
    icon: "🏖️",
    color: "#38bdf8",
    region: "nettuno",
    type: "event",
    desc: "Festa sulla sabbia con falò e cocktail di contrabbando.",
    xPct: 92.0, yPct: 50.0,
    next: [19]
  },
  {
    id: 19,
    name: "Il Fortino",
    icon: "🏰",
    color: "#78716c",
    region: "nettuno",
    type: "challenge",
    desc: "I bastioni di Forte Sangallo: baluardo difensivo.",
    xPct: 91.5, yPct: 60.0,
    next: [20]
  },
  {
    id: 20,
    name: "Bar del Porto",
    icon: "🍸",
    color: "#0891b2",
    region: "nettuno",
    type: "tavern",
    desc: "Spritz ghiacciato con vista sui motoscafi.",
    xPct: 91.0, yPct: 70.0,
    next: [21]
  },

  // ================= IL GRAND FINISH (Angolo Inferiore Destro) =================
  {
    id: 21,
    name: "Casa di Carbo ARRIVO!",
    icon: "🏁",
    color: "#f59e0b",
    region: "nettuno",
    type: "finish",
    desc: "IL TRAGUARDO DELLA NOTTE! Chi arriva qui conquista la gloria e fa scattare il Climax!",
    xPct: 88.0, yPct: 84.0,
    next: [22]
  },

  // ================= LATO INFERIORE (Da Destra verso Sinistra) =================
  {
    id: 22,
    name: "Lido dei Marinari",
    icon: "⛱️",
    color: "#0ea5e9",
    region: "nettuno",
    type: "event",
    desc: "Musica estiva a palla e bagnini stanchi.",
    xPct: 73.5, yPct: 88.5,
    next: [23]
  },
  {
    id: 23,
    name: "Fontana del Nettuno",
    icon: "🔱",
    color: "#ca8a04",
    region: "nettuno",
    type: "sanctuary",
    desc: "Il Tridente sacro: tira per ottenere un bonus speciale.",
    xPct: 63.5, yPct: 86.5,
    next: [24]
  },
  {
    id: 24,
    name: "Riviera Zanardelli",
    icon: "🌴",
    color: "#0d9488",
    region: "anzio",
    type: "speed",
    desc: "Rettilineo del litorale: corri veloce!",
    xPct: 54.0, yPct: 85.0,
    next: [25]
  },
  {
    id: 25,
    name: "Porto di Nettuno",
    icon: "⚓",
    color: "#2563eb",
    region: "nettuno",
    type: "shop",
    desc: "Yacht e compravendite clandestine.",
    xPct: 44.5, yPct: 83.5,
    next: [26]
  },
  {
    id: 26,
    name: "Casa del Dottore",
    icon: "🏥",
    color: "#059669",
    region: "anzio",
    type: "feud_victor",
    desc: "FEUDO DI VICTOR! Laboratorio provette e diagnosi folli.",
    xPct: 35.5, yPct: 82.0,
    next: [27]
  },
  {
    id: 27,
    name: "Piazza Mazzini",
    icon: "🏮",
    color: "#d97706",
    region: "anzio",
    type: "event",
    desc: "Passeggiata centrale e gossip di quartiere.",
    xPct: 27.5, yPct: 81.0,
    next: [28]
  },
  {
    id: 28,
    name: "Casa di Christian",
    icon: "🏠",
    color: "#e11d48",
    region: "anzio",
    type: "feud_christian",
    desc: "FEUDO DI CHRISTIAN! Il Buttafuori al volante e pizza gratis.",
    xPct: 19.5, yPct: 79.5,
    next: [29]
  },
  {
    id: 29,
    name: "Bar del Porto",
    icon: "☕",
    color: "#b45309",
    region: "anzio",
    type: "rest",
    desc: "Caffè corretto e cornetto alle 5 di mattina prima del giro successivo!",
    xPct: 12.5, yPct: 76.5,
    next: [0]
  }
];
