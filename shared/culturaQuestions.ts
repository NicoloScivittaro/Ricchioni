/**
 * CULTURA O CAZZATA? — database domande culturali (espandibile).
 * Ogni domanda: risposta vera + decoy di fallback + spiegazione reale. I giocatori inventano le risposte false:
 * la risposta vera deve essere sorprendente e "bluffabile", mai una scelta multipla mascherata.
 *
 * difficulty 1-2 = facile, 3-4 = media, 5-6 = difficile, 7-8 = molto difficile (solo informativa: non cambia il punteggio).
 * fallbackDecoys: CINQUE risposte false e plausibili, dello stesso tipo della vera. Sostituiscono i bluff vuoti, doppi o
 *   uguali alla risposta vera e riempiono le opzioni fino a 5: con 5 decoy anche 5 giocatori senza bluff hanno opzioni vere.
 * bluff (solo audit, nessun effetto sul gioco): 1-5, quanto è facile inventare risposte false credibili.
 * Categorie (20): Animali e natura, Storia, Scienza, Corpo umano, Spazio, Geografia, Cibo, Invenzioni, Lingue, Costumi,
 *   Arte, Musica, Cinema, Sport, Tecnologia, Oggetti, Record, Miti e leggende, Curiosità, Etimologia.
 * Id: q001-q030 il pool originale (q002, q008, q009, q015, q019, q024, q026, q029 tolte: etimologia popolare, doppioni del
 *   Quiz, domande "quale di questi" non bluffabili o fatti contestati), q031-q166 l'espansione. Gli id tolti non vanno riusati.
 */
export interface CulturaQuestion {
  id: string;
  question: string;
  correctAnswer: string;
  category: string;
  difficulty: number;
  explanation: string;
  fallbackDecoys: string[];
  funFact?: string;
  bluff?: number;
}

export const CULTURA_QUESTIONS: CulturaQuestion[] = [
  // ================= POOL ORIGINALE (rivisto) =================
  {
    id: 'q001',
    question: 'Quanti cuori ha un polpo?',
    correctAnswer: 'Tre',
    category: 'Animali e natura',
    difficulty: 3,
    explanation: 'Il polpo ha tre cuori: due pompano il sangue verso le branchie e uno verso il resto del corpo.',
    fallbackDecoys: ['Due', 'Quattro', 'Otto, uno per braccio', 'Nessuno', 'Cinque'],
    funFact: 'Quando il polpo nuota, il cuore principale rallenta: per questo preferisce camminare sul fondale.',
    bluff: 4
  },
  {
    id: 'q003',
    question: 'Quale pianeta ha la superficie più calda del Sistema Solare?',
    correctAnswer: 'Venere',
    category: 'Spazio',
    difficulty: 4,
    explanation: 'Venere supera i 460 °C: la sua densa atmosfera di anidride carbonica intrappola il calore e la rende più calda di Mercurio, che pure è più vicino al Sole.',
    fallbackDecoys: ['Mercurio', 'Marte', 'Giove', 'Saturno', 'Urano'],
    funFact: 'Venere ruota anche al contrario: lì il Sole sorge a ovest e tramonta a est.',
    bluff: 4
  },
  {
    id: 'q004',
    question: 'Quale metallo, con simbolo chimico W, è stato per un secolo il filamento delle lampadine?',
    correctAnswer: 'Il tungsteno',
    category: 'Scienza',
    difficulty: 4,
    explanation: 'Il tungsteno ha il punto di fusione più alto tra i metalli, 3.422 °C: per questo reggeva il calore del filamento acceso.',
    fallbackDecoys: ['Il cromo', 'Il nichel', 'Il platino', 'Il titanio', 'Il cobalto'],
    funFact: 'Il simbolo W viene dal suo nome tedesco, "Wolfram".',
    bluff: 3
  },
  {
    id: 'q005',
    question: 'In quale anno è caduto il muro di Berlino?',
    correctAnswer: '1989',
    category: 'Storia',
    difficulty: 2,
    explanation: 'Il muro di Berlino cadde il 9 novembre 1989, simbolo della fine della Guerra Fredda.',
    fallbackDecoys: ['1985', '1991', '1987', '1990', '1988'],
    funFact: 'La caduta iniziò per un errore di comunicazione del portavoce Günter Schabowski in una conferenza stampa.',
    bluff: 3
  },
  {
    id: 'q006',
    question: 'Quale tragedia di Shakespeare gli attori evitano di nominare in teatro, perché porterebbe sfortuna?',
    correctAnswer: 'Macbeth',
    category: 'Costumi',
    difficulty: 4,
    explanation: 'Per superstizione, nei teatri inglesi la si chiama "la tragedia scozzese": pronunciarne il titolo dietro le quinte porterebbe guai alla compagnia.',
    fallbackDecoys: ['Re Lear', 'Otello', 'Amleto', 'La tempesta', 'Riccardo III'],
    funFact: 'Per tradizione chi la nomina per sbaglio deve uscire dal camerino, girare tre volte su sé stesso e sputare.',
    bluff: 3
  },
  {
    id: 'q007',
    question: "Come si chiama il regno immaginario dell'Europa centrale inventato da Anthony Hope nel 1894?",
    correctAnswer: 'La Ruritania',
    category: 'Arte',
    difficulty: 6,
    explanation: 'La Ruritania è il regno del romanzo "Il prigioniero di Zenda": il suo nome è diventato sinonimo di qualunque piccolo stato immaginario da romanzo d\'avventura.',
    fallbackDecoys: ['La Borduria', 'La Valdavia', 'La Carpazia', 'La Silvania', 'La Boemonia'],
    funFact: 'In inglese le storie di intrighi in piccoli regni di fantasia si chiamano ancora "Ruritanian romance".',
    bluff: 5
  },
  {
    id: 'q010',
    question: 'Che animale è Moby Dick, nel romanzo di Herman Melville?',
    correctAnswer: 'Un capodoglio',
    category: 'Arte',
    difficulty: 3,
    explanation: 'Moby Dick è un capodoglio bianco, non una balena qualsiasi, nel romanzo di Herman Melville (1851).',
    fallbackDecoys: ['Una balenottera azzurra', "Un'orca", 'Una megattera', 'Uno squalo bianco', 'Un narvalo'],
    funFact: 'Il romanzo è ispirato alla storia vera di "Mocha Dick", un capodoglio albino.',
    bluff: 3
  },
  {
    id: 'q011',
    question: 'Quale gioco da sagra fu disciplina olimpica dal 1900 al 1920?',
    correctAnswer: 'Il tiro alla fune',
    category: 'Sport',
    difficulty: 4,
    explanation: 'Il tiro alla fune restò nel programma olimpico per vent\'anni, con squadre di otto atleti per parte.',
    fallbackDecoys: ['La corsa nei sacchi', 'Il lancio del tronco', 'La lotta nel fango', 'Il salto della cavallina', "L'albero della cuccagna"],
    funFact: 'Nel 1908 la Gran Bretagna vinse tutte e tre le medaglie: le squadre erano formate da poliziotti.',
    bluff: 4
  },
  {
    id: 'q012',
    question: 'Che cos\'era in origine il "ketchup", prima di diventare una salsa di pomodoro?',
    correctAnswer: 'Una salsa di pesce fermentato',
    category: 'Cibo',
    difficulty: 5,
    explanation: 'Il ketchup deriva da salse di pesce fermentato del sud della Cina (come il "ke-tsiap"); il pomodoro arrivò solo nell\'Ottocento, negli Stati Uniti.',
    fallbackDecoys: ['Un succo di carne', 'Una marmellata di mele', 'Una crema di zucca', 'Un aceto di riso', 'Una salsa di soia dolce'],
    funFact: 'Il primo ketchup era marrone, non rosso.',
    bluff: 4
  },
  {
    id: 'q013',
    question: "Come si chiama il dio dell'inganno nella mitologia norrena?",
    correctAnswer: 'Loki',
    category: 'Miti e leggende',
    difficulty: 2,
    explanation: 'Loki è il dio dell\'inganno nella mitologia norrena: aiuta e tradisce gli dèi, e al Ragnarök combatterà contro di loro.',
    fallbackDecoys: ['Baldr', 'Heimdall', 'Týr', 'Freyr', 'Bragi'],
    funFact: 'Nonostante i film Marvel, nei miti Loki non è il fratello di Thor, ma un compagno di avventure.',
    bluff: 2
  },
  {
    id: 'q014',
    question: "Qual è la capitale dell'Australia?",
    correctAnswer: 'Canberra',
    category: 'Geografia',
    difficulty: 3,
    explanation: 'Canberra è la capitale dell\'Australia, scelta come compromesso tra le rivali Sydney e Melbourne.',
    fallbackDecoys: ['Sydney', 'Melbourne', 'Perth', 'Brisbane', 'Adelaide'],
    funFact: 'Canberra fu fondata nel 1913 apposta per fare la capitale.',
    bluff: 3
  },
  {
    id: 'q016',
    question: "Quale fenomeno causa l'aurora boreale?",
    correctAnswer: 'Il vento solare',
    category: 'Spazio',
    difficulty: 3,
    explanation: 'Le aurore nascono quando le particelle cariche del vento solare, guidate dal campo magnetico terrestre, urtano i gas dell\'alta atmosfera.',
    fallbackDecoys: ['Il riflesso della Luna', 'Il riflesso dei ghiacci polari', 'La luce delle stelle', 'I fulmini in alta quota', 'Il gas delle paludi artiche'],
    funFact: 'Il colore dipende dal gas: l\'ossigeno dà verde e rosso, l\'azoto blu e viola.',
    bluff: 3
  },
  {
    id: 'q017',
    question: 'Chi ha diretto "2001: Odissea nello spazio" (1968)?',
    correctAnswer: 'Stanley Kubrick',
    category: 'Cinema',
    difficulty: 2,
    explanation: '"2001: Odissea nello spazio" è di Stanley Kubrick, che lo scrisse insieme ad Arthur C. Clarke.',
    fallbackDecoys: ['Alfred Hitchcock', 'Francis Ford Coppola', 'Ridley Scott', 'George Lucas', 'Steven Spielberg'],
    funFact: 'Kubrick vinse un Oscar per gli effetti speciali di questo film: l\'unico Oscar della sua carriera.',
    bluff: 2
  },
  {
    id: 'q018',
    question: 'Quale sostanza rende verdi le foglie?',
    correctAnswer: 'La clorofilla',
    category: 'Animali e natura',
    difficulty: 2,
    explanation: 'La clorofilla è il pigmento che assorbe la luce per la fotosintesi e riflette il verde.',
    fallbackDecoys: ['Il carotene', 'La melanina', "L'emoglobina", 'La linfa verde', 'La cellulosa'],
    funFact: 'In autunno la clorofilla si degrada e restano visibili i carotenoidi, gialli e arancioni.',
    bluff: 2
  },
  {
    id: 'q020',
    question: 'Da quale lingua deriva la parola italiana "zucchero"?',
    correctAnswer: "Dall'arabo",
    category: 'Etimologia',
    difficulty: 3,
    explanation: 'Zucchero deriva dall\'arabo "sukkar", a sua volta dal persiano e dal sanscrito: gli arabi portarono la canna da zucchero in Sicilia.',
    fallbackDecoys: ['Dal greco', 'Dal latino', 'Dallo spagnolo', 'Dal francese', 'Dal portoghese'],
    funFact: 'Anche "algebra", "algoritmo" e "magazzino" vengono dall\'arabo.',
    bluff: 3
  },
  {
    id: 'q021',
    question: 'Come si chiama la salamandra messicana che sa rigenerare zampe, coda e perfino parti del cervello?',
    correctAnswer: "L'axolotl",
    category: 'Animali e natura',
    difficulty: 4,
    explanation: 'L\'axolotl, che vive nei laghi intorno a Città del Messico, può rigenerare arti, coda e persino parti del cuore e del cervello.',
    fallbackDecoys: ['Il proteo', 'Il geco leopardo', 'Il tegu', 'Il basilisco', 'Il tritone alpino'],
    funFact: "L'axolotl resta per tutta la vita in uno stadio larvale: è un eterno girino con le branchie piumate.",
    bluff: 3
  },
  {
    id: 'q022',
    question: 'Chi ha dipinto la "Notte stellata"?',
    correctAnswer: 'Vincent van Gogh',
    category: 'Arte',
    difficulty: 2,
    explanation: 'La "Notte stellata" (1889) è di Vincent van Gogh, dipinta durante il ricovero a Saint-Rémy-de-Provence.',
    fallbackDecoys: ['Claude Monet', 'Paul Cézanne', 'Pablo Picasso', 'Paul Gauguin', 'Edvard Munch'],
    funFact: 'La vista è quella dalla finestra della sua stanza, ma il villaggio in basso è inventato.',
    bluff: 2
  },
  {
    id: 'q023',
    question: 'Che cosa significa l\'espressione latina "magnum opus"?',
    correctAnswer: 'La grande opera',
    category: 'Lingue',
    difficulty: 2,
    explanation: 'Dal latino, "magnum opus" significa "la grande opera": il capolavoro di un artista.',
    fallbackDecoys: ["Opera d'arte minore", 'Il primo lavoro', 'Opera incompiuta', "L'opera segreta", 'Lavoro di gruppo'],
    funFact: 'Si usa spesso per indicare il lavoro più importante della carriera di qualcuno.',
    bluff: 2
  },
  {
    id: 'q025',
    question: "Quale gas è il più abbondante nell'atmosfera terrestre?",
    correctAnswer: "L'azoto",
    category: 'Scienza',
    difficulty: 3,
    explanation: 'L\'azoto costituisce circa il 78% dell\'atmosfera, l\'ossigeno circa il 21%.',
    fallbackDecoys: ["L'ossigeno", "L'anidride carbonica", "L'idrogeno", "L'elio", 'Il vapore acqueo'],
    funFact: 'Respiriamo azoto in continuazione, ma il nostro corpo non lo usa direttamente.',
    bluff: 3
  },
  {
    id: 'q027',
    question: 'Quale lingua è la più parlata al mondo per numero di parlanti nativi?',
    correctAnswer: 'Il cinese mandarino',
    category: 'Lingue',
    difficulty: 3,
    explanation: 'Il mandarino ha oltre 900 milioni di parlanti nativi, più di qualsiasi altra lingua.',
    fallbackDecoys: ["L'inglese", 'Lo spagnolo', "L'hindi", "L'arabo", 'Il bengali'],
    funFact: 'L\'inglese è però la lingua con più parlanti in totale, contando chi lo ha imparato come seconda lingua.',
    bluff: 3
  },
  {
    id: 'q028',
    question: 'Qual è il deserto più grande del mondo?',
    correctAnswer: "L'Antartide",
    category: 'Geografia',
    difficulty: 4,
    explanation: 'L\'Antartide è il deserto più grande: un deserto si definisce dalle scarsissime precipitazioni, non dal caldo.',
    fallbackDecoys: ['Il Sahara', 'Il Gobi', 'Il deserto arabico', 'Il Kalahari', 'Il Taklamakan'],
    funFact: "All'interno dell'Antartide cadono in media meno di 5 centimetri d'acqua l'anno, sotto forma di neve.",
    bluff: 3
  },
  {
    id: 'q030',
    question: 'Quale animale ha il morso più potente mai misurato?',
    correctAnswer: 'Il coccodrillo marino',
    category: 'Record',
    difficulty: 4,
    explanation: 'Il coccodrillo marino ha il morso più potente mai misurato in un animale vivente: oltre 16.000 newton, come una tonnellata e mezza.',
    fallbackDecoys: ['Lo squalo bianco', "L'ippopotamo", 'Il leone', 'La iena', "L'orca"],
    funFact: "L'ippopotamo ha comunque un morso devastante, ma non raggiunge quello del coccodrillo marino.",
    bluff: 3
  },

  // ================= ESPANSIONE — ANIMALI E NATURA =================
  {
    id: 'q031',
    question: 'Quale animale, pur non essendo un primate, ha impronte digitali quasi identiche alle nostre?',
    correctAnswer: 'Il koala',
    category: 'Animali e natura',
    difficulty: 5,
    explanation: 'Le impronte del koala hanno creste e spirali così simili alle nostre che anche al microscopio è difficile distinguerle. Si sono evolute per conto loro, forse per afferrare meglio le foglie di eucalipto.',
    fallbackDecoys: ['Il procione', 'Il panda rosso', 'Il bradipo', 'La lontra', 'Il castoro'],
    bluff: 5
  },
  {
    id: 'q032',
    question: "Di che colore è la pelle dell'orso polare, sotto la pelliccia?",
    correctAnswer: 'Nera',
    category: 'Animali e natura',
    difficulty: 3,
    explanation: 'La pelle nera assorbe meglio il calore del sole; i peli invece sono trasparenti e cavi, e sembrano bianchi perché diffondono la luce.',
    fallbackDecoys: ['Rosa', 'Bianca', 'Grigio-azzurra', 'Gialla', 'Marrone chiaro'],
    bluff: 4
  },
  {
    id: 'q033',
    question: 'Che forma hanno gli escrementi del vombato, un marsupiale australiano?',
    correctAnswer: 'A cubetto',
    category: 'Animali e natura',
    difficulty: 5,
    explanation: 'L\'ultimo tratto del suo intestino ha pareti più rigide e più elastiche alternate, che modellano le feci a cubetti. Il vombato le lascia su rocce e tronchi per segnare il territorio: così non rotolano via.',
    fallbackDecoys: ['A spirale', 'A stella', 'Ad anello', 'A forma di cuore', 'A bastoncino piatto'],
    bluff: 5
  },
  {
    id: 'q034',
    question: 'Quante vertebre ha nel collo una giraffa?',
    correctAnswer: 'Sette',
    category: 'Animali e natura',
    difficulty: 4,
    explanation: 'Quasi tutti i mammiferi hanno sette vertebre cervicali, dal topo all\'uomo: quelle della giraffa sono solo lunghissime, fino a circa 25 centimetri l\'una.',
    fallbackDecoys: ['Ventidue', 'Quattordici', 'Trentadue', 'Diciotto', 'Undici'],
    bluff: 5
  },
  {
    id: 'q035',
    question: 'Come fanno i delfini a dormire senza annegare?',
    correctAnswer: 'Con metà cervello alla volta',
    category: 'Animali e natura',
    difficulty: 3,
    explanation: 'Mentre una metà del cervello riposa, l\'altra resta sveglia per salire a respirare e controllare i pericoli; spesso tengono aperto anche l\'occhio opposto.',
    fallbackDecoys: ['Appesi alle alghe', 'Tenendosi per la pinna', "Dentro grotte piene d'aria", 'Trattenendo il fiato per sei ore', 'Appoggiati alle balene'],
    bluff: 4
  },
  {
    id: 'q036',
    question: "Qual è l'unico uccello capace di volare all'indietro?",
    correctAnswer: 'Il colibrì',
    category: 'Animali e natura',
    difficulty: 2,
    explanation: 'Il colibrì muove le ali disegnando un otto: così può restare fermo a mezz\'aria, salire, scendere e perfino andare in retromarcia.',
    fallbackDecoys: ['La rondine', 'Il martin pescatore', 'Il gheppio', 'Il passero', 'La cinciallegra'],
    bluff: 3
  },

  // ================= STORIA =================
  {
    id: 'q037',
    question: "Secondo gli storici antichi, a chi voleva dare la carica di console l'imperatore Caligola?",
    correctAnswer: 'Al suo cavallo',
    category: 'Storia',
    difficulty: 2,
    explanation: 'Svetonio e Cassio Dione raccontano che Caligola amava così tanto il cavallo Incitato da volerlo console: aveva una stalla di marmo e una mangiatoia d\'avorio. Forse era solo uno sfregio al Senato.',
    fallbackDecoys: ['Al suo barbiere', 'A un gladiatore', 'A sua madre', 'Al suo cuoco', 'A un attore di teatro'],
    bluff: 4
  },
  {
    id: 'q038',
    question: 'Quanto durò la guerra anglo-zanzibarina del 1896, la più breve della storia?',
    correctAnswer: 'Circa 40 minuti',
    category: 'Storia',
    difficulty: 3,
    explanation: 'Il 27 agosto 1896 le navi britanniche bombardarono il palazzo del sultano di Zanzibar, che si arrese dopo circa 38-45 minuti.',
    fallbackDecoys: ['Tre giorni', 'Sei ore', 'Due settimane', 'Un giorno e mezzo', 'Undici minuti'],
    bluff: 4
  },
  {
    id: 'q039',
    question: "Quanti anni durò, in realtà, la Guerra dei Cent'anni?",
    correctAnswer: '116',
    category: 'Storia',
    difficulty: 4,
    explanation: 'Andò dal 1337 al 1453: fu una serie di conflitti tra Inghilterra e Francia con lunghe tregue, e il nome le fu dato solo secoli dopo.',
    fallbackDecoys: ['99', '100', '104', '121', '87'],
    bluff: 4
  },
  {
    id: 'q040',
    question: "Quale città fu la prima capitale del Regno d'Italia?",
    correctAnswer: 'Torino',
    category: 'Storia',
    difficulty: 2,
    explanation: 'Torino fu capitale dal 1861 al 1865; poi toccò a Firenze, e solo nel 1871, dopo la presa di Roma, la capitale arrivò a Roma.',
    fallbackDecoys: ['Firenze', 'Milano', 'Napoli', 'Genova', 'Bologna'],
    bluff: 3
  },
  {
    id: 'q041',
    question: "In che anno le donne italiane votarono per la prima volta a un'elezione nazionale?",
    correctAnswer: '1946',
    category: 'Storia',
    difficulty: 2,
    explanation: 'Il 2 giugno 1946 le donne votarono al referendum tra monarchia e repubblica e per l\'Assemblea Costituente; qualche mese prima avevano già votato alle comunali.',
    fallbackDecoys: ['1919', '1925', '1948', '1958', '1912'],
    bluff: 4
  },
  {
    id: 'q042',
    question: 'Quale città romana, sepolta dal Vesuvio nel 79 d.C., ci ha lasciato porte, letti e travi di legno ancora interi?',
    correctAnswer: 'Ercolano',
    category: 'Storia',
    difficulty: 3,
    explanation: 'Ercolano fu travolta da flussi piroclastici roventi che la sigillarono sotto metri di materiale vulcanico: il legno si carbonizzò senza bruciare e si è conservato fino a oggi.',
    fallbackDecoys: ['Pozzuoli', 'Cuma', 'Capua', 'Baia', 'Nola'],
    bluff: 3
  },

  // ================= SCIENZA =================
  {
    id: 'q043',
    question: 'A quale temperatura i gradi Celsius e i gradi Fahrenheit segnano lo stesso numero?',
    correctAnswer: 'Meno 40 gradi',
    category: 'Scienza',
    difficulty: 5,
    explanation: '-40 °C corrispondono esattamente a -40 °F: è l\'unico punto in cui le due scale si incontrano.',
    fallbackDecoys: ['Zero gradi', 'Meno 32 gradi', '100 gradi', 'Meno 273 gradi', '32 gradi'],
    bluff: 4
  },
  {
    id: 'q044',
    question: 'Di che colore è il sangue del limulo, usato per controllare che vaccini e farmaci iniettabili non siano contaminati?',
    correctAnswer: 'Blu',
    category: 'Scienza',
    difficulty: 4,
    explanation: 'Il sangue del limulo trasporta l\'ossigeno con l\'emocianina, a base di rame, che lo rende blu; contiene cellule che coagulano a contatto con le tossine dei batteri.',
    fallbackDecoys: ['Verde', 'Viola', 'Arancione', 'Giallo', 'Nero'],
    bluff: 4
  },
  {
    id: 'q045',
    question: 'Che cosa misura la scala di Mohs?',
    correctAnswer: 'La durezza dei minerali',
    category: 'Scienza',
    difficulty: 3,
    explanation: 'Va da 1, il talco, a 10, il diamante: ogni minerale riesce a graffiare quelli che stanno sotto di lui nella scala.',
    fallbackDecoys: ['La forza dei terremoti', 'La salinità del mare', "La trasparenza dell'acqua", "L'acidità del terreno", 'La luminosità delle stelle'],
    bluff: 4
  },
  {
    id: 'q046',
    question: 'Come si chiama il fenomeno fisico che rende azzurro il cielo?',
    correctAnswer: 'La diffusione di Rayleigh',
    category: 'Scienza',
    difficulty: 5,
    explanation: 'Le molecole dell\'aria diffondono molto di più la luce blu, a onda corta, che quella rossa: il cielo si riempie di azzurro. Al tramonto la luce attraversa più aria e restano i rossi.',
    fallbackDecoys: ["L'effetto Doppler", "L'effetto Cherenkov", 'Il riflesso degli oceani', 'La rifrazione di Snell', "L'effetto Kelvin"],
    bluff: 3
  },
  {
    id: 'q047',
    question: "Quale frutto ha dato il nome a un'unità di misura scherzosa della radioattività?",
    correctAnswer: 'La banana',
    category: 'Scienza',
    difficulty: 3,
    explanation: 'La "dose equivalente di banana" misura la radioattività del potassio-40 contenuto nel frutto: una quantità minuscola e innocua, usata per spiegare le dosi al pubblico.',
    fallbackDecoys: ["L'avocado", 'Il kiwi', 'La noce di cocco', "L'anguria", 'Il melograno'],
    bluff: 3
  },

  // ================= CORPO UMANO =================
  {
    id: 'q048',
    question: "Qual è l'unico osso del corpo umano che non è collegato a nessun altro osso?",
    correctAnswer: "L'osso ioide",
    category: 'Corpo umano',
    difficulty: 5,
    explanation: 'L\'ioide, a forma di ferro di cavallo, sta nel collo sotto la lingua ed è tenuto al suo posto solo da muscoli e legamenti. Aiuta a deglutire e a parlare.',
    fallbackDecoys: ['La rotula', 'Il coccige', 'La clavicola', 'Lo sterno', 'Il vomere'],
    bluff: 4
  },
  {
    id: 'q049',
    question: 'Quale organo umano può ricrescere anche dopo che ne è stata asportata più di metà?',
    correctAnswer: 'Il fegato',
    category: 'Corpo umano',
    difficulty: 2,
    explanation: 'Il fegato può rigenerarsi partendo da circa un quarto del suo tessuto: per questo un donatore vivente può regalarne un pezzo.',
    fallbackDecoys: ['La milza', 'Il pancreas', 'Il rene', 'Il polmone', 'La tiroide'],
    bluff: 3
  },
  {
    id: 'q050',
    question: 'Come si chiama lo spazio liscio tra le sopracciglia?',
    correctAnswer: 'La glabella',
    category: 'Corpo umano',
    difficulty: 5,
    explanation: 'Il nome viene dal latino "glabellus", liscio e senza peli. Se un medico ci picchietta sopra, scatta un riflesso che fa sbattere le palpebre.',
    fallbackDecoys: ['La nasella', 'Il frontino', 'La cigliera', 'Il sopracciglione', 'La frontella'],
    bluff: 5
  },
  {
    id: 'q051',
    question: 'Come si chiamano, in medicina, i brontolii della pancia?',
    correctAnswer: 'Borborigmi',
    category: 'Corpo umano',
    difficulty: 4,
    explanation: 'Sono gas e liquidi spinti dalle contrazioni dell\'intestino: il nome, di origine greca, imita il suono stesso.',
    fallbackDecoys: ['Gorgoglioni', 'Ventrismi', 'Peristalti', 'Rumoriti', 'Gastrofonie'],
    bluff: 5
  },
  {
    id: 'q052',
    question: 'Perché le dita si raggrinziscono se restano a lungo in acqua?',
    correctAnswer: 'Lo decide il sistema nervoso',
    category: 'Corpo umano',
    difficulty: 5,
    explanation: 'Non è la pelle che si gonfia d\'acqua: sono i nervi che fanno restringere i vasi sanguigni. Se i nervi di un dito sono lesionati, le grinze non compaiono. Forse servono a fare presa sul bagnato.',
    fallbackDecoys: ["La pelle si gonfia d'acqua", 'Si scioglie il grasso della pelle', 'Il sale della pelle si diluisce', 'Il sangue si raffredda', 'Le unghie tirano la pelle'],
    bluff: 4
  },
  {
    id: 'q053',
    question: 'Quante volte batte, più o meno, un cuore umano in un giorno?',
    correctAnswer: 'Circa 100.000',
    category: 'Corpo umano',
    difficulty: 3,
    explanation: 'A 70 battiti al minuto fanno circa 100.000 battiti al giorno, e quasi 3 miliardi in una vita intera.',
    fallbackDecoys: ['Circa 10.000', 'Circa 1 milione', 'Circa 40.000', 'Circa 250.000', 'Circa 5.000'],
    bluff: 3
  },
  {
    id: 'q054',
    question: "Quale parte del corpo non ha vasi sanguigni e prende l'ossigeno direttamente dall'aria?",
    correctAnswer: 'La cornea',
    category: 'Corpo umano',
    difficulty: 4,
    explanation: 'La cornea è trasparente proprio perché non ha vasi sanguigni: l\'ossigeno le arriva dall\'aria, sciolto nel velo di lacrime.',
    fallbackDecoys: ['Le gengive', 'Il timpano', 'Le labbra', 'La lingua', 'Le narici'],
    bluff: 4
  },
  {
    id: 'q055',
    question: 'Quale senso arriva al cervello senza passare dal talamo, ed è per questo legatissimo ai ricordi?',
    correctAnswer: "L'olfatto",
    category: 'Corpo umano',
    difficulty: 2,
    explanation: 'I segnali dell\'olfatto vanno dritti verso amigdala e ippocampo, le aree di emozioni e memoria: per questo un profumo può riportarti di colpo a vent\'anni prima.',
    fallbackDecoys: ['Il gusto', "L'udito", 'Il tatto', 'La vista', "L'equilibrio"],
    bluff: 3
  },

  // ================= SPAZIO =================
  {
    id: 'q056',
    question: 'Quante Terre potrebbero stare, più o meno, dentro il Sole?',
    correctAnswer: 'Circa 1,3 milioni',
    category: 'Spazio',
    difficulty: 4,
    explanation: 'Il diametro del Sole è circa 109 volte quello terrestre: in volume ci starebbero circa 1,3 milioni di Terre.',
    fallbackDecoys: ['Circa 10.000', 'Circa 100.000', 'Circa 50 milioni', 'Circa 3.000', 'Circa 800.000'],
    bluff: 4
  },
  {
    id: 'q057',
    question: 'Quali furono i primi animali mandati nello spazio, nel 1947?',
    correctAnswer: 'Dei moscerini della frutta',
    category: 'Spazio',
    difficulty: 5,
    explanation: 'Nel febbraio 1947 un razzo V2 americano li portò oltre i 100 km di quota per studiare gli effetti delle radiazioni: tornarono a terra vivi, con il paracadute.',
    fallbackDecoys: ['Due scimmie', 'Dei topi bianchi', 'Una tartaruga', 'Un gatto', 'Delle api'],
    bluff: 4
  },
  {
    id: 'q058',
    question: 'Quanto dura un anno su Mercurio?',
    correctAnswer: '88 giorni terrestri',
    category: 'Spazio',
    difficulty: 5,
    explanation: 'Mercurio fa il giro del Sole in 88 giorni, ma ruota su sé stesso così piano che fra un\'alba e l\'altra passano 176 giorni terrestri: due dei suoi anni.',
    fallbackDecoys: ['12 giorni terrestri', '2 anni terrestri', '225 giorni terrestri', '43 giorni terrestri', '6 mesi terrestri'],
    bluff: 4
  },
  {
    id: 'q059',
    question: 'Quale sport praticò Alan Shepard sulla Luna, nel 1971?',
    correctAnswer: 'Il golf',
    category: 'Spazio',
    difficulty: 4,
    explanation: 'Durante l\'Apollo 14 Shepard montò una testa di mazza su un attrezzo per raccogliere campioni e colpì due palline: una, disse scherzando, andò "per miglia e miglia".',
    fallbackDecoys: ['Il baseball', 'Il salto in lungo', 'Il calcio', 'Il tennis', 'Il frisbee'],
    bluff: 4
  },
  {
    id: 'q060',
    question: 'Come si chiama il vulcano più alto del Sistema Solare?',
    correctAnswer: 'Olympus Mons',
    category: 'Spazio',
    difficulty: 4,
    explanation: 'Olympus Mons, su Marte, è alto circa 22 km, quasi tre volte l\'Everest, e ha una base larga circa 600 km.',
    fallbackDecoys: ['Elysium Mons', 'Maxwell Montes', 'Mons Titanicus', 'Ares Mons', 'Vulcanus Major'],
    bluff: 3
  },
  {
    id: 'q061',
    question: 'Che cosa misura un anno luce?',
    correctAnswer: 'Una distanza',
    category: 'Spazio',
    difficulty: 2,
    explanation: 'È la strada che la luce percorre in un anno: circa 9.460 miliardi di chilometri. Il nome inganna, ma non è un tempo.',
    fallbackDecoys: ['Un intervallo di tempo', 'La luminosità di una stella', 'La velocità di una cometa', "L'età di una galassia", 'La temperatura del Sole'],
    bluff: 3
  },

  // ================= GEOGRAFIA =================
  {
    id: 'q062',
    question: "Quale paese ha l'unica bandiera nazionale che non è né rettangolare né quadrata?",
    correctAnswer: 'Il Nepal',
    category: 'Geografia',
    difficulty: 4,
    explanation: 'La bandiera del Nepal è fatta di due triangoli sovrapposti, che richiamano le vette dell\'Himalaya; dentro ci sono una luna e un sole.',
    fallbackDecoys: ['Il Bhutan', 'Lo Sri Lanka', 'La Mongolia', 'Il Laos', 'Il Brunei'],
    bluff: 4
  },
  {
    id: 'q063',
    question: "Quale paese ha più piramidi dell'Egitto?",
    correctAnswer: 'Il Sudan',
    category: 'Geografia',
    difficulty: 5,
    explanation: 'Il Sudan conta oltre 200 piramidi nubiane, costruite dai re di Kush: più piccole e ripide di quelle egizie, ma molto più numerose.',
    fallbackDecoys: ['La Libia', "L'Etiopia", 'La Giordania', 'Il Ciad', 'La Tunisia'],
    bluff: 4
  },
  {
    id: 'q064',
    question: "Qual è l'unico paese attraversato sia dall'Equatore sia dal Tropico del Capricorno?",
    correctAnswer: 'Il Brasile',
    category: 'Geografia',
    difficulty: 5,
    explanation: 'Il Brasile è così esteso da essere tagliato da entrambe le linee: l\'Equatore passa vicino alla foce del Rio delle Amazzoni, il Tropico poco a nord di San Paolo.',
    fallbackDecoys: ["L'Indonesia", "L'Australia", 'Il Kenya', 'Il Perù', "L'Ecuador"],
    bluff: 4
  },
  {
    id: 'q065',
    question: 'Quale animale compare sulla bandiera del Galles?',
    correctAnswer: 'Un drago rosso',
    category: 'Geografia',
    difficulty: 2,
    explanation: 'Il drago rosso, "Y Ddraig Goch", è il simbolo del Galles da secoli. Il Galles, però, è l\'unica nazione del Regno Unito a non essere rappresentata nella Union Jack.',
    fallbackDecoys: ["Un leone d'oro", 'Un unicorno bianco', "Un'aquila nera", 'Un cervo bianco', 'Un grifone verde'],
    bluff: 3
  },
  {
    id: 'q066',
    question: 'Come si chiama il tratto di mare che separa la Sardegna dalla Corsica?',
    correctAnswer: 'Le Bocche di Bonifacio',
    category: 'Geografia',
    difficulty: 4,
    explanation: 'Prende il nome dalla cittadina corsa di Bonifacio, arroccata sulle scogliere: nel punto più stretto le due isole distano circa 11 km.',
    fallbackDecoys: ['Il Canale di Tavolara', 'Lo Stretto di Capo Corso', 'Le Bocche di Caprera', 'Il Canale di Gallura', 'Lo Stretto di Maddalena'],
    bluff: 4
  },
  {
    id: 'q067',
    question: "Quanto distano, nello stretto di Bering, un'isola russa e una americana?",
    correctAnswer: 'Circa 4 km',
    category: 'Geografia',
    difficulty: 4,
    explanation: 'La Grande Diomede, russa, e la Piccola Diomede, americana, sono separate da meno di 4 km di mare e dalla linea del cambio di data: fra le due c\'è quasi un giorno di differenza.',
    fallbackDecoys: ['Circa 80 km', 'Circa 300 km', 'Circa 25 km', 'Circa 12 km', 'Circa 150 km'],
    bluff: 4
  },

  // ================= CIBO =================
  {
    id: 'q068',
    question: 'Da quale continente arrivano le patate?',
    correctAnswer: 'Dal Sud America',
    category: 'Cibo',
    difficulty: 2,
    explanation: 'Le patate furono coltivate per la prima volta sulle Ande, migliaia di anni fa, e arrivarono in Europa con gli spagnoli nel Cinquecento.',
    fallbackDecoys: ["Dall'Asia", "Dall'Africa", "Dall'Europa del Nord", 'Dal Nord America', "Dall'Oceania"],
    bluff: 3
  },
  {
    id: 'q069',
    question: 'Che cosa sono, in realtà, i "semini" sulla superficie della fragola?',
    correctAnswer: 'I veri frutti',
    category: 'Cibo',
    difficulty: 5,
    explanation: 'Ogni puntino è un achenio, un minuscolo frutto secco con dentro il seme. La parte rossa e succosa è il ricettacolo del fiore, che si è ingrossato.',
    fallbackDecoys: ["Uova d'insetto", 'Pori per respirare', 'Cristalli di zucchero', 'Spine mancate', 'Gemme di nuove piantine'],
    bluff: 5
  },
  {
    id: 'q070',
    question: 'Da dove si ricava il colorante rosso E120, usato in alcuni dolci e bibite?',
    correctAnswer: 'Da un insetto',
    category: 'Cibo',
    difficulty: 4,
    explanation: 'Il carminio si estrae dalle femmine di cocciniglia, piccoli insetti che vivono sui fichi d\'India: essiccate e macinate, danno un rosso intensissimo.',
    fallbackDecoys: ['Da un mollusco', 'Da una barbabietola', 'Da un fungo', 'Dal petrolio', "Da un'alga rossa"],
    bluff: 4
  },
  {
    id: 'q071',
    question: 'Quale spezia si ottiene dagli stimmi di un fiore, raccolti a mano uno a uno?',
    correctAnswer: 'Lo zafferano',
    category: 'Cibo',
    difficulty: 2,
    explanation: 'Ogni fiore di Crocus sativus ha solo tre stimmi: per un chilo di zafferano servono circa 150.000 fiori. Per questo costa così tanto.',
    fallbackDecoys: ['La vaniglia', 'La curcuma', 'La paprika', 'Il cardamomo', 'La noce moscata'],
    bluff: 3
  },
  {
    id: 'q072',
    question: 'Che cosa usavano gli Aztechi come moneta, oltre che per preparare una bevanda amara?',
    correctAnswer: 'I semi di cacao',
    category: 'Cibo',
    difficulty: 3,
    explanation: 'Per gli Aztechi i semi di cacao erano denaro: secondo un documento del Cinquecento, con un centinaio si comprava un tacchino.',
    fallbackDecoys: ['I chicchi di mais', 'I peperoncini secchi', 'I chicchi di caffè', 'Le foglie di tabacco', 'I fagioli rossi'],
    bluff: 4
  },
  {
    id: 'q073',
    question: 'Di che colore erano le prime carote coltivate?',
    correctAnswer: 'Viola e gialle',
    category: 'Cibo',
    difficulty: 5,
    explanation: 'Le prime carote domestiche, in Asia centrale, erano viola e gialle; quelle arancioni si affermarono in Europa tra Cinque e Seicento, soprattutto grazie ai coltivatori olandesi.',
    fallbackDecoys: ['Blu e verdi', 'Rosse e nere', 'Verdi e marroni', 'Azzurre', 'Rosa'],
    bluff: 4
  },
  {
    id: 'q074',
    question: 'Che tipo di frutto è, per un botanico, la banana?',
    correctAnswer: 'Una bacca',
    category: 'Cibo',
    difficulty: 5,
    explanation: 'Per i botanici la banana è una bacca, come il pomodoro, il kiwi e il mirtillo: nasce da un solo fiore con un solo ovario e ha i semi immersi nella polpa.',
    fallbackDecoys: ['Una drupa', 'Un legume', "Un'infruttescenza", 'Un pomo', 'Un tubero'],
    bluff: 4
  },

  // ================= INVENZIONI =================
  {
    id: 'q075',
    question: 'Che cosa volevano creare, nel 1957, gli inventori del pluriball?',
    correctAnswer: 'Una carta da parati',
    category: 'Invenzioni',
    difficulty: 3,
    explanation: 'Alfred Fielding e Marc Chavannes cercavano una carta da parati "in rilievo", facile da pulire. Non piacque a nessuno: anni dopo trovò fortuna come imballaggio.',
    fallbackDecoys: ['Un materassino da spiaggia', 'Una suola per scarpe', 'Un giocattolo antistress', 'Un tappetino per auto', 'Una tovaglia impermeabile'],
    bluff: 5
  },
  {
    id: 'q076',
    question: 'Che cosa si sciolse nella tasca di Percy Spencer, facendogli scoprire il forno a microonde?',
    correctAnswer: 'Una barretta di cioccolato',
    category: 'Invenzioni',
    difficulty: 3,
    explanation: 'Nel 1945 Spencer lavorava ai radar accanto a un magnetron e si accorse che la barretta che aveva in tasca si era sciolta; poi provò con i chicchi di mais, che diventarono popcorn.',
    fallbackDecoys: ['Una caramella mou', 'Un panetto di burro', 'Un gelato', 'Una candela', 'Un pezzo di formaggio'],
    bluff: 4
  },
  {
    id: 'q077',
    question: 'Da quale "errore" sono nati i Post-it?',
    correctAnswer: 'Una colla troppo debole',
    category: 'Invenzioni',
    difficulty: 3,
    explanation: 'Nel 1968 Spencer Silver della 3M ottenne per sbaglio una colla che attaccava poco e si staccava senza lasciare segni. Anni dopo il collega Art Fry la usò per i segnalibri del coro della chiesa.',
    fallbackDecoys: ['Una carta troppo sottile', 'Un nastro adesivo difettoso', 'Delle etichette stampate male', 'Un inchiostro che non asciugava', 'Delle buste che non si chiudevano'],
    bluff: 4
  },
  {
    id: 'q078',
    question: 'A che cosa serviva la prima sega a catena, inventata alla fine del Settecento?',
    correctAnswer: 'Ad aiutare i parti difficili',
    category: 'Invenzioni',
    difficulty: 5,
    explanation: 'I medici scozzesi John Aitken e James Jeffray idearono una piccola sega a catena, azionata a mano, per tagliare osso e cartilagine del bacino quando il bambino non riusciva a nascere.',
    fallbackDecoys: ['A tagliare il ghiaccio', 'A potare le viti', 'A scavare nelle miniere di sale', 'A tagliare il marmo', 'A smontare le navi'],
    bluff: 5
  },
  {
    id: 'q079',
    question: "Quale strumento medico nacque nel 1816 perché un dottore era in imbarazzo ad appoggiare l'orecchio sul petto di una paziente?",
    correctAnswer: 'Lo stetoscopio',
    category: 'Invenzioni',
    difficulty: 2,
    explanation: 'René Laennec arrotolò un foglio di carta a forma di tubo e scoprì che sentiva il cuore meglio che con l\'orecchio nudo.',
    fallbackDecoys: ['Il termometro', 'Lo sfigmomanometro', "L'otoscopio", 'Il martelletto per i riflessi', 'Il plessimetro'],
    bluff: 3
  },
  {
    id: 'q080',
    question: 'Da quale gioco, inventato per mostrare i danni dei monopoli, deriva il Monopoly?',
    correctAnswer: 'Il gioco del padrone di casa',
    category: 'Invenzioni',
    difficulty: 6,
    explanation: 'Elizabeth Magie brevettò "The Landlord\'s Game" nel 1904 per mostrare come gli affitti arricchissero pochi proprietari a spese di tutti; il Monopoly ne prese le regole e ne ribaltò il messaggio.',
    fallbackDecoys: ["Il gioco dell'usuraio", 'Il gioco del banchiere', 'Il barone ladro', "La corsa all'affitto", 'Il re delle ferrovie'],
    bluff: 4
  },
  {
    id: 'q081',
    question: "Che lavoro faceva László Bíró, l'inventore della penna a sfera moderna?",
    correctAnswer: 'Il giornalista',
    category: 'Invenzioni',
    difficulty: 4,
    explanation: 'Bíró notò che l\'inchiostro dei giornali asciugava subito ma era troppo denso per una stilografica: con il fratello György, chimico, inventò la punta a sfera e la brevettò nel 1938.',
    fallbackDecoys: ['Il calzolaio', 'Il pittore', "L'orologiaio", 'Il dentista', 'Il tipografo'],
    bluff: 4
  },

  // ================= LINGUE =================
  {
    id: 'q082',
    question: 'In quale paese il romancio è una delle lingue nazionali?',
    correctAnswer: 'In Svizzera',
    category: 'Lingue',
    difficulty: 4,
    explanation: 'Il romancio, lingua neolatina parlata nei Grigioni da qualche decina di migliaia di persone, è lingua nazionale svizzera dal 1938, accanto a tedesco, francese e italiano.',
    fallbackDecoys: ['In Austria', 'In Slovenia', 'In Liechtenstein', 'In Romania', 'In Lussemburgo'],
    bluff: 3
  },
  {
    id: 'q083',
    question: "Qual è l'unica lingua semitica tra le lingue ufficiali dell'Unione Europea?",
    correctAnswer: 'Il maltese',
    category: 'Lingue',
    difficulty: 5,
    explanation: 'Il maltese discende dall\'arabo parlato in Sicilia e a Malta nel Medioevo, ma si scrive con l\'alfabeto latino ed è pieno di parole italiane e inglesi.',
    fallbackDecoys: ["L'ebraico", 'Il basco', "L'ungherese", "L'estone", 'Il cipriota'],
    bluff: 3
  },
  {
    id: 'q084',
    question: 'Qual è la lingua inventata più parlata al mondo, pubblicata nel 1887?',
    correctAnswer: "L'esperanto",
    category: 'Lingue',
    difficulty: 2,
    explanation: 'Il medico polacco Ludwik Zamenhof la pubblicò per dare a tutti i popoli una lingua neutrale e facile da imparare. Il nome viene dal suo pseudonimo, "Doktoro Esperanto": colui che spera.',
    fallbackDecoys: ['Il volapük', "L'interlingua", 'Il novial', 'Il lojban', "L'ido"],
    bluff: 3
  },
  {
    id: 'q085',
    question: 'In quale lingua fu scritto in origine il Nuovo Testamento?',
    correctAnswer: 'In greco',
    category: 'Lingue',
    difficulty: 4,
    explanation: 'Fu scritto in greco koinè, la lingua comune del Mediterraneo orientale; Gesù, invece, parlava probabilmente aramaico.',
    fallbackDecoys: ['In aramaico', 'In ebraico', 'In latino', 'In copto', 'In siriaco'],
    bluff: 3
  },
  {
    id: 'q086',
    question: 'Quale lingua africana ci ha dato le parole "safari" e "hakuna matata"?',
    correctAnswer: 'Lo swahili',
    category: 'Lingue',
    difficulty: 2,
    explanation: 'In swahili "safari" significa semplicemente "viaggio", mentre "hakuna matata", reso famoso dal Re Leone, vuol dire "nessun problema".',
    fallbackDecoys: ['Lo zulu', "L'amarico", 'Lo yoruba', 'Il somalo', 'Lo xhosa'],
    bluff: 3
  },
  {
    id: 'q087',
    question: 'Che cosa significa, alla lettera, la parola giapponese "karaoke"?',
    correctAnswer: 'Orchestra vuota',
    category: 'Lingue',
    difficulty: 4,
    explanation: '"Kara" vuol dire vuoto e "oke" è l\'abbreviazione giapponese di "orchestra": la musica c\'è, manca solo la voce.',
    fallbackDecoys: ['Voce felice', 'Canzone ubriaca', "Microfono d'oro", 'Cantare insieme', 'Stella per una sera'],
    bluff: 5
  },
  {
    id: 'q088',
    question: 'Che cosa vuol dire "kamikaze"?',
    correctAnswer: 'Vento divino',
    category: 'Lingue',
    difficulty: 2,
    explanation: 'Era il nome dei tifoni che nel 1274 e nel 1281 distrussero le flotte mongole dirette in Giappone; nel 1944 fu dato ai piloti che si lanciavano sulle navi nemiche.',
    fallbackDecoys: ['Morte gloriosa', 'Fuoco dal cielo', 'Uccello di ferro', 'Spada volante', 'Ultimo saluto'],
    bluff: 4
  },

  // ================= COSTUMI =================
  {
    id: 'q089',
    question: 'In quale paese lasciare la mancia al ristorante può essere considerato scortese?',
    correctAnswer: 'In Giappone',
    category: 'Costumi',
    difficulty: 2,
    explanation: 'In Giappone un servizio impeccabile è considerato normale: i soldi in più possono mettere in imbarazzo, e capita che il cameriere ti rincorra per strada per restituirli.',
    fallbackDecoys: ['In Francia', 'In Messico', 'In Egitto', 'Negli Stati Uniti', 'In Brasile'],
    bluff: 3
  },
  {
    id: 'q090',
    question: "Quanti chicchi d'uva si mangiano in Spagna allo scoccare della mezzanotte di Capodanno?",
    correctAnswer: 'Dodici',
    category: 'Costumi',
    difficulty: 2,
    explanation: 'Se ne mangia uno a ogni rintocco della mezzanotte: chi riesce a finirli in tempo, dice la tradizione, avrà dodici mesi fortunati.',
    fallbackDecoys: ['Sette', 'Ventuno', 'Tredici', 'Nove', 'Trenta'],
    bluff: 3
  },
  {
    id: 'q091',
    question: 'Qual è tradizionalmente il colore del lutto in Cina?',
    correctAnswer: 'Il bianco',
    category: 'Costumi',
    difficulty: 2,
    explanation: 'Nella tradizione cinese il bianco è il colore della morte e dei funerali; il rosso, al contrario, porta fortuna e si indossa ai matrimoni.',
    fallbackDecoys: ['Il rosso', 'Il giallo', 'Il viola', 'Il verde', "L'arancione"],
    bluff: 3
  },
  {
    id: 'q092',
    question: 'In Danimarca, che cosa si lancia addosso a chi compie 25 anni ed è ancora single?',
    correctAnswer: 'Cannella',
    category: 'Costumi',
    difficulty: 5,
    explanation: 'Gli amici lo ricoprono di cannella, spesso dopo averlo bagnato perché si attacchi; se a 30 anni è ancora single, si passa al pepe.',
    fallbackDecoys: ['Farina', 'Riso crudo', 'Coriandoli', 'Zucchero a velo', 'Sale grosso'],
    bluff: 5
  },
  {
    id: 'q093',
    question: 'In quale paese si disputa il campionato mondiale di trasporto della moglie?',
    correctAnswer: 'In Finlandia',
    category: 'Costumi',
    difficulty: 4,
    explanation: 'A Sonkajärvi i concorrenti affrontano un percorso a ostacoli con la "moglie" in spalla, anche dentro l\'acqua; il premio è il suo peso in birra.',
    fallbackDecoys: ['In Irlanda', 'In Scozia', 'In Norvegia', 'In Austria', 'In Islanda'],
    bluff: 4
  },
  {
    id: 'q094',
    question: "Che cosa si lanciano per strada gli abitanti di Buñol, in Spagna, l'ultimo mercoledì di agosto?",
    correctAnswer: 'Pomodori',
    category: 'Costumi',
    difficulty: 2,
    explanation: 'Alla Tomatina migliaia di persone si tirano tonnellate di pomodori maturi per circa un\'ora; poi le strade vengono lavate con gli idranti.',
    fallbackDecoys: ['Arance', 'Farina', 'Uova', 'Gavettoni', 'Cuscini'],
    bluff: 3
  },
  {
    id: 'q095',
    question: 'In Giappone, quale animale portafortuna saluta i clienti con la zampa alzata nei negozi?',
    correctAnswer: 'Il gatto',
    category: 'Costumi',
    difficulty: 2,
    explanation: 'È il maneki-neko, il "gatto che invita": secondo la tradizione, con la zampa sinistra richiama i clienti e con la destra il denaro.',
    fallbackDecoys: ['Il cane', 'La scimmia', 'Il coniglio', 'Il panda', "L'orso"],
    bluff: 3
  },

  // ================= ARTE =================
  {
    id: 'q096',
    question: 'Chi rubò la Gioconda dal Louvre, nel 1911?',
    correctAnswer: 'Un operaio italiano',
    category: 'Arte',
    difficulty: 4,
    explanation: 'Vincenzo Peruggia, un decoratore che aveva lavorato al Louvre, la portò via nascosta sotto il camice. Fu ritrovata nel 1913 a Firenze, quando provò a venderla.',
    fallbackDecoys: ['Pablo Picasso', 'Un custode del museo', 'Un ladro russo', 'Un collezionista americano', 'Un pittore francese'],
    funFact: 'Tra i sospettati finì anche Pablo Picasso, poi scagionato.',
    bluff: 4
  },
  {
    id: 'q097',
    question: 'Di che metallo è il rivestimento della Statua della Libertà, diventato verde col tempo?',
    correctAnswer: 'Rame',
    category: 'Arte',
    difficulty: 2,
    explanation: 'Le lastre di rame, spesse più o meno quanto due monete, si sono ossidate in una patina verde che oggi le protegge dalla corrosione.',
    fallbackDecoys: ['Bronzo', 'Ottone', 'Ghisa', 'Stagno', 'Zinco'],
    bluff: 3
  },
  {
    id: 'q098',
    question: 'Quale oggetto espose Marcel Duchamp nel 1917 con il titolo "Fontana"?',
    correctAnswer: 'Un orinatoio',
    category: 'Arte',
    difficulty: 3,
    explanation: 'Duchamp lo firmò "R. Mutt" e lo propose a una mostra, che lo rifiutò: oggi è considerato una delle opere più influenti del Novecento.',
    fallbackDecoys: ['Un lavandino', 'Una ruota di bicicletta', 'Un bidet', 'Un annaffiatoio', 'Una vasca da bagno'],
    bluff: 4
  },
  {
    id: 'q099',
    question: 'Perché Caravaggio dovette fuggire da Roma nel 1606?',
    correctAnswer: 'Aveva ucciso un uomo',
    category: 'Arte',
    difficulty: 4,
    explanation: 'Durante una rissa uccise Ranuccio Tomassoni e fu condannato a morte: passò gli ultimi anni in fuga tra Napoli, Malta e la Sicilia.',
    fallbackDecoys: ['Aveva offeso il Papa', 'Aveva debiti di gioco', 'Era accusato di eresia', 'Aveva rubato un quadro', 'Era ricercato per stregoneria'],
    bluff: 4
  },
  {
    id: 'q100',
    question: 'Come dipingeva Jackson Pollock i suoi quadri più famosi?',
    correctAnswer: 'Facendo gocciolare il colore',
    category: 'Arte',
    difficulty: 3,
    explanation: 'Stendeva la tela sul pavimento e ci faceva colare sopra la vernice da bastoni, pennelli induriti e barattoli bucati: la tecnica si chiama "dripping".',
    fallbackDecoys: ['Sparando con una pistola ad acqua', 'Usando le mani come pennelli', 'Rotolandosi sulla tela', 'Soffiando il colore con una cannuccia', 'Con gli occhi bendati'],
    bluff: 4
  },

  // ================= MUSICA =================
  {
    id: 'q101',
    question: 'Che cosa si sente durante il brano "4′33″" di John Cage?',
    correctAnswer: 'Solo silenzio',
    category: 'Musica',
    difficulty: 4,
    explanation: 'Per 4 minuti e 33 secondi l\'esecutore non suona nulla: la "musica" sono i rumori della sala, del pubblico e dell\'ambiente.',
    fallbackDecoys: ['Una sola nota ripetuta', 'Il ticchettio di un metronomo', 'Un nastro al contrario', 'Il battito del cuore del pianista', 'Una sirena'],
    bluff: 4
  },
  {
    id: 'q102',
    question: 'Quale strumento suonava Sherlock Holmes?',
    correctAnswer: 'Il violino',
    category: 'Musica',
    difficulty: 2,
    explanation: 'Nei romanzi di Arthur Conan Doyle, Holmes suona il violino per pensare: dice di averne comprato uno Stradivari da un rigattiere per pochi scellini.',
    fallbackDecoys: ['Il pianoforte', 'Il violoncello', 'Il flauto traverso', "L'oboe", "L'arpa"],
    bluff: 3
  },
  {
    id: 'q103',
    question: "Di che nazionalità era l'inventore del sassofono?",
    correctAnswer: 'Belga',
    category: 'Musica',
    difficulty: 4,
    explanation: 'Adolphe Sax, nato a Dinant, lo brevettò nel 1846: voleva unire la potenza degli ottoni all\'agilità dei legni.',
    fallbackDecoys: ['Francese', 'Tedesca', 'Austriaca', 'Olandese', 'Statunitense'],
    bluff: 4
  },
  {
    id: 'q104',
    question: 'Dove fecero i Beatles il loro ultimo concerto pubblico, nel 1969?',
    correctAnswer: 'Sul tetto di un palazzo',
    category: 'Musica',
    difficulty: 4,
    explanation: 'Il 30 gennaio 1969 suonarono sul tetto della loro casa discografica, a Londra, finché la polizia non salì a interromperli.',
    fallbackDecoys: ['In un pub di Liverpool', 'Su un battello sul Tamigi', 'In una stazione della metro', 'In un circo', 'In una chiesa sconsacrata'],
    bluff: 4
  },
  {
    id: 'q105',
    question: 'Quanti tasti ha un pianoforte moderno standard?',
    correctAnswer: '88',
    category: 'Musica',
    difficulty: 4,
    explanation: '52 bianchi e 36 neri, per poco più di sette ottave: lo standard si è fissato alla fine dell\'Ottocento.',
    fallbackDecoys: ['72', '96', '100', '64', '76'],
    bluff: 3
  },
  {
    id: 'q106',
    question: 'Come si chiama il violino di Niccolò Paganini, conservato a Genova?',
    correctAnswer: 'Il Cannone',
    category: 'Musica',
    difficulty: 5,
    explanation: 'Paganini lo chiamava così per la potenza del suono; lo lasciò alla città di Genova, che ogni tanto lo fa suonare ai vincitori del premio a lui dedicato.',
    fallbackDecoys: ['Il Diavolo', 'La Fiamma', 'Il Corsaro', 'La Tempesta', 'Il Fulmine'],
    bluff: 5
  },
  {
    id: 'q107',
    question: 'Quale strumento ha un nome che in hawaiano, secondo la traduzione più diffusa, vuol dire "pulce che salta"?',
    correctAnswer: "L'ukulele",
    category: 'Musica',
    difficulty: 4,
    explanation: 'Lo portarono alle Hawaii gli immigrati portoghesi nell\'Ottocento; il nome forse veniva dal movimento rapidissimo delle dita sulle corde.',
    fallbackDecoys: ['Il banjo', 'Il mandolino', 'La balalaika', 'Il bouzouki', 'Il sitar'],
    bluff: 4
  },
  {
    id: 'q108',
    question: "Quanti anni aveva Goffredo Mameli quando scrisse il testo dell'inno d'Italia?",
    correctAnswer: '20',
    category: 'Musica',
    difficulty: 5,
    explanation: 'Mameli scrisse "Il Canto degli Italiani" nell\'autunno del 1847, a vent\'anni; morì meno di due anni dopo, ferito mentre difendeva la Repubblica Romana.',
    fallbackDecoys: ['35', '17', '42', '28', '61'],
    bluff: 4
  },
  {
    id: 'q109',
    question: 'Qual è il primo strumento musicale suonato nello spazio, nel 1965?',
    correctAnswer: "Un'armonica a bocca",
    category: 'Musica',
    difficulty: 4,
    explanation: 'Gli astronauti della Gemini 6 annunciarono di aver avvistato un "oggetto" con otto moduli davanti, poi suonarono "Jingle Bells" con un\'armonica e dei campanellini.',
    fallbackDecoys: ['Un ukulele', 'Un flauto dolce', 'Una chitarra', 'Un violino', 'Un kazoo'],
    bluff: 4
  },

  // ================= CINEMA =================
  {
    id: 'q110',
    question: 'Che cosa si usò come sangue nella scena della doccia di "Psycho" (1960)?',
    correctAnswer: 'Sciroppo di cioccolato',
    category: 'Cinema',
    difficulty: 4,
    explanation: 'Il film era in bianco e nero: lo sciroppo di cioccolato era più denso del sangue finto e, scendendo nello scarico, sembrava più vero.',
    fallbackDecoys: ['Succo di barbabietola', 'Salsa di pomodoro', 'Vino rosso', 'Inchiostro diluito', 'Sciroppo di amarena'],
    bluff: 4
  },
  {
    id: 'q111',
    question: 'Come chiamava la troupe lo squalo meccanico de "Lo squalo" (1975)?',
    correctAnswer: 'Bruce',
    category: 'Cinema',
    difficulty: 5,
    explanation: 'Spielberg lo battezzò come il suo avvocato. Il modello si rompeva di continuo, così lo squalo si vede pochissimo: e il film ci guadagnò in tensione.',
    fallbackDecoys: ['Jaws', 'Steve', 'Big Mike', 'Mister Teeth', 'Chomper'],
    bluff: 5
  },
  {
    id: 'q112',
    question: 'Chi prestava la voce originale a Darth Vader nella prima trilogia di "Star Wars"?',
    correctAnswer: 'James Earl Jones',
    category: 'Cinema',
    difficulty: 4,
    explanation: 'Dentro il costume c\'era il culturista David Prowse, ma la voce era di James Earl Jones, che all\'inizio chiese di non comparire nei titoli.',
    fallbackDecoys: ['Christopher Lee', 'Orson Welles', 'Morgan Freeman', 'Sean Connery', 'Peter Cushing'],
    bluff: 3
  },
  {
    id: 'q113',
    question: 'Di che colore erano le scarpette di Dorothy nel libro "Il meraviglioso mago di Oz", prima che il film del 1939 le facesse rosse?',
    correctAnswer: "D'argento",
    category: 'Cinema',
    difficulty: 4,
    explanation: 'Nel romanzo di L. Frank Baum (1900) erano d\'argento: la MGM le fece color rubino per sfruttare al massimo il Technicolor.',
    fallbackDecoys: ['Dorate', 'Di cristallo', 'Verde smeraldo', 'Blu', 'Bianche'],
    bluff: 4
  },
  {
    id: 'q114',
    question: 'Che cosa cucina e mangia Charlot, affamato, ne "La febbre dell\'oro" (1925)?',
    correctAnswer: 'Una scarpa',
    category: 'Cinema',
    difficulty: 3,
    explanation: 'Bloccato nella capanna dalla neve, Charlot bollisce il suo scarpone e lo mangia come una bistecca, lacci compresi: sul set era di liquirizia.',
    fallbackDecoys: ['Una candela', 'Il suo cappello', 'Una cintura di cuoio', 'Il suo bastone', 'Un guanto'],
    bluff: 4
  },
  {
    id: 'q115',
    question: 'Qual è stato il primo lungometraggio animato della Disney, nel 1937?',
    correctAnswer: 'Biancaneve e i sette nani',
    category: 'Cinema',
    difficulty: 2,
    explanation: 'Lo chiamavano "la follia di Disney": tutti prevedevano un fiasco, e invece incassò cifre da record.',
    fallbackDecoys: ['Pinocchio', 'La bella addormentata', 'Fantasia', 'Dumbo', 'Bambi'],
    bluff: 3
  },

  // ================= SPORT =================
  {
    id: 'q116',
    question: 'Quale presidente degli Stati Uniti è nella Hall of Fame della lotta libera americana?',
    correctAnswer: 'Abraham Lincoln',
    category: 'Sport',
    difficulty: 4,
    explanation: 'Da giovane Lincoln era un lottatore temuto: si racconta di circa 300 incontri con una sola sconfitta. Nel 1992 è entrato nella National Wrestling Hall of Fame.',
    fallbackDecoys: ['Ronald Reagan', 'John F. Kennedy', 'Ulysses S. Grant', 'George W. Bush', 'Barack Obama'],
    bluff: 5
  },
  {
    id: 'q117',
    question: 'Che cosa usò James Naismith come canestri, quando inventò il basket nel 1891?',
    correctAnswer: 'Due cesti da pesche',
    category: 'Sport',
    difficulty: 3,
    explanation: 'Li appese alla balconata della palestra: avevano il fondo chiuso, e dopo ogni canestro qualcuno doveva salire a riprendere il pallone.',
    fallbackDecoys: ['Due secchi per il latte', 'Due cappelli rovesciati', 'Due reti da pesca', 'Due cestini della carta', 'Due bidoni della spazzatura'],
    bluff: 4
  },
  {
    id: 'q118',
    question: "Di che cosa erano imbottite le palline da golf di cuoio usate prima dell'Ottocento?",
    correctAnswer: "Di piume d'oca",
    category: 'Sport',
    difficulty: 4,
    explanation: 'Le piume, bollite e pressate bagnate in un sacchetto di cuoio, asciugando si gonfiavano e rendevano la pallina dura: per una pallina ne serviva un cappello a cilindro pieno.',
    fallbackDecoys: ['Di sughero', 'Di crine di cavallo', 'Di segatura', 'Di lana di pecora', 'Di sabbia'],
    bluff: 4
  },
  {
    id: 'q119',
    question: 'Quale sport fu inventato nel 1895 come alternativa meno faticosa al basket?',
    correctAnswer: 'La pallavolo',
    category: 'Sport',
    difficulty: 4,
    explanation: 'William G. Morgan lo pensò per gli uomini d\'affari della YMCA e lo chiamò "Mintonette"; il nome "volleyball" arrivò l\'anno dopo.',
    fallbackDecoys: ['Il badminton', 'Il tennistavolo', 'La pallamano', 'Il softball', 'Il pickleball'],
    bluff: 3
  },
  {
    id: 'q120',
    question: "Nel judo, come si chiama il punto pieno che chiude subito l'incontro?",
    correctAnswer: 'Ippon',
    category: 'Sport',
    difficulty: 2,
    explanation: '"Ippon" vuol dire "un punto": si ottiene con una proiezione perfetta, con un\'immobilizzazione di 20 secondi o quando l\'avversario cede.',
    fallbackDecoys: ['Waza-ari', 'Banzai', 'Kiai', 'Tatami', 'Hajime'],
    bluff: 3
  },
  {
    id: 'q121',
    question: 'Perché le palline da tennis, un tempo bianche, sono diventate gialle?',
    correctAnswer: 'Si vedevano meglio in TV',
    category: 'Sport',
    difficulty: 4,
    explanation: 'Nel 1972 la federazione internazionale introdusse il giallo perché si vedeva meglio nelle trasmissioni a colori; Wimbledon si adeguò solo nel 1986.',
    fallbackDecoys: ['Per non confonderle con le righe', 'Per un vecchio sponsor', 'Per spaventare i piccioni', 'Il feltro bianco costava di più', 'Per non abbagliare i giocatori'],
    bluff: 5
  },

  // ================= TECNOLOGIA =================
  {
    id: 'q122',
    question: 'Che cosa produceva Nintendo quando fu fondata, nel 1889?',
    correctAnswer: 'Carte da gioco',
    category: 'Tecnologia',
    difficulty: 4,
    explanation: 'Nintendo nacque a Kyoto producendo carte hanafuda dipinte a mano; prima dei videogiochi provò anche con taxi, riso istantaneo e alberghi a ore.',
    fallbackDecoys: ['Giocattoli di legno', 'Ombrelli', 'Ventagli di carta', 'Bambole di porcellana', 'Aquiloni'],
    bluff: 4
  },
  {
    id: 'q123',
    question: 'Come si chiamava Google nel 1996, prima di prendere il nome attuale?',
    correctAnswer: 'BackRub',
    category: 'Tecnologia',
    difficulty: 5,
    explanation: 'Larry Page e Sergey Brin lo chiamarono BackRub perché analizzava i "backlink", i collegamenti da una pagina all\'altra.',
    fallbackDecoys: ['SearchMe', 'PageFinder', 'WebBrain', 'NetScout', 'FindIt'],
    bluff: 5
  },
  {
    id: 'q124',
    question: 'Che cosa trovarono i tecnici di Harvard dentro un computer nel 1947, annotandolo come "il primo vero caso di bug"?',
    correctAnswer: 'Una falena',
    category: 'Tecnologia',
    difficulty: 3,
    explanation: 'La incollarono sul registro con la nota "First actual case of bug being found": la parola "bug" per i guasti esisteva già, ma da lì divenne famosa.',
    fallbackDecoys: ['Uno scarafaggio', 'Un topolino', 'Una lucertola', 'Una cavalletta', 'Un ragno'],
    bluff: 4
  },
  {
    id: 'q125',
    question: 'Che cosa vendeva Amazon quando nacque, nel 1994?',
    correctAnswer: 'Libri',
    category: 'Tecnologia',
    difficulty: 2,
    explanation: 'Jeff Bezos fondò Amazon nel garage di casa vendendo solo libri online: all\'inizio una campanella suonava a ogni ordine.',
    fallbackDecoys: ['CD musicali', 'Computer usati', 'Biglietti aerei', 'Videocassette', 'Giocattoli'],
    bluff: 3
  },
  {
    id: 'q126',
    question: 'Che oggetto rappresenta l\'icona "Salva" in quasi tutti i programmi?',
    correctAnswer: 'Un floppy disk',
    category: 'Tecnologia',
    difficulty: 1,
    explanation: 'È il dischetto da 3,5 pollici, usato fino ai primi anni Duemila: per molti ragazzi esiste solo come icona.',
    fallbackDecoys: ['Una cassaforte', 'Una cartella', 'Un hard disk', 'Una scatola', 'Un cassetto'],
    bluff: 2
  },
  {
    id: 'q127',
    question: "Che cosa c'era scritto nel primo SMS della storia, nel 1992?",
    correctAnswer: 'Merry Christmas',
    category: 'Tecnologia',
    difficulty: 4,
    explanation: 'Il 3 dicembre 1992 l\'ingegnere Neil Papworth lo mandò da un computer a un cellulare Vodafone; il destinatario non poté rispondere, perché i telefoni non sapevano ancora scriverli.',
    fallbackDecoys: ['Hello World', 'Ciao mamma', 'Are you there?', 'Test 1 2 3', 'Happy New Year'],
    bluff: 4
  },
  {
    id: 'q128',
    question: "Quanta memoria di lavoro aveva il computer di bordo dell'Apollo 11?",
    correctAnswer: 'Circa 4 kilobyte',
    category: 'Tecnologia',
    difficulty: 5,
    explanation: 'L\'Apollo Guidance Computer aveva 2.048 parole di memoria scrivibile, circa 4 KB: oggi una semplice email ne occupa di più.',
    fallbackDecoys: ['Circa 4 megabyte', 'Circa 64 kilobyte', 'Circa 1 gigabyte', 'Circa 512 byte', 'Circa 128 megabyte'],
    bluff: 4
  },
  {
    id: 'q129',
    question: 'Qual è stato il primo dominio ".com" registrato, nel 1985?',
    correctAnswer: 'symbolics.com',
    category: 'Tecnologia',
    difficulty: 6,
    explanation: 'Lo registrò il 15 marzo 1985 la Symbolics, un\'azienda di computer del Massachusetts; oggi è un piccolo sito-museo.',
    fallbackDecoys: ['apple.com', 'ibm.com', 'internet.com', 'hp.com', 'xerox.com'],
    bluff: 4
  },

  // ================= OGGETTI =================
  {
    id: 'q130',
    question: 'Perché il cappuccio di molte penne a sfera ha un buchino?',
    correctAnswer: 'Per respirare se lo si ingoia',
    category: 'Oggetti',
    difficulty: 3,
    explanation: 'Se un bambino lo ingoia per sbaglio, il foro lascia passare un po\' d\'aria: è una norma di sicurezza adottata da molti produttori.',
    fallbackDecoys: ["Per non far seccare l'inchiostro", 'Per appenderlo al portachiavi', 'Per risparmiare plastica', 'Per fischiare', 'Per farlo raffreddare in fabbrica'],
    bluff: 4
  },
  {
    id: 'q131',
    question: 'A che cosa serviva, in origine, il taschino piccolo dei jeans?',
    correctAnswer: "A tenere l'orologio da tasca",
    category: 'Oggetti',
    difficulty: 3,
    explanation: 'Levi\'s lo aggiunse nell\'Ottocento per cowboy e minatori, che portavano l\'orologio da taschino con la catenella.',
    fallbackDecoys: ['A tenere i fiammiferi', 'A tenere le pepite', 'A tenere i bossoli', 'A tenere la gomma da masticare', 'A tenere i biglietti del treno'],
    bluff: 4
  },
  {
    id: 'q132',
    question: 'Su una crema, che cosa indica il disegno di un barattolo aperto con scritto "12M"?',
    correctAnswer: "Dura 12 mesi dopo l'apertura",
    category: 'Oggetti',
    difficulty: 3,
    explanation: 'Si chiama PAO, "Period After Opening": passato quel tempo dall\'apertura, il prodotto può alterarsi anche se non è ancora scaduto.',
    fallbackDecoys: ['Adatta dai 12 mesi di età', 'Contiene 12 millilitri', 'Testata per 12 mesi', 'Si usa per 12 settimane', 'Protezione solare 12'],
    bluff: 4
  },
  {
    id: 'q133',
    question: 'Da dove prende il nome il frisbee?',
    correctAnswer: 'Da una ditta di torte',
    category: 'Oggetti',
    difficulty: 4,
    explanation: 'Gli studenti del New England si lanciavano le teglie vuote della Frisbie Pie Company; il produttore del disco di plastica cambiò una lettera e ne fece un marchio.',
    fallbackDecoys: ['Da un cane da riporto', 'Da un pianeta immaginario', 'Dal suo inventore', 'Da un ballo degli anni Cinquanta', 'Da un cartone animato'],
    bluff: 5
  },
  {
    id: 'q134',
    question: 'A che cosa serve il buchino nei finestrini degli aerei?',
    correctAnswer: 'A equilibrare la pressione',
    category: 'Oggetti',
    difficulty: 4,
    explanation: 'Il foro, nel vetro centrale, fa sì che sia quello esterno a reggere la differenza di pressione in quota; in più evita che il finestrino si appanni.',
    fallbackDecoys: ['A ridurre il rumore', 'A far passare il segnale del telefono', 'A drenare la pioggia', 'A far respirare i passeggeri', 'A misurare la velocità'],
    bluff: 4
  },
  {
    id: 'q135',
    question: 'Perché i tasti F e J della tastiera hanno un piccolo rilievo?',
    correctAnswer: 'Per trovarli senza guardare',
    category: 'Oggetti',
    difficulty: 2,
    explanation: 'Lì si appoggiano gli indici nella dattilografia: grazie al rilievo si sistemano le mani sulla tastiera a occhi chiusi.',
    fallbackDecoys: ['Per segnare i tasti più usati', 'Per pulire la tastiera', 'Per distinguere le tastiere italiane', "Per scaricare l'elettricità statica", 'Per un difetto di fabbrica'],
    bluff: 3
  },
  {
    id: 'q136',
    question: 'Perché gli scontrini sbiadiscono fino a diventare bianchi?',
    correctAnswer: 'Sono di carta termica',
    category: 'Oggetti',
    difficulty: 2,
    explanation: 'Non c\'è inchiostro: la carta termica annerisce dove la stampante la scalda. Con luce, calore e tempo la scritta svanisce.',
    fallbackDecoys: ["Usano inchiostro all'acqua", 'Per legge devono scadere', 'Sono stampati al contrario', 'Il sudore delle mani li cancella', 'Sono di carta riciclata'],
    bluff: 3
  },
  {
    id: 'q137',
    question: 'Da dove viene il nome della moka?',
    correctAnswer: 'Da un porto dello Yemen',
    category: 'Oggetti',
    difficulty: 4,
    explanation: 'Moka, o Mokha, era il porto yemenita da cui partiva uno dei caffè più pregiati; Alfonso Bialetti brevettò la sua caffettiera nel 1933.',
    fallbackDecoys: ['Dal nome della moglie di Bialetti', 'Da un modo di dire piemontese', 'Da una marca di cioccolato', 'Dal rumore del caffè che sale', 'Da un vulcano africano'],
    bluff: 5
  },

  // ================= RECORD =================
  {
    id: 'q138',
    question: 'Qual è il vertebrato più longevo conosciuto, che può superare i 250 anni?',
    correctAnswer: 'Lo squalo della Groenlandia',
    category: 'Record',
    difficulty: 5,
    explanation: 'Nel 2016 un gruppo di ricercatori ne ha stimato l\'età dal cristallino degli occhi: il più anziano avrebbe almeno 270 anni. Diventano adulti solo verso i 150.',
    fallbackDecoys: ['La tartaruga delle Galápagos', 'La balena della Groenlandia', 'Lo storione beluga', "L'elefante asiatico", 'Il pappagallo cacatua'],
    bluff: 4
  },
  {
    id: 'q139',
    question: 'Come si chiama la cascata più alta del mondo, con un salto di quasi un chilometro?',
    correctAnswer: 'Il Salto Angel',
    category: 'Record',
    difficulty: 4,
    explanation: 'Il Salto Angel, in Venezuela, precipita per 979 metri; prende il nome dall\'aviatore Jimmie Angel, che la sorvolò negli anni Trenta.',
    fallbackDecoys: ['Le cascate Vittoria', 'Le cascate di Tugela', 'Le cascate Iguazú', 'Le cascate del Niagara', 'Le cascate di Yosemite'],
    bluff: 3
  },
  {
    id: 'q140',
    question: "Come si chiama l'albero più alto del mondo, una sequoia californiana di oltre 115 metri?",
    correctAnswer: 'Hyperion',
    category: 'Record',
    difficulty: 6,
    explanation: 'Fu scoperto nel 2006 in un parco della California: la sua posizione è tenuta riservata, e chi prova a raggiungerlo rischia una multa salata.',
    fallbackDecoys: ['Generale Sherman', 'Titano', 'Gran Padre', 'Matusalemme', 'Gigante Rosso'],
    bluff: 5
  },
  {
    id: 'q141',
    question: "Quale uccello ha l'apertura alare più grande, fino a oltre tre metri e mezzo?",
    correctAnswer: "L'albatro urlatore",
    category: 'Record',
    difficulty: 4,
    explanation: 'L\'albatro urlatore può superare i 3,5 metri da una punta all\'altra delle ali e plana per ore sugli oceani del sud quasi senza batterle.',
    fallbackDecoys: ['Il condor delle Ande', "L'aquila arpia", 'Il gufo reale', 'Il pellicano bruno', "L'avvoltoio grifone"],
    bluff: 3
  },
  {
    id: 'q142',
    question: 'Qual è stato il primo paese al mondo a dare il voto alle donne nelle elezioni nazionali, nel 1893?',
    correctAnswer: 'La Nuova Zelanda',
    category: 'Record',
    difficulty: 4,
    explanation: 'Nel 1893 la Nuova Zelanda, allora colonia britannica autonoma, concesse il voto alle donne dopo una petizione guidata da Kate Sheppard, oggi sulla banconota da 10 dollari.',
    fallbackDecoys: ['La Finlandia', 'La Norvegia', "L'Australia", 'La Svezia', 'Il Regno Unito'],
    bluff: 3
  },
  {
    id: 'q143',
    question: 'Qual è il fiore singolo più grande del mondo, che arriva a un metro di diametro e puzza di carne marcia?',
    correctAnswer: 'La Rafflesia',
    category: 'Record',
    difficulty: 5,
    explanation: 'La Rafflesia arnoldii cresce nelle foreste di Sumatra e del Borneo, parassita di una liana: non ha foglie né radici, e il suo odore attira le mosche che la impollinano.',
    fallbackDecoys: ['La Victoria amazonica', 'La magnolia gigante', 'Il loto indiano', "L'orchidea tigre", 'La regina delle Ande'],
    bluff: 4
  },

  // ================= MITI E LEGGENDE =================
  {
    id: 'q144',
    question: 'In quale fiume dovette bagnarsi re Mida per liberarsi del suo "tocco d\'oro"?',
    correctAnswer: 'Il Pattolo',
    category: 'Miti e leggende',
    difficulty: 6,
    explanation: 'Dioniso gli disse di lavarsi nel Pattolo, in Lidia: il potere passò al fiume, che da allora, secondo il mito, trascinava sabbie d\'oro.',
    fallbackDecoys: ['Lo Scamandro', 'Il Meandro', "L'Alfeo", "L'Acheronte", 'Il Lete'],
    bluff: 4
  },
  {
    id: 'q145',
    question: 'Che cosa ha sulla testa il kappa, il folletto acquatico del folklore giapponese?',
    correctAnswer: "Una conca piena d'acqua",
    category: 'Miti e leggende',
    difficulty: 5,
    explanation: 'Se l\'acqua della conca si rovescia, il kappa perde le forze: per batterlo basta fargli un inchino, perché lui, educatissimo, lo ricambia.',
    fallbackDecoys: ['Un fiore di loto', "Un corno d'oro", 'Una lanterna accesa', 'Un nido di rondini', 'Un ciuffo di alghe'],
    bluff: 5
  },
  {
    id: 'q146',
    question: 'Secondo Esiodo, da che cosa nacque Afrodite?',
    correctAnswer: 'Dalla spuma del mare',
    category: 'Miti e leggende',
    difficulty: 2,
    explanation: 'La schiuma si formò dove caddero i genitali di Urano, mutilato dal figlio Crono: per i Greci il nome Afrodite richiamava "aphrós", schiuma.',
    fallbackDecoys: ["Da una conchiglia d'oro", 'Dalla testa di Zeus', 'Da una goccia di rugiada', 'Da una rosa', 'Da un raggio di luna'],
    bluff: 4
  },
  {
    id: 'q147',
    question: 'Secondo Thomas Malory, chi consegnò ad Artù la spada Excalibur?',
    correctAnswer: 'La Dama del Lago',
    category: 'Miti e leggende',
    difficulty: 2,
    explanation: 'Nella "Morte di Artù" di Malory la spada estratta dalla roccia si spezza: Excalibur gliela dona la Dama del Lago, a cui tornerà alla fine.',
    fallbackDecoys: ['La fata Morgana', 'Il re pescatore', 'Sir Lancillotto', 'Il re Uther', 'La regina Ginevra'],
    bluff: 3
  },
  {
    id: 'q148',
    question: 'Secondo la tradizione napoletana, che cosa lascia il munaciello nelle case a cui si affeziona?',
    correctAnswer: 'Delle monete',
    category: 'Miti e leggende',
    difficulty: 4,
    explanation: 'Il munaciello, piccolo spirito vestito col saio, fa dispetti a chi non gli va a genio e lascia soldi a chi gli è simpatico. Chi li trova, però, non deve dirlo a nessuno.',
    fallbackDecoys: ['Un corno rosso', 'Un pezzo di pastiera', 'Un numero da giocare al lotto', 'Una candela accesa', 'Un ferro di cavallo'],
    bluff: 5
  },
  {
    id: 'q149',
    question: "Nella mitologia norrena, come si chiama l'albero cosmico che collega i nove mondi?",
    correctAnswer: 'Yggdrasil',
    category: 'Miti e leggende',
    difficulty: 5,
    explanation: 'Yggdrasil è un immenso frassino: alle sue radici un drago le rosicchia, e lì vicino tre Norne filano il destino di uomini e dèi.',
    fallbackDecoys: ['Bifröst', 'Ginnungagap', 'Asgardur', 'Valaskjálf', 'Gjallarhorn'],
    bluff: 4
  },
  {
    id: 'q150',
    question: "Secondo Tito Livio, quali animali salvarono il Campidoglio dall'assalto notturno dei Galli?",
    correctAnswer: 'Le oche',
    category: 'Miti e leggende',
    difficulty: 2,
    explanation: 'Le oche sacre a Giunone starnazzarono e svegliarono Marco Manlio, che respinse gli assalitori. I cani di guardia, racconta Livio, non se ne accorsero nemmeno.',
    fallbackDecoys: ['I cani', 'I corvi', 'I cavalli', 'Le galline', 'I gatti'],
    bluff: 3
  },

  // ================= CURIOSITÀ =================
  {
    id: 'q151',
    question: "Qual è l'unica lettera dell'alfabeto inglese che non compare nel nome di nessuno dei 50 stati USA?",
    correctAnswer: 'La Q',
    category: 'Curiosità',
    difficulty: 5,
    explanation: 'C\'è la Z dell\'Arizona, la X del Texas, la J del New Jersey: solo la Q manca in tutti e 50 i nomi.',
    fallbackDecoys: ['La Z', 'La X', 'La J', 'La K', 'La W'],
    bluff: 5
  },
  {
    id: 'q152',
    question: 'Quanto fa sempre la somma delle facce opposte di un normale dado da gioco?',
    correctAnswer: '7',
    category: 'Curiosità',
    difficulty: 3,
    explanation: 'L\'1 è opposto al 6, il 2 al 5 e il 3 al 4: è una convenzione antichissima, rispettata già da molti dadi dell\'epoca romana.',
    fallbackDecoys: ['6', '9', '8', '5', '10'],
    bluff: 3
  },
  {
    id: 'q153',
    question: 'In mare, che cosa misura il "nodo"?',
    correctAnswer: 'La velocità',
    category: 'Curiosità',
    difficulty: 2,
    explanation: 'Un nodo è un miglio nautico all\'ora, circa 1,85 km/h: il nome viene dalla cordicella a nodi che i marinai calavano in acqua per contare quanto correva la nave.',
    fallbackDecoys: ['La profondità', 'La distanza', "L'altezza delle onde", 'La forza del vento', 'La rotta'],
    bluff: 3
  },
  {
    id: 'q154',
    question: 'Come si chiama la paura del numero 13?',
    correctAnswer: 'Triscaidecafobia',
    category: 'Curiosità',
    difficulty: 4,
    explanation: 'Viene dal greco "treiskaídeka", tredici: è tanto diffusa che molti grattacieli americani non hanno il 13° piano.',
    fallbackDecoys: ['Tredecifobia', 'Numerofobia', 'Decatrifobia', 'Aritmofobia', 'Iscatofobia'],
    bluff: 5
  },
  {
    id: 'q155',
    question: "Quanto pesa, più o meno, l'acqua contenuta in una nuvola cumulo di medie dimensioni?",
    correctAnswer: 'Circa 500 tonnellate',
    category: 'Curiosità',
    difficulty: 5,
    explanation: 'Un cumulo di un chilometro cubo contiene circa 500 tonnellate d\'acqua in goccioline minuscole, così leggere da restare sospese nelle correnti d\'aria.',
    fallbackDecoys: ['Circa 5 chili', 'Circa 50 chili', 'Circa 5 tonnellate', 'Circa 50.000 tonnellate', 'Circa 500 grammi'],
    bluff: 4
  },
  {
    id: 'q156',
    question: 'Da quante pezze è fatto il classico pallone da calcio a pentagoni neri ed esagoni bianchi?',
    correctAnswer: '32',
    category: 'Curiosità',
    difficulty: 4,
    explanation: 'Dodici pentagoni neri e venti esagoni bianchi: è il disegno del Telstar, il pallone dei Mondiali del 1970, pensato per vedersi bene nelle TV in bianco e nero.',
    fallbackDecoys: ['24', '36', '42', '28', '20'],
    bluff: 4
  },
  {
    id: 'q157',
    question: 'Da che cosa dipende il colore del guscio delle uova di gallina?',
    correctAnswer: 'Dalla razza della gallina',
    category: 'Curiosità',
    difficulty: 3,
    explanation: 'Il colore del guscio è scritto nei geni della razza e non cambia né il sapore né i valori nutrizionali: un uovo marrone non è più "genuino" di uno bianco.',
    fallbackDecoys: ['Da cosa mangia la gallina', 'Da quanta acqua beve', 'Dal sesso del pulcino', 'Dalla luce del pollaio', 'Dal tipo di paglia del nido'],
    bluff: 4
  },

  // ================= ETIMOLOGIA =================
  {
    id: 'q158',
    question: 'Da quale espressione veneziana deriva il saluto "ciao"?',
    correctAnswer: 'Schiavo vostro',
    category: 'Etimologia',
    difficulty: 3,
    explanation: 'In veneziano "s\'ciavo vostro" voleva dire "sono al vostro servizio": accorciato in "s\'ciao" e poi "ciao", è diventato il saluto italiano più famoso al mondo.',
    fallbackDecoys: ['Cara anima', 'Ci vediamo', 'Caro amico', 'Che allegria', 'Ciò che vuoi'],
    bluff: 4
  },
  {
    id: 'q159',
    question: 'Da quale città italiana prende il nome la parola "jeans"?',
    correctAnswer: 'Genova',
    category: 'Etimologia',
    difficulty: 2,
    explanation: 'Il robusto tessuto blu dei marinai genovesi in Francia si chiamava "bleu de Gênes", blu di Genova: da lì "jeans".',
    fallbackDecoys: ['Napoli', 'Venezia', 'Livorno', 'Trieste', 'La Spezia'],
    funFact: 'Il "denim", invece, viene dalla città francese di Nîmes: "de Nîmes".',
    bluff: 3
  },
  {
    id: 'q160',
    question: 'Da dove viene la parola "quarantena"?',
    correctAnswer: 'Dai 40 giorni di isolamento',
    category: 'Etimologia',
    difficulty: 2,
    explanation: 'Durante le epidemie di peste, a Venezia e in altri porti le navi sospette dovevano restare isolate quaranta giorni prima di far sbarcare uomini e merci.',
    fallbackDecoys: ['Dalla Quaresima', 'Dal nome di un medico', 'Dai 40 ladroni', "Da un'isola greca", 'Dal latino "quaerere"'],
    bluff: 3
  },
  {
    id: 'q161',
    question: 'Chi era Charles Boycott, da cui viene il verbo "boicottare"?',
    correctAnswer: 'Un amministratore di terre',
    category: 'Etimologia',
    difficulty: 4,
    explanation: 'Nel 1880 i contadini irlandesi in lotta per gli affitti smisero di lavorare e commerciare con lui: il suo cognome diventò un verbo in mezza Europa.',
    fallbackDecoys: ['Un industriale del tabacco', 'Un arbitro di rugby', 'Un politico americano', 'Un banchiere di Londra', 'Un mercante di tè'],
    bluff: 4
  },
  {
    id: 'q162',
    question: 'Che cosa significa, alla lettera, la parola "dinosauro"?',
    correctAnswer: 'Lucertola terribile',
    category: 'Etimologia',
    difficulty: 2,
    explanation: 'La coniò il paleontologo Richard Owen nel 1842, dal greco "deinós", terribile, e "sâuros", lucertola.',
    fallbackDecoys: ['Drago antico', 'Gigante della terra', 'Rettile del tuono', 'Bestia primitiva', 'Re dei rettili'],
    bluff: 4
  },
  {
    id: 'q163',
    question: 'Da quale lingua arriva la parola "tabù"?',
    correctAnswer: 'Dal tongano',
    category: 'Etimologia',
    difficulty: 5,
    explanation: 'James Cook la sentì alle isole Tonga nel 1777: "tapu" indicava ciò che era sacro e proibito toccare.',
    fallbackDecoys: ["Dall'arabo", 'Dal giapponese', "Dall'hindi", 'Dal turco', 'Dallo swahili'],
    bluff: 4
  },
  {
    id: 'q164',
    question: 'Che cosa significa in giapponese la parola "emoji"?',
    correctAnswer: 'Immagine-carattere',
    category: 'Etimologia',
    difficulty: 4,
    explanation: '"E" significa immagine e "moji" carattere: la somiglianza con "emozione" è una pura coincidenza.',
    fallbackDecoys: ['Faccina felice', 'Emozione scritta', 'Piccolo volto', 'Messaggio colorato', 'Sorriso digitale'],
    bluff: 5
  },
  {
    id: 'q165',
    question: 'Che cosa voleva dire "OK" quando comparve sui giornali di Boston, nel 1839?',
    correctAnswer: 'Oll korrect',
    category: 'Etimologia',
    difficulty: 5,
    explanation: 'A Boston andavano di moda le sigle di parole storpiate per scherzo: "O.K." stava per "oll korrect", cioè "all correct" scritto male.',
    fallbackDecoys: ['Zero killed', 'Old Kentucky', 'Only kidding', 'Open key', 'Order known'],
    bluff: 4
  },
  {
    id: 'q166',
    question: 'Che cosa voleva dire, in origine, la parola "stipendio"?',
    correctAnswer: 'Pesare le monete',
    category: 'Etimologia',
    difficulty: 4,
    explanation: 'Viene dal latino "stips", moneta, e "pendere", pesare: le paghe dei soldati romani si contavano pesando le monete di bronzo.',
    fallbackDecoys: ['Paga del sale', "Dono dell'imperatore", 'Premio del mese', 'Pane per la famiglia', 'Sudore della fronte'],
    bluff: 4
  }
];
