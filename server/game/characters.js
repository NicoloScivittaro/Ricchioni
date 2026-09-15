export const CHARACTERS = {
  nicolò: {
    id: "nicolò",
    name: "Nicolò",
    roleTitle: "GOBLIN MBRIACONE",
    subtitle: "Small Drinks, Big Troubles | Il Creatore del Gioco",
    avatar: "🧟‍♂️",
    image: "/characters/nicolo.jpg",
    color: "#10b981", // Emerald green
    quote: "Party first, quest later. Nel codice sorgente c'è scritto che non posso morire!",
    maxHp: 18,
    maxDignity: 15,
    initialCoins: 10,
    resourceName: "Tasso Alcolemico",
    resourceUnit: "%",
    resourceMax: 100,
    initialResource: 25,
    passive: {
      name: "Spaghetti Code",
      desc: "Conosce la struttura del gioco. Ogni volta che si muove, ha il 20% di probabilità di ignorare un malus di una casella."
    },
    skills: [
      {
        id: "dupe_glitch",
        name: "Dupe Glitch",
        cost: 15,
        desc: "Duplica un oggetto o soldi dalla memoria RAM del gioco."
      },
      {
        id: "no_clip",
        name: "No-Clip",
        cost: 20,
        desc: "Ignora blocchi stradali e ostacoli, teletrasportandosi direttamente oltre i buttafuori."
      },
      {
        id: "hotfix_live",
        name: "Hotfix Live",
        cost: 25,
        desc: "Riscrive il testo della casella attuale sostituendolo con un evento favorevole."
      }
    ],
    ultimate: {
      name: "Patch del Day One (Non Testata)",
      desc: "Applica per 1 giro 3 regole folli a tutto il tavolo."
    },
    weakness: {
      name: "Rollback Istintivo",
      desc: "Se ritira un dado e fa peggio, subisce una sbornia devastante e salta l'azione."
    }
  },

  christian: {
    id: "christian",
    name: "Christian",
    roleTitle: "IL BUTTAFUORI RIBALTATO",
    subtitle: "Tu Qua Non Entri! | Akatsuki della Sicurezza",
    avatar: "🥊",
    image: "/characters/christian.jpg",
    color: "#ef4444", // Red
    quote: "Tu qua non entri! Aspè... famme capì, mo se te ribalto vinco io? Perfetto!",
    maxHp: 24,
    maxDignity: 14,
    initialCoins: 8,
    resourceName: "Livello Comprensione",
    resourceUnit: "💡",
    resourceMax: 3,
    initialResource: 0,
    passive: {
      name: "Collo d'Acciaio & Stomaco di Ferro",
      desc: "Kebab e pizza curano il doppio (+8 HP). Immune a spinte e proiezioni forzate sul tabellone."
    },
    skills: [
      {
        id: "tu_qua_non_entri",
        name: "Tu Qua Non Entri",
        cost: 1,
        desc: "Sbarra la casella su cui si trova. Chi vuole passare deve pagare dazio o fare a cazzotti."
      },
      {
        id: "due_mani_e_basta",
        name: "Due Mani e Basta",
        cost: 0,
        desc: "Trascina un avversario in una scazzottata secca. Chi perde cede 4 monete."
      },
      {
        id: "guido_io_incidente",
        name: "Tranquilli, Guido Io",
        cost: 1,
        desc: "Carica gli amici in auto e sfreccia avanti di 2d6 caselle (rischio testacoda!)."
      }
    ],
    ultimate: {
      name: "Mo M'Impegno!",
      desc: "Entra in iper-focus per 1 turno: colpi critici massimi e immunità alle truffe."
    },
    weakness: {
      name: "Troppa Onestà",
      desc: "Non sa imbrogliare. Se gli offrono una pizza o una birra, non può rifiutare una tregua."
    }
  },

  victor: {
    id: "victor",
    name: "Victor",
    roleTitle: "IL DOTTORE SCEMO",
    subtitle: "Tranquilli, So Quello Che Faccio | 5ml di Idee Brillanti(?)",
    avatar: "🧪",
    image: "/characters/victor.jpg",
    color: "#06b6d4", // Cyan
    quote: "Tranquilli, so quello che faccio. Diagnosi: forse tutto bene, o forse ripensiamoci domani.",
    maxHp: 16,
    maxDignity: 12,
    initialCoins: 12,
    resourceName: "Provette Sperimentali",
    resourceUnit: "🧪",
    resourceMax: 5,
    initialResource: 3,
    passive: {
      name: "Placebo Micidiale",
      desc: "Ogni sua cura a un compagno applica un effetto casuale segreto (può essere miracoloso o un disastro)."
    },
    skills: [
      {
        id: "diagnosi_a_caso",
        name: "Diagnosi a Cazzo di Cane",
        cost: 1,
        desc: "Diagnostica una malattia fittizia a un giocatore penalizzandolo con regole assurde."
      },
      {
        id: "cocktail_virale",
        name: "Cocktail Virale",
        cost: 1,
        desc: "Lancia una provetta su una casella: chiunque ci passa contrae un ceppo contagioso."
      },
      {
        id: "rianimazione_telegram",
        name: "Rianimazione d'Emergenza",
        cost: 2,
        desc: "Salva un compagno a 0 HP a distanza, donandogli una mutazione genetica bizzarra."
      }
    ],
    ultimate: {
      name: "Paziente Zero",
      desc: "Quarantena generale: chi condivide la casella con un altro si scambia l'inventario o i soldi."
    },
    weakness: {
      name: "Laurea su Telegram",
      desc: "Nelle scelte logiche, Victor sceglie spesso l'opzione peggiore con convinzione cieca."
    }
  },

  judoka: {
    id: "judoka",
    name: "Il Judoka",
    roleTitle: "IL JUDOKA ROMPICOGLIONI",
    subtitle: "Granita, Judo e Lamentele | Qui Comando Io!",
    avatar: "🥋",
    image: "/characters/judoka.jpg",
    color: "#f59e0b", // Amber
    quote: "EH?! MA DAI! NON È COSÌ! In realtà secondo il comma 4 del regolamento di casa mia...",
    maxHp: 19,
    maxDignity: 16,
    initialCoins: 11,
    resourceName: "Livello Granita",
    resourceUnit: "%",
    resourceMax: 100,
    initialResource: 80,
    passive: {
      name: "NO, ASPETTA!",
      desc: "Finestra di reazione istantanea sul telefono: può premere 'NO, ASPETTA' per contestare consumando Granita."
    },
    skills: [
      {
        id: "seoi_nage",
        name: "Ippon Seoi Nage (Proiezione)",
        cost: 20,
        desc: "Afferra un avversario adiacente e lo scaglia indietro di 4 caselle!"
      },
      {
        id: "casa_mia",
        name: "Casa Mia, Regole Mie",
        cost: 25,
        desc: "Trasforma le caselle vicine nel suo salotto: chi entra deve levarsi le scarpe o pagare dazio."
      },
      {
        id: "pippone_infinito",
        name: "Pippone Accademico",
        cost: 15,
        desc: "Attacca un monologo accademico infinito addormentando un giocatore per 1 turno."
      }
    ],
    ultimate: {
      name: "Stasera Si Fa Come Dico Io",
      desc: "Prende il controllo del dado per 1 round: decide la direzione di tutti per decreto casalingo."
    },
    weakness: {
      name: "Crisi d'Astinenza da Granita",
      desc: "Se la Granita scende a zero, subisce 'Brain Freeze': non può contestare e rischia il lincaggio."
    }
  },

  ciro: {
    id: "ciro",
    name: "Ciro",
    roleTitle: "IL NAPOLETANO STEMPIATO",
    subtitle: "Non C'ho Spicci... Ma Ho Soluzioni! | Te Ne Do Meno",
    avatar: "👨‍🦲",
    image: "/characters/ciro.jpg",
    color: "#8b5cf6", // Purple
    quote: "Non c'ho spicci... ma ho soluzioni! Facciamo 50 e 50: 80 a me e 20 a te!",
    maxHp: 17,
    maxDignity: 11,
    initialCoins: 15,
    resourceName: "Capelli del Destino",
    resourceUnit: "💈",
    resourceMax: 2,
    initialResource: 2,
    passive: {
      name: "Braccino Corto Costituzionale",
      desc: "Quando deve pagare, ha il 50% di probabilità di pagare metà prezzo contrattando."
    },
    skills: [
      {
        id: "segna_sul_conto",
        name: "Non C'ho Spicci (Segna sul Conto)",
        cost: 0,
        desc: "Rimanda qualsiasi pagamento trasformandolo in debito tossico."
      },
      {
        id: "il_pacco",
        name: "Pacco, Contropaccotto & Truffa",
        cost: 2,
        desc: "Vende un oggetto coperto a un compagno spacciandolo per oro: dentro potrebbe esserci un mattone."
      },
      {
        id: "stornello_romano",
        name: "Romanità di Comodo",
        cost: 0,
        desc: "Usa il suo accento romano d'adozione per confondere vigili o buttafuori e dimezzare i pedaggi."
      }
    ],
    ultimate: {
      name: "Bancarotta Fraudolenta / Condono",
      desc: "Azzera tutti i debiti accumulati e scarica l'intero conto sulle tasche degli altri giocatori!"
    },
    weakness: {
      name: "I Due Capelli del Destino",
      desc: "Inizia con 2 soli capelli. Può sacrificarne uno per salvarsi da un disastro. Quando li perde entrambi, diventa ufficialmente pelato e perde Dignità eterna."
    }
  }
};
