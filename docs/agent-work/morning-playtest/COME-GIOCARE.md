# Prova con Nicolò, BOSCHI e Carbo

La cartella del gioco è `C:/Users/niluf.PC-NIKO/Desktop/Ricchioni`.

1. Sul PC apri **AVVIA-PARTITA.cmd**. Usa la build locale su `http://localhost:3001/`: non serve tenere Vite aperto o aggiungere parametri debug. Il comando riusa il server locale già avviato oppure lo avvia in background.
2. Scegli **3 giocatori**, **BREVE — 40 punti** per la prima partita, quindi INVIO. Lascia **IL RULLO DECIDE** per alternare i giochi; le frecce permettono anche di sceglierne uno per il prossimo round.
3. Collegate i telefoni alla stessa Wi-Fi del PC e inquadrate il QR nella stanza. Inserite i vostri nomi, scegliete i personaggi (BOSCHI per Christian, Carbo per Carbo) e premete **PRONTO**. Sul PC INVIO avvia la serata.

Il QR legge l'indirizzo LAN attuale. Alla verifica era `192.168.1.79`; se cambia, il QR si aggiorna alla nuova stanza. Non aprite `localhost` dai telefoni: quello sarebbe il telefono stesso.

Durante la partita: **ESC** apre pausa/ripresa, ricomincia minigioco e salta gioco senza punti. **M** disattiva/riattiva l'audio; **V** apre i volumi. Nel finale **R** prepara una nuova partita conservando i giocatori e azzerando i punti.

Nel **Quiz** leggete la domanda e le quattro risposte sul telefono e toccate quella scelta. Anche l'abilità si attiva dal telefono; vale anche per chi ha un gamepad associato. Le associazioni dei controller rimangono disponibili per gli altri giochi.

I nuovi corpi di Goblin, BOSCHI, Carbo e Ciro sono predefiniti in Arena, Cornicione, Dodgeball e FPS. Dottore conserva il modello originale. Calcio/Volley e piloti Kart conservano la resa collaudata; i giochi sono tutti disponibili. Se un GLB non carica, torna il corpo procedurale. Una precedente scelta OLD nella Gallery/sessione rimane rispettata; per forzare tutti i nuovi modelli usa `?goblin=new&buttafuori=new&judoka=new&ciro=new` sull'host.

Prima della prova con gli amici:

1. Entrate dai due telefoni reali, scegliete BOSCHI/Carbo e verificate che entrambi risultino PRONTO sulla TV.
2. Fate un Cornicione: movimento + salto + colpi contemporanei; provate anche il telefono in orizzontale. ESC deve fermare il gioco e mostrare PAUSA sui telefoni.
3. Mettete un telefono in secondo piano e riportatelo al gioco: deve riprendere lo stesso giocatore. Concludete una partita BREVE e provate R nel finale.

Il server conserva le stanze in memoria. Lasciate acceso il PC/server durante la partita. Nessun deploy remoto è stato eseguito.
