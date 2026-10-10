# PARTY GAME — scheda completa del progetto (da incollare in una chat ChatGPT)

> Scopo di questo file: darti tutto il contesto per ragionare, scrivere codice, proporre idee di design e correggere bug su questo progetto **senza dover chiedere cosa sia**. Tutto il testo del gioco, i commenti e i report sono in **italiano**; il tono è goliardico/romanesco-laziale tra amici (Anzio/Nettuno), con battute ma senza esagerare. Rispondi sempre in italiano.

## 1. Che cosa è
**Party Game** (nome precedente "Ricchioni Party"; in codice il progetto è `party-game`, le chiavi localStorage restano `ricchioni.*` di proposito) è un party game da salotto: **una TV/PC fa da schermo condiviso (host)**, fino a **5 giocatori** entrano scansionando un QR / inserendo un codice stanza dal **telefono** e giocano **minigiochi a round**. Ogni giocatore sceglie uno di **5 personaggi fissi** (amici reali, ognuno con una personalità e **un'abilità diversa in ogni minigioco**). Si vince accumulando punti round dopo round fino al punteggio obiettivo.
- Si gioca col **controller fisico** (Xbox / PlayStation / generici, via Gamepad API del browser) per i giochi d'azione; il **telefono** serve per entrare, per la "Companion Card" (guida informativa con abilità e stato) e per i giochi che richiedono testo/informazioni private (Cultura o Cazzata, Quiz privato). Chi non ha il controller può giocare col **telefono come joystick/tasti** (fallback).
- È in sviluppo, **non pubblicato**; tutti i commit sono locali (non pushati). Priorità attuale: **playtest reale con persone e controller veri**, nessun balance fine automatico.

## 2. Flusso di una partita
1. **Lobby/stanza**: l'host (PC) crea la stanza (2–5 giocatori), mostra QR + codice; i telefoni entrano, scelgono nome e personaggio (ognuno unico), premono PRONTO. Si può scegliere un punteggio obiettivo (preset BREVE 40 / RAPIDA 30 / NORMALE 60 / LUNGA 80 / SERATA 120).
2. **Rullo**: il server estrae il prossimo minigioco (pesi per rarità + anti-ripetizione + "pity" per i giochi in ritardo; categoria pesata a parte; ~25% di probabilità di un **modificatore**). L'host può anche scegliere manualmente un gioco (vale un solo round).
3. **Intro** → **schermata CONTROLLI** (5 s, se ci sono controller: mostra i comandi veri del profilo + una riga per ogni personaggio presente con nome e descrizione della sua abilità; la prima volta di Botte sul Cornicione compaiono 3 consigli) → **countdown 3-2-1-VIA** → **gioco**.
4. **Risultati del round** → **classifica globale** → controllo vittoria → round successivo. Quando qualcuno raggiunge il punteggio obiettivo: **podio** (con eventuale spareggio/"sudden death") e si può ripartire con la stessa stanza.
5. Fasi del server (FSM): `LOBBY → MINIGAME_ROULETTE → MINIGAME_INTRO → MINIGAME_PLAYING → MINIGAME_FINISHED → ROUND_RESULTS → GLOBAL_LEADERBOARD → CHECK_WINNER → NEXT_ROUND → … → GAME_FINISHED`.

## 3. Punteggio
Punti per posizione, a seconda del numero di giocatori: **2p: 10/5 · 3p: 10/6/3 · 4p: 10/7/4/2 · 5p: 10/7/5/3/1**. **Rubber-band**: chi è sotto il leader di almeno il 25% dell'obiettivo (min. 10 punti) prende ×1,5. Modificatore "PUNTI DOPPI" = ×2 sul round. Ogni minigioco restituisce solo **una classifica 1..N** (+ fino a 3 statistiche brevi mostrate nei risultati); il calcolo punti è del `ScoreManager`, mai del minigioco.

## 4. Modificatori (casuali, ~25% dei round, solo se il gioco li dichiara compatibili)
- **TEMPO DIMEZZATO** — Il tempo del minigioco è dimezzato.
- **PUNTI DOPPI** — Il round vale il doppio dei punti.
- **CONTROLLI INVERTITI** — I controlli sono invertiti.
- **GRAVITÀ BASSA** — Gravità ridotta nell'arena.

## 5. I 5 personaggi (identici in statistiche base; cambia solo l'abilità nel minigioco)
Ordine nel gioco: goblin, buttafuori, dottore, judoka, ciro. Nomi reali degli amici: Goblin = Nicolò, Buttafuori = Christian (nel codice attuale il nome in gioco è "BOSCHI"), Dottore = Victor, Judoka = Carbo, Ciro = Ciro.
| id | nome in gioco | ruolo | colore | carattere / battuta |
|---|---|---|---|---|
| goblin | Nicolò | GOBLIN MBRIACONE | #10b981 | Party first, quest later. Nel codice sorgente c'è scritto che non posso morire! |
| buttafuori | BOSCHI | BOSCHI | #ef4444 | Tu qua non entri! Aspè... famme capì, mo se te ribalto vinco io? Perfetto! |
| dottore | Victor | IL DOTTORE SCEMO | #06b6d4 | Tranquilli, so quello che faccio. Diagnosi: forse tutto bene, o forse ripensiamoci domani. |
| judoka | Carbo | Carbo | #f59e0b | EH?! MA DAI! NON È COSÌ! In realtà secondo il comma 4 del regolamento di casa mia... |
| ciro | Ciro | IL NAPOLETANO STEMPIATO | #8b5cf6 | Non c'ho spicci... ma ho soluzioni! Facciamo 50 e 50: 80 a me e 20 a te! |

Presentazione (solo grafica, mai gameplay): modello 3D procedurale "chibi" (testa grossa) con accessori e proporzioni diverse per personaggio, animazioni procedurali con personalità — Goblin nervoso/rapido, Buttafuori pesante, Judoka tecnico/stabile, **Dottore morbido e rilassato (NON è un medico né uno scienziato: niente camice/provette/virus)**, Ciro espressivo e furbo. Il personaggio dice battute rare (fumetti) e ha una firma sonora.

## 6. I minigiochi (11)
Categorie: CULTURA, RIFLESSI, MEMORIA, ARENA, SPORT, GUIDA, SKILL. Input: GAMEPAD (controller) salvo Cultura (PHONE_TEXT).
| id | nome | categoria | rarità | giocatori | durata | idea |
|---|---|---|---|---|---|---|
| quiz | CHI CAZZO LO SA? | CULTURA | common | 1-5 | 320s | Rispondi prima e meglio degli altri. Cultura generale, zero pietà. |
| reaction | BOTTA AL VOLO | RIFLESSI | common | 1-5 | 90s | Premi appena scatta il segnale. Chi anticipa paga. |
| memory | MEMORIA DA UBRIACO | MEMORIA | uncommon | 1-5 | 100s | Guarda la sequenza e ripetila. Più si beve, meno si ricorda. |
| arena | ARENA DEL DISAGIO | ARENA | uncommon | 1-5 | 45s | Spingi gli altri fuori dall'arena. L'ultimo in piedi vince. |
| dodgeball | DODGEBALL DEI COGLIONI | ARENA | uncommon | 1-5 | 45s | Schiva. Tira. Non farti prendere in faccia. |
| soccer | CALCIO DEI DISAGIATI | SPORT | uncommon | 1-5 | 100s | Calcio a squadre: segna un gol in più degli avversari. |
| volleyball | PALLAVOLO DEI DISAGIATI | SPORT | uncommon | 1-5 | 120s | Beach volley a squadre: chi arriva a 5 punti vince. |
| kart3d | RIBALTATI — CIRCUITO DEL LITORALE | GUIDA | rare | 1-5 | 170s | Corri sul circuito e taglia il traguardo per primo. |
| cultura | CULTURA O CAZZATA? | CULTURA | uncommon | 1-5 | 300s | Inventa bugie credibili e smaschera quelle degli altri. |
| fps | SPARATORIA DEI DISAGIATI | ARENA | rare | 1-5 | 100s | Tutti contro tutti in prima persona. Più kill, più punti. |
| cornicione | BOTTE SUL CORNICIONE | SKILL | uncommon | 2-5 | 150s | Picchia, schiva e rientra: più danno hai, più voli lontano. Fuori dal tetto = una vita in meno. |

Regole in breve (le specifiche fini sono nel codice):
- **CHI CAZZO LO SA? (quiz)** — 10 domande a difficoltà crescente (timer 12–25 s) da un database di 240 domande in 24 categorie; le risposte sono pubbliche sulla TV, ognuno sceglie col controller (D-pad per scorrere, A conferma) senza che gli altri vedano quale sta scorrendo; informazioni private temporanee sul telefono (poi la card torna).
- **BOTTA AL VOLO (reaction)** — 5 round: premi solo quando compare il segnale; anticipare penalizza.
- **MEMORIA DA UBRIACO (memory)** — 5 round con sequenze di 3,4,5,6,7 tessere (4 tessere = 4 note fisse, per posizione sul controller): osservi e ripeti; si viene eliminati all'errore.
- **ARENA DEL DISAGIO (arena)** — sumo 3D: spingi gli altri fuori dall'arena circolare (dash + knockback); dopo ~8 s il bordo si restringe; l'ultimo in piedi vince.
- **DODGEBALL DEI COGLIONI (dodgeball)** — schiva e tira; una palla che ti prende = fuori; raccolta automatica.
- **CALCIO DEI DISAGIATI (soccer)** — calcio a squadre 3D, 60 s + golden goal; tiro/passaggio (tenuto = più forte), tackle.
- **PALLAVOLO DEI DISAGIATI (volleyball)** — beach volley a squadre, primo a 5 punti: salta, colpisci, schiaccia.
- **RIBALTATI — CIRCUITO DEL LITORALE (kart3d)** — gara di kart 3 giri con drift, item e abilità.
- **CULTURA O CAZZATA? (cultura)** — gioco di bluff dal telefono: si inventano risposte false credibili a una domanda vera, poi si vota; 158 domande in 20 categorie, 5 decoy ciascuna; ruoli casuali (Secchione / Avvocato) e abilità dei personaggi.
- **SPARATORIA DEI DISAGIATI (fps)** — tutti contro tutti in prima persona: chi ha il controller gioca in split-screen sul PC, chi non ce l'ha continua dal telefono (rendering 3D privato); 100 s, più kill = più punti.
- **BOTTE SUL CORNICIONE (cornicione)** — vedi sezione 8.

## 7. Abilità: 5 personaggi × 11 minigiochi = 55
Fonte unica: `shared/abilityCatalog.ts` (nome, descrizione breve/completa, limiti, tipo, impatto e **tutti i numeri**: i giochi leggono i numeri solo da lì, i testi sono generati dagli stessi numeri, quindi non possono divergere). Tipi: TIMING, RISORSA LIMITATA, RISCHIO/PREMIO, REATTIVA, INFORMAZIONE, REGOLA PIEGATA. Il **tasto** vive in `src/input/profiles.ts` (Arena/Dodgeball/Pallavolo B/◯; Calcio/Kart Y/△; Memoria/Botta/Quiz/Sparatoria/Cornicione RB/R1; Cultura dal telefono). Stato live (PRONTA / ATTIVA / RICARICA / ESAURITA / CARICA) pubblicato dal gioco con **AbilityHub** verso HUD TV e telefono; se il tasto non può partire arriva un avviso **privato** ("NON ORA", "ESAURITA"…). La TV mostra il nome dell'abilità sopra il personaggio per ~1 s.

### CHI CAZZO LO SA?
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **N'CULO!** | Rifiuti la domanda: ne arriva una nuova, per tutti. | 1 uso a partita |
| buttafuori | **MO HO CAPITO** | Se sbagli, riprovi per metà punti. | 1 uso a partita |
| judoka | **NO, ASPETTA!** | Dopo aver risposto, puoi ancora cambiare. | 1 uso a partita |
| dottore | **M'HO SVEJATO** | Un indizio vero, in privato, per il 70% dei punti. | 1 uso a partita |
| ciro | **ULTIMO GIORNO UTILE** | Aspetti la fine del tempo e vedi come hanno risposto. | 1 uso a partita |

### BOTTA AL VOLO
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **N'CULO!** | Annulla il finto VIA e riparte l’attesa. | 1 uso a round |
| buttafuori | **MO HO CAPITO** | Falsa partenza? Hai una seconda chance. | 1 uso a round |
| judoka | **ASPETTA UN ATTIMO!** | Finto reset per tutti, poi nuovo timer. | 1 uso a round |
| dottore | **M'HO SVEJATO** | Focus: se il VIA cade nella finestra, lo senti. | 1 uso a partita |
| ciro | **ULTIMO SECONDO** | In guardia: sai se qualcuno sbaglia o se è un falso allarme. | 1 uso a partita |

### MEMORIA DA UBRIACO
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **ANCORA UN GIRO** | Rivedi la sequenza, solo tu. | 1 uso a partita |
| buttafuori | **MO HO CAPITO** | Il primo errore non ti elimina. | 1 uso a partita |
| judoka | **NO, ASPETTA!** | Ferma il tuo tempo e riprendi dopo. | 1 uso a partita |
| dottore | **M'HO SVEJATO** | Sbirci la prossima casella giusta. | 1 uso a partita |
| ciro | **A RATE** | Pausa a metà sequenza, con sconto sul tempo. | 1 uso a partita |

### ARENA DEL DISAGIO
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **N'CULO!** | Parata a tempo: chi ti colpisce vola via. | 2 usi · ricarica 6 s |
| buttafuori | **MO M'IMPEGNO** | Reggi le spinte, poi le restituisci. | 1 uso |
| judoka | **IPPON** | Afferri chi hai davanti e lo scaraventi. | 2 usi · ricarica 8 s |
| dottore | **M'HO SVEJATO** | Schivi da sveglio il primo scatto che ti punta. | 1 uso |
| ciro | **PAGO DOMANI** | Il bordo non ti elimina: lo paghi dopo. | 1 uso |

### DODGEBALL DEI COGLIONI
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **N'CULO, RIPIGLIATELA!** | Pari la palla a tempo e la rimandi indietro. | 2 usi · ricarica 7 s |
| buttafuori | **OCCHIO DA POLIGONO** | Mira laser e primo tiro velocissimo. | 1 uso |
| judoka | **CARICO E SCARICO** | Camion: raccogli due palle e le scarichi. | 1 uso |
| dottore | **TRE MESI DOPO** | Vedi le traiettorie e le schivate si ricaricano subito. | 1 uso |
| ciro | **PAGO DOMANI** | Il colpo che ti elimina diventa un debito. | 1 uso |

### CALCIO DEI DISAGIATI
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **N'CULO!** | Tiro a giro: caricalo e lascialo nel punto giusto. | 1 uso |
| buttafuori | **TU QUA NON ENTRI** | Per qualche secondo nessuno ti ruba la palla. | 1 uso |
| judoka | **IPPON** | Presa sul portatore di palla: gliela strappi. | 2 usi · ricarica 10 s |
| dottore | **M'HO SVEJATO** | Il prossimo tiro va dritto nell’angolo giusto. | 1 uso |
| ciro | **PAGO DOMANI** | Il primo contrasto è rimandato: poi lo paghi. | 1 uso |

### PALLAVOLO DEI DISAGIATI
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **JÄGER BOMB** | Smash perfetto devastante: se sbagli, è sprecato. | 1 uso |
| buttafuori | **MURO DEL POLIGONO** | Muro a rete: la palla che tocchi in alto torna giù. | 1 uso |
| judoka | **NO, ASPETTA!** | Ferma la palla in aria: solo tu puoi muoverti. | 1 uso |
| dottore | **M'HO SVEJATO** | Salti e corri meglio, e il tuo smash va dove nessuno difende. | 1 uso |
| ciro | **PAGO DOMANI** | La palla a terra non conta: ma se perdi lo scambio, vale doppio. | 1 uso |

### RIBALTATI — CIRCUITO DEL LITORALE
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **SO GUIDARE IO** | Drift perfetti = turbo più forti, finché non sbatti. | a barra piena |
| buttafuori | **RIBALTATO MA NON MORTO** | Dopo uno schianto: premi e torni subito in pista. | 1 uso a gara |
| judoka | **CARICO E SCARICO** | Camion: spingi via chi tocchi, ma sterzi male. | a barra piena |
| dottore | **20 KG IN UN MESE** | Leggerissimo: accelera e drifta, ma voli se ti urtano. | a barra piena |
| ciro | **PAGO DOPO** | Rimanda un colpo: lo paghi dopo qualche secondo. | 1 uso a gara |

### CULTURA O CAZZATA?
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **N'CULO!** | Raddoppi la puntata sul voto: o la vera, o ti costa. | 1 uso a partita |
| buttafuori | **TU QUA NON ENTRI** | Butti fuori una risposta falsa a caso, solo per te. | 1 uso a partita |
| judoka | **NO, ASPETTA!** | Ferma il voto: +6 secondi per tutti, non si chiude in anticipo. | 1 uso a partita |
| dottore | **M'HO SVEJATO** | Intuizione: iniziale e numero di parole della vera. | 1 uso a partita |
| ciro | **ULTIMO GIORNO UTILE** | Vedi quanti voti ha ogni risposta, in tempo reale. | 1 uso a partita |

### SPARATORIA DEI DISAGIATI
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **N'CULO!** | Ricarica perfetta: istantanea e più danno per qualche colpo. | illimitata · ricarica 14 s |
| buttafuori | **TU QUA NON ENTRI** | Giubbotto: subisci molto meno danno. | illimitata · ricarica 25 s |
| judoka | **NO, ASPETTA!** | Spinta che interrompe: ricariche e spari bloccati. | illimitata · ricarica 15 s |
| dottore | **M'HO SVEJATO** | Vedi dove sono tutti. Poi ti gira la testa. | illimitata · ricarica 22 s |
| ciro | **PAGO DOMANI** | Non muori: ti serve una kill per saldare. | 2 usi |

### BOTTE SUL CORNICIONE
| personaggio | abilità | cosa fa | limite |
|---|---|---|---|
| goblin | **RIMONTA AL 90°** | Fuori dal palco, in aria: scatto diagonale di recupero. | 1 uso per vita |
| buttafuori | **ULTIMO ACCESSO: 3 SETTIMANE FA** | Sparisci un attimo e riappari lì vicino: nessuno ti tocca. | 1 uso per vita |
| judoka | **ANGORA CHE DICI?** | Postura di contrattacco: se ti colpiscono corpo a corpo, li proietti. | 2 usi per vita |
| dottore | **TAGLIO PESO EXPRESS** | Leggerissimo per qualche secondo: agile, ma voli via molto di più. | 1 uso per vita |
| ciro | **BONIFICO IN LAVORAZIONE** | Sul punto di morire premi: il KO è rinviato, ma poi si paga. | 1 uso per vita |

Descrizioni complete (formula "cosa fa · quando premere · limite") sono nel catalogo e in `docs/ABILITY_MATRIX.md` (matrice prima/dopo con voti di design).

## 8. Focus: BOTTE SUL CORNICIONE (l'ultimo gioco aggiunto)
Platform fighter 2.5D arcade, 2–5 giocatori, controller-first, a mani nude (nessuna arma), **tutti contro tutti**. Nessun HP: ogni giocatore ha **3 vite** e una **percentuale di danno** (parte da 0%, nessun tetto): più ne hai, più lontano voli; uscire dai limiti = perdi una vita. Vince l'ultimo con almeno una vita; a 150 s: più vite → % più bassa → più KO → spareggio rapido (max 20 s).
- **Comandi**: stick = corsa/direzione degli attacchi/↓ scendi dai ponteggi e caduta rapida in aria · A/✕ salto (2 totali, salto corto se rilasci) · X/□ leggero · Y/△ pesante · **↑+Y in aria = recovery attack** (una volta finché non tocchi terra o parete) · B/◯ schivata (a terra breve, in aria direzionale, cooldown) · RB/R1 abilità.
- **Attacchi (14)**: leggeri neutro/laterale/su/giù (veloci, poco knockback, mai KO), pesanti laterale/su/giù (anticipo 0,26–0,30 s, recupero lungo, punibili), versioni aeree. Knockback = base + %vittima × scaling. Anti-mash (stessa mossa ripetuta fa meno danno), anti-combo infinite (stordimento che cala, protezione dopo 6 colpi), influenza dello stick sul lancio (devia, non annulla).
- **Recovery** è la meccanica centrale: doppio salto, air dodge, recovery attack, **parete della palazzina** (2 attacchi per volo, 0,7 s di aggancio, salto dalla parete). L'edge guard è voluto.
- **Palco "Tetto del Disagio"**: palazzina al tramonto (26 m) + 3 ponteggi one-way simmetrici; KO molto oltre l'inquadratura; camera condivisa con zoom dinamico e indicatori fuori quadro; HUD con ritratto, vite, % a fasce, stato abilità.
- **KO**: dopo ~1,8 s respawn sopra il centro, 0%, invulnerabile 2 s. Soglie misurate: pesante laterale sul bordo ≈150%, spazzata ≈140%, ↑pesante dalla piattaforma alta ≈130%.
- Fisica e statistiche **identiche per tutti**: l'unica differenza sono le abilità (per vita): Goblin RIMONTA AL 90° (scatto di recupero fuori dal palco + attacco speciale al rientro), Buttafuori ULTIMO ACCESSO: 3 SETTIMANE FA (sparisce ~1,1 s, riappare vicino con segnale), Judoka ANGORA CHE DICI? (2 cariche, contrattacco/proiezione) — *la frase è reale, scritta così, "angora" non va corretto* —, Dottore TAGLIO PESO EXPRESS (5 s agile ma ×1,9 knockback), Ciro BONIFICO IN LAVORAZIONE (sul KO imminente premi RB: KO rinviato, 2,5 s per rientrare, +25% di danno se ce la fa).
- Dettagli e numeri: `docs/CORNICIONE.md`. Laboratorio di sviluppo: `?fighter=1`.

## 9. Telefono: Companion Card e fallback
Con un controller collegato il telefono **non è un joystick**: mostra ritratto, ruolo, nome del gioco, **abilità** (nome, tasto vero per Xbox/PlayStation, tipo, cosa fa, limite, stato live) e i comandi; niente bottoni di gioco. Resta la card solo informativa (e il telefono resta acceso). Chi non ha il controller vede il layout touch del gioco (joystick/tasti, o croce + tasti generici). Cultura usa sempre il telefono (testo + voto + abilità col bottone ⚡).

## 10. Architettura tecnica
- **Stack**: TypeScript, **Vite**, **Phaser 3** (menu/lobby/rullo/risultati, host), **Babylon.js 9** (minigiochi 3D su canvas dedicato + Babylon GUI per gli HUD), **Node + Express + Socket.IO** (server autoritativo sulle fasi/punteggi/rullo), controller telefono = pagina `controller.html` (DOM, senza motore). Porte: server **3001** (`LOG=quiet npm start`), client dev **5173** (`npx vite`).
- **Cartelle**: `server/` (GameSession FSM, RoomManager, Reconnection), `shared/` (tipi, registry minigiochi `minigames.ts`, rullo `roulette.ts`, punteggio `scoring.ts`, `abilityCatalog.ts`, personaggi, domande), `src/core/` (GameManager, audio, musica procedurale, impact, telemetry, abilityHub, UI token, debug), `src/input/` (GamepadManager, profili pad `profiles.ts`, schermata CONTROLLI), `src/minigames/<id>/` (una cartella per gioco: scena Phaser wrapper + Babylon*Game + logica), `src/controller/` (telefono), `src/dev/` (laboratori), `scripts/` (test e simulazioni), `docs/`.
- **Aggiungere un minigioco**: definizione in `shared/minigames.ts` (id, nome, categoria, rarità, min/max giocatori, durata, hardCap server, layout controller, inputMode) + cartella `src/minigames/<id>/index.ts` con la scena (auto-discovery) + profilo pad in `profiles.ts` + abilità nel catalogo + precarico in `preload.ts` + tema musicale/sting. **Il server legge il registry all'avvio: va riavviato** dopo aver aggiunto un gioco.
- **Pattern dei giochi 3D**: scena Phaser sottile (ciclo di vita, menu ESC, caricamento) + classe Babylon (render loop con passi fissi indipendenti dagli FPS via `frameClock`); il gioco legge input da `ctx.input` (InputManager, indipendente dal device), pubblica stato abilità su `abilityHub`, chiude con `ctx.finish({results})`. I giochi d'azione hanno una **logica pura testabile senza browser** (es. `fighterCore.ts`).
- **Input**: un solo InputManager; adapter tastiera/rete/gamepad; profili per gioco in `profiles.ts` (stessa fonte per input vero e schermata CONTROLLI). Abbinamento controller↔giocatore con pannello dedicato; blocco "fino al rilascio" dei tasti dopo la schermata CONTROLLI.
- **Audio**: tutto procedurale WebAudio (mixer, limiter, ducking, musica per gioco con livelli). **Grafica**: Art Bible (`docs/ART_BIBLE.md`), kit ambienti `env/envKit.ts`, HUD kit `hud/hudKit.ts`, token UI `core/uiTokens.ts` (`docs/UI_SYSTEM.md`).
- **Debug** (solo dev o `?debug=1`): F3 overlay, F4 report di sessione (bilanciamento + sezione ABILITÀ), T rallentatore, laboratori `?characters=1 ?impact=1 ?audiolab=1 ?environments=1 ?ui=1 ?fighter=1`.

## 11. Test
Logica senza browser (`npx tsx scripts/…`): `ability-selftest`, `pad-selftest`, `fighter-selftest`, `fighter-abilities-selftest`, `kart-abilities-selftest`, `ability-sim`, `fighter-sim`, `roulette-sim`, `rounds-selftest`, `validate-content`, `content-audit`. Browser (Chrome headless con controller finti, `node scripts/e2e/…mjs`): `gamepad-*` per ogni gioco, `matrix`, `smoke5`, `pause`, `reconnect`, `lobby-return`, `leak`, `gamepad-m7-session`, `prod-bundle`, `ability-*`, `fighter-*`. Trappole note: l'host headless gira a ~5 fps (sequenze a tempo vanno fatte dentro la pagina), niente `page.evaluate` che restituisce oggetti ciclici, HMR di Vite può rompere i test se si modificano file mentre girano.

## 12. Stato attuale e regole di lavoro
- Fatto (tutto in locale): migrazione completa al gamepad (M1–M7), identità dei personaggi, animazioni/impatto, audio+musica, ambienti 3D, UI finale, **espansione contenuti** (Quiz 240 domande, Cultura 158), **ABILITY OVERHAUL** (55 abilità, Companion Card, schermata CONTROLLI con sezione abilità, F4), **Botte sul Cornicione**.
- **Manca**: playtest con persone e controller veri (feeling, tempi, letalità, bilanciamento reale), prova su GPU reale, prova hardware di alcuni controller (Kart/M5/FPS). Rischi noti: Ciro nel Cornicione potrebbe essere forte; smoke5 ha avuto un flake non spiegato; il check del rullo "gap massimo ≤ 55" fallisce con 11 giochi (56 vs 49–51 con 10).
- **Vincoli di progetto** (da rispettare quando proponi modifiche): non toccare networking/GameManager/ScoreManager/architettura input/pairing/rullo/flusso dei round senza motivo; niente nuovi personaggi; abilità = unica differenza di gameplay tra personaggi; ogni abilità deve avere tempismo/rischio/scelta e controgioco (niente buff piatti, niente invulnerabilità senza counterplay); testi del gioco in italiano e con numeri presi dal catalogo; verifica sempre nel browser (non solo build); non fare balance fine senza playtest umano.
- Git: branch `main`, commit locali non pushati, i commit terminano con la riga di co-autore Claude; dopo `npm run build` si ripristina `git checkout -- dist/index.html`.

## 13. Come usare questa scheda in chat
Se ti chiedo una modifica: (1) dimmi quali file toccare partendo dalla mappa del §10, (2) mantieni lo stile esistente (commenti in italiano, nomi coerenti), (3) indica i test da lanciare del §11, (4) segnala i rischi di bilanciamento invece di "aggiustarli" da solo. Se ti chiedo idee di design, proponi cose coerenti col tono e coi 5 personaggi, e dimmi quale abilità/numero cambierebbe nel catalogo.



## Minigolf dei Disagiati (#13)

`minigolf`: SPORT, 2–5 simultanei, tre buche da sei percorsi, 50 s/buca e limite iniziale 8 colpi. Stick sinistro mira, A/✕ tenuto carica e rilasciato tira, B/◯ annulla, RB/R1 abilità (un uso per buca). Telefono con joystick/TIRA/ANNULLA/ABILITÀ. Palline collidono, cadute +1, reset tecnici gratuiti; vince chi totalizza meno colpi. Camera condivisa e personaggi esistenti, bot anche in solo. Modulo `src/minigames/minigolf/`; [report e verifiche](agent-work/minigolf/REPORT.md). Numeri da bilanciare con playtest umano.
