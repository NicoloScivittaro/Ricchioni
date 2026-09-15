export const EVENT_CARDS = [
  {
    id: "posto_di_blocco",
    title: "Posto di Blocco ai Marinaretti",
    category: "police",
    flavor: "Due gazzelle dei Carabinieri sulla curva della Litoranea. Il maresciallo ti fissa con aria dubbiosa.",
    prompt: "Come provi a superare il controllo?",
    options: [
      {
        text: "Mostra la patente con sicurezza (Test Bluff)",
        effectText: "50% successo (+3 Dignità), 50% fallimento: multa di 4 monete!",
        action: "bluff_check"
      },
      {
        text: "Chiama Christian per farti raccomandare",
        effectText: "Se Christian accetta, passi gratis. Altrimenti ti sequestrano il veicolo!",
        action: "call_christian"
      },
      {
        text: "Ciro prova a spiegare che 'siamo tutti parenti'",
        effectText: "Corruzione con 2 monete. Funziona sempre, ma perdi 2 di Dignità.",
        action: "ciro_bribe"
      }
    ]
  },
  {
    id: "treno_soppresso",
    title: "Treno Regionale Soppresso a Padiglione",
    category: "disaster",
    flavor: "L'ultimo treno da Roma Termini si arresta in mezzo alle canne di Padiglione. Annuncio: 'Guasto tecnico per cause imprecisate'.",
    prompt: "Sei bloccato sui binari al buio. Che fai?",
    options: [
      {
        text: "Incatenati sui binari per protesta (Stile Judoka)",
        effectText: "Guadagni 4 Dignità da martire civile, ma salti il prossimo turno di movimento.",
        action: "protest"
      },
      {
        text: "Offri 3 monete a chiunque venga a prenderti in macchina",
        effectText: "Chi accetta tra i compagni incassa 3 monete e ti carica a bordo!",
        action: "uber_friends"
      },
      {
        text: "Nicolò dichiara che la ferrovia è un bug di simulazione",
        effectText: "Tira un dado: con 4-6 ti teletrasporti direttamente a Nettuno!",
        action: "hack_train"
      }
    ]
  },
  {
    id: "rissa_al_borgo",
    title: "Rissa nei Vicoli del Borgo di Nettuno",
    category: "combat",
    flavor: "Ore 02:40, Piazza San Giovanni. Uno sconosciuto con una Peroni da 66cl urla: 'Che cazzo me fissi?'",
    prompt: "La situazione sta per degenerare all'istante.",
    options: [
      {
        text: "Chiama Christian: 'Sfondagli la faccia!'",
        effectText: "Parte una scazzottata immediata. Se Christian vince, intasca il portafoglio dell'avversario (+5 monete)!",
        action: "fight_bouncer"
      },
      {
        text: "Il Judoka interviene: 'Tecnicamente il codice penale...'",
        effectText: "Il Judoka intavola un monologo di 10 minuti. Tutti al tavolo si addormentano.",
        action: "judoka_lecture"
      },
      {
        text: "Scappa via come un coniglio",
        effectText: "Perdi 4 Dignità per vigliaccheria conclamata, ma salvi tutti i tuoi HP!",
        action: "flee_coward"
      }
    ]
  },
  {
    id: "granita_finita",
    title: "Chiosco di Nettuno: Granita Terminata!",
    category: "crisis",
    flavor: "Il garzone del chiosco abbassa la saracinesca: 'Ao, è finita la granita al limone, c'ho solo tè caldo'.",
    prompt: "Crisi nera per il Judoka e per l'equilibrio del gruppo.",
    options: [
      {
        text: "Il Judoka va in fiamme (-50% Granita, +3 Rottura di Coglioni)",
        effectText: "Tutti i giocatori entro 2 caselle dal Judoka subiscono 2 danni alle orecchie.",
        action: "judoka_rage"
      },
      {
        text: "Victor propone: 'Ho una granita chimica fatta in cantina'",
        effectText: "Bevi il becher di Victor: o ti cura 6 HP o ti fa spuntare una pinna.",
        action: "victor_substitute"
      }
    ]
  },
  {
    id: "paranza_ciro",
    title: "La Paranza Clandestina di Ciro",
    category: "gamble",
    flavor: "Ciro compare con un vassoio d'alluminio pieno di frittura appena tirata su al porto di Anzio.",
    prompt: "Ciro offre la porzione a 1 moneta. Te la rischi?",
    options: [
      {
        text: "Mangiati tutto con limone abbondante",
        effectText: "Cura 4 HP, ma c'è il 33% di probabilità di finire al pronto soccorso di Victor per dissenteria fulminante!",
        action: "eat_fish"
      },
      {
        text: "Rifiuta sdegnato: 'Questo pesce brilla al buio!'",
        effectText: "Ciro si offende mortalmente: ti segna 2 monete di debito per mancato rispetto.",
        action: "refuse_fish"
      }
    ]
  },
  {
    id: "tuffo_grotte_nerone",
    title: "Tuffo Notturno alle Grotte di Nerone",
    category: "stunt",
    flavor: "La luna illumina i resti della villa imperiale e le onde che sbattono sugli scogli a picco.",
    prompt: "Fai il tuffo a candela dal muraglione romano?",
    options: [
      {
        text: "Lanciati gridando come un gladiatore! (Test Agilità)",
        effectText: "Se riesci: +6 Dignità e gli amici applaudono. Se fallisci: -4 HP contro lo scoglio!",
        action: "cliff_jump"
      },
      {
        text: "Resta sul muretto a fare il video col cellulare",
        effectText: "Guadagni un 'Video Ricatto' spendibile contro chi si è tuffato male!",
        action: "record_video"
      }
    ]
  },
  {
    id: "finanza_al_porto",
    title: "Raid della Guardia di Finanza al Porto",
    category: "police",
    flavor: "Sirene blu sul molo innocenziano di Anzio. Arrivano i finanzieri con le cartelle esattoriali.",
    prompt: "Chi ha il patrimonio più losco?",
    options: [
      {
        text: "Ispezione generale: chi ha più di 12 monete paga il 40% di tassa!",
        effectText: "Il più ricco viene tosato. Ciro tenta di scaricare la colpa su Nicolò.",
        action: "wealth_tax"
      },
      {
        text: "Nicolò disconnette il database dell'Agenzia delle Entrate",
        effectText: "Tira un d20: con un 10+ la Finanza perde i registri e regala 2 monete a tutti.",
        action: "hack_tax"
      }
    ]
  },
  {
    id: "audio_whatsapp",
    title: "Audio Compromettente delle 4:00 AM",
    category: "blackmail",
    flavor: "Spunta un messaggio vocale registrato un anno fa all'uscita di un lido estivo.",
    prompt: "Il gruppo vota se riprodurlo ad alto volume sulla TV!",
    options: [
      {
        text: "Paga 3 monete per censurarlo all'istante",
        effectText: "Salvi la faccia, ma ti svuoti le tasche.",
        action: "censor_audio"
      },
      {
        text: "Ascoltalo insieme a tutti a volume massimo!",
        effectText: "Perdi 5 di Dignità ma ricarichi la barra del caos globale!",
        action: "play_audio"
      }
    ]
  },
  {
    id: "derby_anzio_nettuno",
    title: "Scontro di Fazione: Derby Anzio vs Nettuno",
    category: "war",
    flavor: "La secolare faida riesplode in mezzo alla Litoranea. Cori, sfottò e minacce goliardiche.",
    prompt: "Dichiara la tua appartenenza territoriale per questo round!",
    options: [
      {
        text: "Schierati con ANZIO (Piazza Pia & Frittura)",
        effectText: "Sconti al mercato di Ciro, ma pedaggio raddoppiato nel Borgo del Judoka.",
        action: "side_anzio"
      },
      {
        text: "Schierati con NETTUNO (Borgo & Forte Sangallo)",
        effectText: "Immunità dai colpi del Judoka, ma divieto di sosta al porto di Anzio.",
        action: "side_nettuno"
      }
    ]
  },
  {
    id: "buca_via_santa_barbara",
    title: "La Voragine di Via Santa Barbara",
    category: "hazard",
    flavor: "Una buca sull'asfalto così profonda che ci puoi pescare le carpe.",
    prompt: "Ci finisci dritto dentro con la ruota!",
    options: [
      {
        text: "Sfascia il cerchione e tira giù i santi (-3 HP)",
        effectText: "Perdi HP ma la rabbia ti dona +2 caselle di corsa al prossimo turno.",
        action: "damage_wheel"
      },
      {
        text: "Chiama l'officina di Christian per il soccorso stradale",
        effectText: "Christian ti rimette in pista in cambio di un trancio di pizza.",
        action: "call_christian_shop"
      }
    ]
  }
];
