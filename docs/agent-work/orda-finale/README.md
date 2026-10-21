# Orda Finale — L’ultimo vivo vince

Giocabile dal catalogo del Party Game, 2–5 partecipanti, pad o telefono, con bot opzionali. Arena originale **Il Deposito Infetto**: container, corridoi laterali, coperture, otto ingressi e passerella con due rampe raggiungibili anche dai mostri.

Cinque archetipi (Infetto, Corridore, Colosso, Assalitore, Cacciatore) e Macellaio ogni cinque ondate. Crescita progressiva con statistiche limitate, massimo 22 mostri attivi e spawn in coda. Sei armi del registro attuale, munizioni finite, depositi rinnovabili, cure e cassa con benefici temporanei. Nessun fuoco amico.

La morte è definitiva. Vittoria fissata al termine dello stesso passo logico quando resta un vivo; combattimento fermo durante la breve celebrazione. In caso di morti simultanee: tempo reale dell’impatto, poi mostri uccisi, danni effettivi e ID stabile. Classifica inviata al server e punti assegnati dal sistema esistente.

Verifiche: typecheck e build; controlli mirati del motore (rampe, collisioni/visibilità, armi, ammo, spawn, boss e archetipi, indipendenza dagli FPS, eliminazione/spareggi); partita naturale con cinque bot conclusa all’ondata 5; prova compilata con tre umani e due bot, controller telefono, pad simulati, sei modelli GLB e classifica reale. Quattro screenshot, nessun video. Due nuovi annunci del narratore; catalogo audio completo decodificato correttamente.

**Cinque visuali: 44.1 FPS medi**, 1669×939 interni, RTX 3050/D3D11, campione di 6 s con 11–17 mostri. Finestra 1920×1080, scala 1,15. Il solo harness ripristina gli HP per conservare tutte e cinque le camere: AI, attacchi, movimento e rendering restano attivi. Non è un benchmark a 1080p nativo né una garanzia su tutta la partita.

Limiti: un solo boss, modelli Backrooms riutilizzati, schede degli eliminati al posto di un osservatore navigabile, nessuna prova con pad fisici. Gli altri minigiochi non hanno ricevuto test di partita completi. Nessun commit, push, deploy, Flash o dipendenza aggiunta.
