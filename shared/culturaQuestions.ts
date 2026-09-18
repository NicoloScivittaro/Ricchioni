/**
 * CULTURA O CAZZATA? — database domande culturali (espandibile).
 * Ogni domanda: risposta vera + decoy di fallback + spiegazione reale.
 * difficulty 1-2 = facile, 3-4 = media, 5-6 = difficile, 7-8 = molto difficile.
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
}

export const CULTURA_QUESTIONS: CulturaQuestion[] = [
  {
    id: 'q001',
    question: 'Quale animale possiede tre cuori?',
    correctAnswer: 'Il polpo',
    category: 'Biologia',
    difficulty: 4,
    explanation: 'Il polpo ha tre cuori: due pompano il sangue verso le branchie e uno verso il resto del corpo.',
    fallbackDecoys: ['Il nautilus', 'La seppia gigante', 'Il calamaro vampiro'],
    funFact: 'Quando il polpo nuota, il cuore principale rallenta: per questo preferisce camminare sul fondale.'
  },
  {
    id: 'q002',
    question: 'Qual è il vero significato originario della parola "sincero"?',
    correctAnswer: 'Senza cera',
    category: 'Etimologia',
    difficulty: 5,
    explanation: 'Dal latino "sine cera" (senza cera): i vasai romani usavano la cera per nascondere i difetti dei vasi; quelli "sinceri" non avevano riparazioni.',
    fallbackDecoys: ['Dal cuore', 'Senza maschera', 'A voce alta'],
    funFact: 'L\'etimologia è in realtà discussa, ma è la spiegazione tradizionale più diffusa.'
  },
  {
    id: 'q003',
    question: 'Quale pianeta del Sistema Solare ruota su sé stesso in senso retrogrado?',
    correctAnswer: 'Venere',
    category: 'Astronomia',
    difficulty: 4,
    explanation: 'Venere ruota in senso orario (retrogrado), al contrario della maggior parte dei pianeti, e un suo giorno dura più di un suo anno.',
    fallbackDecoys: ['Marte', 'Urano', 'Nettuno'],
    funFact: 'Su Venere il Sole sorge a ovest e tramonta a est.'
  },
  {
    id: 'q004',
    question: 'Quale di questi è un vero elemento chimico?',
    correctAnswer: 'Il tungsteno',
    category: 'Scienza',
    difficulty: 3,
    explanation: 'Il tungsteno (simbolo W, numero atomico 74) è un metallo reale, usato nei filamenti delle lampadine.',
    fallbackDecoys: ['Il vibranio', 'Il mithril', 'L\'adamantio'],
    funFact: 'Il simbolo W deriva dal suo nome tedesco "Wolfram".'
  },
  {
    id: 'q005',
    question: 'In quale anno è caduto il muro di Berlino?',
    correctAnswer: '1989',
    category: 'Storia',
    difficulty: 3,
    explanation: 'Il muro di Berlino cadde il 9 novembre 1989, simbolo della fine della Guerra Fredda.',
    fallbackDecoys: ['1985', '1991', '1987'],
    funFact: 'La caduta iniziò per un errore di comunicazione di un portavoce in una conferenza stampa.'
  },
  {
    id: 'q006',
    question: 'Quale opera è stata realmente scritta da William Shakespeare?',
    correctAnswer: 'Macbeth',
    category: 'Letteratura',
    difficulty: 3,
    explanation: 'Macbeth è una tragedia di Shakespeare, scritta attorno al 1606.',
    fallbackDecoys: ['Il Misantropo', 'Faust', 'Il Gabbiano'],
    funFact: 'Molti attori considerano sfortunato pronunciare il nome "Macbeth" in teatro.'
  },
  {
    id: 'q007',
    question: 'Quale di questi Paesi non esiste davvero?',
    correctAnswer: 'La Ruritania',
    category: 'Geografia',
    difficulty: 2,
    explanation: 'La Ruritania è un regno immaginario creato dallo scrittore Anthony Hope nel romanzo "Il prigioniero di Zenda".',
    fallbackDecoys: ['Il Lesotho', 'Il Bhutan', 'L\'eSwatini'],
    funFact: 'Lesotho è un Paese interamente circondato dal Sudafrica.'
  },
  {
    id: 'q008',
    question: 'Quante ossa ha il corpo umano adulto?',
    correctAnswer: '206',
    category: 'Corpo umano',
    difficulty: 2,
    explanation: 'Un adulto ha 206 ossa; alla nascita ne abbiamo circa 270, poi molte si fondono.',
    fallbackDecoys: ['180', '230', '196'],
    funFact: 'Più della metà delle ossa sono nelle mani e nei piedi.'
  },
  {
    id: 'q009',
    question: 'Quale invenzione è stata creata prima?',
    correctAnswer: 'La ruota',
    category: 'Invenzioni',
    difficulty: 3,
    explanation: 'La ruota risale a circa 3500 a.C., molto prima di carta (II secolo a.C.), vetro soffiato e bussola.',
    fallbackDecoys: ['La carta', 'Il vetro soffiato', 'La bussola magnetica'],
    funFact: 'La bussola magnetica come strumento di navigazione si diffuse in Europa solo nel XIII secolo.'
  },
  {
    id: 'q010',
    question: 'Qual è il vero nome di "Moby Dick"?',
    correctAnswer: 'Un capodoglio',
    category: 'Letteratura',
    difficulty: 4,
    explanation: 'Moby Dick è un capodoglio bianco, non una balena comune, nel romanzo di Herman Melville.',
    fallbackDecoys: ['Una balenottera azzurra', "Un'orca", 'Una megattera'],
    funFact: 'Il romanzo è ispirato alla storia vera di "Mocha Dick", un capodoglio albino.'
  },
  {
    id: 'q011',
    question: 'Quale di questi è un vero sport olimpico (presente o passato)?',
    correctAnswer: 'Il tiro alla fune',
    category: 'Sport',
    difficulty: 5,
    explanation: 'Il tiro alla fune fu disciplina olimpica dal 1900 al 1920.',
    fallbackDecoys: ['La corsa nei sacchi', 'Il lancio del tronco', 'La lotta nel fango'],
    funFact: 'La Gran Bretagna vinse due medaglie d\'oro nel tiro alla fune nel 1908.'
  },
  {
    id: 'q012',
    question: 'Qual è il significato di "ketchup" nella sua origine?',
    correctAnswer: 'Una salsa di pesce fermentato',
    category: 'Alimentazione',
    difficulty: 5,
    explanation: 'Il ketchup deriva da salse di pesce fermentato dell\'Asia (come il "ke-chiap" cinese), poi diventato salsa di pomodoro.',
    fallbackDecoys: ['Pomodoro schiacciato', 'Salsa piccante', 'Succo di carne'],
    funFact: 'Il primo ketchup era marrone, non rosso.'
  },
  {
    id: 'q013',
    question: 'Quale figura mitologica è realmente una divinità della mitologia nordica?',
    correctAnswer: 'Loki',
    category: 'Mitologia',
    difficulty: 3,
    explanation: 'Loki è il dio dell\'inganno nella mitologia norrena.',
    fallbackDecoys: ['Zeus', 'Anubi', 'Quetzalcoatl'],
    funFact: 'Nonostante i film Marvel, Loki nella mitologia non è il fratello di Thor, ma un compagno di avventure.'
  },
  {
    id: 'q014',
    question: 'Qual è la capitale dell\'Australia?',
    correctAnswer: 'Canberra',
    category: 'Geografia',
    difficulty: 3,
    explanation: 'Canberra è la capitale dell\'Australia, scelta come compromesso tra Sydney e Melbourne.',
    fallbackDecoys: ['Sydney', 'Melbourne', 'Perth'],
    funFact: 'Canberra fu costruita apposta come capitale pianificata nel 1913.'
  },
  {
    id: 'q015',
    question: 'Quale di questi musicisti è realmente esistito ed è considerato un grande compositore?',
    correctAnswer: 'Antonio Vivaldi',
    category: 'Musica',
    difficulty: 2,
    explanation: 'Antonio Vivaldi (1678-1741) fu un compositore barocco veneziano, autore delle "Quattro Stagioni".',
    fallbackDecoys: ['Amadeus Weber', 'Johann Strauss III', 'Salieri (nome inventato)'],
    funFact: 'Vivaldi era anche sacerdote: veniva chiamato "il Prete Rosso" per i capelli rossi.'
  },
  {
    id: 'q016',
    question: 'Quale fenomeno causa l\'aurora boreale?',
    correctAnswer: 'Particelle solari che colpiscono l\'atmosfera',
    category: 'Astronomia',
    difficulty: 4,
    explanation: 'Le aurore nascono quando particelle cariche del vento solare interagiscono con il campo magnetico terrestre e i gas atmosferici.',
    fallbackDecoys: ['Il riflesso della Luna', 'Fuochi artici', 'La luce delle stelle'],
    funFact: 'Il colore dipende dal gas: l\'ossigeno dà verde/rosso, l\'azoto blu/viola.'
  },
  {
    id: 'q017',
    question: 'Quale di questi registi ha realmente diretto "2001: Odissea nello spazio"?',
    correctAnswer: 'Stanley Kubrick',
    category: 'Cinema',
    difficulty: 3,
    explanation: '2001: Odissea nello spazio (1968) è diretto da Stanley Kubrick.',
    fallbackDecoys: ['Alfred Hitchcock', 'Francis Ford Coppola', 'Ridley Scott'],
    funFact: 'Kubrick vinse un Oscar per gli effetti speciali, l\'unico Oscar della sua carriera.'
  },
  {
    id: 'q018',
    question: 'Quale sostanza chimica rende le foglie verdi?',
    correctAnswer: 'La clorofilla',
    category: 'Biologia',
    difficulty: 2,
    explanation: 'La clorofilla è il pigmento che assorbe la luce per la fotosintesi e riflette il verde.',
    fallbackDecoys: ['Il carotene', 'La melanina', 'L\'emoglobina'],
    funFact: 'In autunno la clorofilla si degrada e restano visibili i carotenoidi (giallo/arancione).'
  },
  {
    id: 'q019',
    question: 'Qual è il fiume più lungo del mondo?',
    correctAnswer: 'Il Nilo',
    category: 'Geografia',
    difficulty: 3,
    explanation: 'Il Nilo (circa 6.650 km) è tradizionalmente considerato il più lungo, seguito da vicino dal Rio delle Amazzoni.',
    fallbackDecoys: ['Il Rio delle Amazzoni', 'Il Mississippi', 'Il Danubio'],
    funFact: 'La misurazione esatta è ancora dibattuta tra Nilo e Amazzoni.'
  },
  {
    id: 'q020',
    question: 'Quale parola italiana deriva dall\'arabo?',
    correctAnswer: 'Zucchero',
    category: 'Etimologia',
    difficulty: 4,
    explanation: 'Zucchero deriva dall\'arabo "sukkar", a sua volta dal persiano e dal sanscrito.',
    fallbackDecoys: ['Finestra', 'Lavoro', 'Mare'],
    funFact: 'Anche "algebra", "algoritmo" e "magazzino" vengono dall\'arabo.'
  },
  {
    id: 'q021',
    question: 'Quale animale è in grado di rigenerare un arto intero?',
    correctAnswer: 'L\'axolotl',
    category: 'Animali',
    difficulty: 4,
    explanation: 'L\'axolotl, una salamandra messicana, può rigenerare arti, coda e persino parti del cuore e del cervello.',
    fallbackDecoys: ['La lucertola', 'Il geco', 'La tartaruga'],
    funFact: 'L\'axolotl resta per tutta la vita in uno stadio larvale (neotenia).'
  },
  {
    id: 'q022',
    question: 'Chi ha realmente dipinto la "Notte stellata"?',
    correctAnswer: 'Vincent van Gogh',
    category: 'Arte',
    difficulty: 2,
    explanation: 'La "Notte stellata" (1889) è di Vincent van Gogh, dipinta durante il ricovero a Saint-Rémy.',
    fallbackDecoys: ['Claude Monet', 'Paul Cézanne', 'Pablo Picasso'],
    funFact: 'Van Gogh la dipinse guardando dalla finestra della sua stanza, ma aggiunse il villaggio di fantasia.'
  },
  {
    id: 'q023',
    question: 'Qual è il vero significato di "magnum opus"?',
    correctAnswer: 'La grande opera',
    category: 'Lingua',
    difficulty: 3,
    explanation: 'Dal latino, "magnum opus" significa "la grande opera": il capolavoro di un artista.',
    fallbackDecoys: ['Opera d\'arte minore', 'Il primo lavoro', 'Opera incompiuta'],
    funFact: 'Si usa spesso per indicare il lavoro più importante della carriera di qualcuno.'
  },
  {
    id: 'q024',
    question: 'Quale di questi è un vero continente?',
    correctAnswer: 'L\'Oceania',
    category: 'Geografia',
    difficulty: 2,
    explanation: 'L\'Oceania è uno dei continenti, che include Australia, Nuova Zelanda e le isole del Pacifico.',
    fallbackDecoys: ['L\'Atlantide', 'La Lemuria', 'Mu'],
    funFact: 'In alcuni modelli geografici si usa "Australia" invece di "Oceania".'
  },
  {
    id: 'q025',
    question: 'Quale gas è più abbondante nell\'atmosfera terrestre?',
    correctAnswer: 'L\'azoto',
    category: 'Scienza',
    difficulty: 3,
    explanation: 'L\'azoto costituisce circa il 78% dell\'atmosfera, l\'ossigeno circa il 21%.',
    fallbackDecoys: ['L\'ossigeno', 'L\'anidride carbonica', 'L\'idrogeno'],
    funFact: 'Respiriamo azoto in continuazione, ma il nostro corpo non lo usa direttamente.'
  },
  {
    id: 'q026',
    question: 'Chi ha realmente inventato la lampadina?',
    correctAnswer: 'Thomas Edison (versione commerciale)',
    category: 'Invenzioni',
    difficulty: 4,
    explanation: 'Edison non fu il primo, ma creò la prima lampadina a incandescenza pratica e commercializzabile nel 1879.',
    fallbackDecoys: ['Alexander Graham Bell', 'Nikola Tesla (da solo)', 'Guglielmo Marconi'],
    funFact: 'Prima di Edison, Humphry Davy e Joseph Swan avevano già realizzato prototipi funzionanti.'
  },
  {
    id: 'q027',
    question: 'Quale lingua è la più parlata al mondo per numero di parlanti nativi?',
    correctAnswer: 'Il cinese mandarino',
    category: 'Lingua',
    difficulty: 3,
    explanation: 'Il mandarino ha oltre 900 milioni di parlanti nativi, più di qualsiasi altra lingua.',
    fallbackDecoys: ['L\'inglese', 'Lo spagnolo', 'L\'hindi'],
    funFact: 'L\'inglese è però la lingua con più parlanti totali (nativi + seconda lingua).'
  },
  {
    id: 'q028',
    question: 'Qual è il deserto più grande del mondo?',
    correctAnswer: 'L\'Antartide',
    category: 'Geografia',
    difficulty: 5,
    explanation: 'L\'Antartide è il deserto più grande: un deserto è definito dalle scarse precipitazioni, non dal caldo.',
    fallbackDecoys: ['Il Sahara', 'Il Gobi', 'Il deserto arabico'],
    funFact: 'L\'Antartide riceve meno precipitazioni del Sahara.'
  },
  {
    id: 'q029',
    question: 'Quale di questi è un vero imperatore romano?',
    correctAnswer: 'Traiano',
    category: 'Storia',
    difficulty: 4,
    explanation: 'Traiano (53-117 d.C.) fu imperatore romano, noto per le grandi campagne militari e le opere pubbliche.',
    fallbackDecoys: ['Massimo Decimo', 'Commodo il Saggio', 'Tiberio il Bello'],
    funFact: 'Sotto Traiano l\'impero romano raggiunse la massima estensione territoriale.'
  },
  {
    id: 'q030',
    question: 'Quale animale ha il morso più potente mai misurato?',
    correctAnswer: 'Il coccodrillo marino',
    category: 'Animali',
    difficulty: 5,
    explanation: 'Il coccodrillo marino ha il morso più potente mai misurato, con una forza stimata di migliaia di chilogrammi.',
    fallbackDecoys: ['Lo squalo bianco', 'L\'ippopotamo', 'Il leone'],
    funFact: 'L\'ippopotamo ha comunque un morso devastante, ma non raggiunge quello del coccodrillo marino.'
  }
];
