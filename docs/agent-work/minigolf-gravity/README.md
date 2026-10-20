# Minigolf · Gravità, partenza e imbucata

- Conservata la gravità esistente (14 m/s²), corretti gli agganci al terreno: niente teletrasporto fra quote distanti o riaggancio durante una risalita. Atterraggio per attraversamento della superficie e piccolo rimbalzo dissipato.
- La caduta torna al tee personale originale della buca, non all’ultimo punto dove la palla si era fermata. Colpi, penalità e regola del rientro gratuito per una vittima spinta dall’avversario sono conservati.
- Apertura di 0,5 m condivisa tra grafica e fisica. Guida limitata all’interno del bordo per una palla lenta, cattura continua quando il centro passa nell’apertura utile, esclusi tiri veloci, passaggi esterni e altre quote. Una sola notifica di imbucata.
- Animazione locale di 0,45 s verso il centro e dentro la coppa, anche quando il punteggio è già registrato. Pulizia a cambio buca e dispose; nessuna nuova dipendenza.
- Layout, turni, timer, abilità, torneo e altri minigiochi preservati.

## Verifiche

- minigolf-selftest: PASS fisica, pendenze/superfici, collisioni, turni, cancellazione, abilità, classifica, timeout e 40 round simulati con 2–5 giocatori sulle dieci piste. La prova verifica completamento ordinato dei round, non che tutti i bot imbucano: sulle piste difficili possono esserci DNF. Eseguita dopo le correzioni di gravità/tee/cattura, prima dell’ultima correzione dell’arresto sul bordo.
- minigolf-gravity-selftest finale: PASS salto di quota senza snap, gravità in aria, atterraggio/rimbalzo, ritorno al tee invece del checkpoint, palla ferma sul bordo, singolo evento, colpo veloce, near miss, quota errata e imbucata su tutte le dieci coppe.
- Browser: due telefoni collegati, voto Lungomare, renderer reale e scenari di palla preparati per isolare le modifiche. Caduta con velocità verticale negativa; ritorno alla partenza, +1 penalità e colpi corretti; imbucata con mesh ancora visibile e animazione attiva, poi nascosta a fine discesa. Rientro alla lobby senza canvas residuo. Nessun errore JavaScript.
- Typecheck e build finale: build.log.

Nessun commit, push o deploy. Nessuna modifica a Cornicione, 31, Sparatoria o alle altre modalità.
