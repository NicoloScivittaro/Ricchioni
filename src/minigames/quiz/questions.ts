export interface Question {
  category: string;
  prompt: string;
  options: [string, string, string, string];
  correct: number;
}

/**
 * Banca domande v0.1: mix di cultura generale e domande "sul gruppo".
 * Ogni domanda ha 4 opzioni e l'indice della risposta corretta.
 */
export const QUESTIONS: Question[] = [
  {
    category: 'Gruppo',
    prompt: 'Chi è il creatore di questo gioco?',
    options: ['Nicolò', 'Christian', 'Victor', 'Il Judoka'],
    correct: 0
  },
  {
    category: 'Gruppo',
    prompt: 'Secondo la lore, quanti capelli ha Ciro?',
    options: ['Zero', 'Uno', 'Due', 'Tre'],
    correct: 2
  },
  {
    category: 'Gruppo',
    prompt: 'Qual è la dipendenza ufficiale del Judoka?',
    options: ['Il caffè', 'La granita', 'Le patatine', 'Il judo alle 6 del mattino'],
    correct: 1
  },
  {
    category: 'Gruppo',
    prompt: 'Cosa cura Christian il doppio?',
    options: ['La pizza e il kebab', 'Il gelato', 'L\'insalata', 'Il caffè corretto'],
    correct: 0
  },
  {
    category: 'Gruppo',
    prompt: 'Qual è il tasso alcolemico iniziale di Nicolò?',
    options: ['0%', '10%', '25%', '80%'],
    correct: 2
  },
  {
    category: 'Gruppo',
    prompt: 'Quale sport pratica Christian?',
    options: ['Nuoto', 'Pugilato', 'Judo', 'Calcio'],
    correct: 1
  },
  {
    category: 'Cultura',
    prompt: 'Qual è la capitale d\'Italia?',
    options: ['Milano', 'Napoli', 'Roma', 'Torino'],
    correct: 2
  },
  {
    category: 'Cultura',
    prompt: 'Quanti giocatori servono minimo per iniziare?',
    options: ['1', '2', '3', '5'],
    correct: 1
  },
  {
    category: 'Cultura',
    prompt: 'Cosa c\'è tra Anzio e Nettuno?',
    options: ['Una guerra', 'Una rivalità', 'Un fiume', 'Nulla, sono la stessa città'],
    correct: 1
  },
  {
    category: 'Gruppo',
    prompt: 'Victor, secondo il gruppo, ha una laurea presa su...',
    options: ['Oxford', 'Telegram', 'Harvard', 'La Sapienza'],
    correct: 1
  }
];
