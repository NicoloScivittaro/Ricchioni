# Backrooms — mostri più intelligenti

- Ricerca in più diramazioni attorno all'ultimo avvistamento, partendo dalla direzione osservata. Il mostro si ferma brevemente e guarda attorno; la memoria scade come prima.
- Intercettazione breve dei movimenti realmente visibili, con verifica di pavimento e linea di vista prima di anticipare il percorso.
- Pattuglie che penalizzano destinazioni recenti e già scelte da altre creature. Smiler preferisce zone buie; Partygoer cerca stanze adatte all'esca e dispone di più tempo per raggiungerle.
- I rumori vengono confrontati per intensità percepita e distanza, con attenuazione dietro i muri. Una nuova pista sonora può deviare la ricerca senza sovrascrivere l'ultima posizione vista.
- Smiler arretra fisicamente davanti alla luce: spostamento limitato, collisioni valide, stessa durata e resistenza allo stordimento. Partygoer mantiene il breve scatto e il recupero.
- Recupero del percorso quando una svolta impedisce di avanzare. Animazione da fermo durante esca e reazione alla luce.

Passati otto controlli mirati dell'IA e il controllo essenziale precedente di Backrooms: generazione, sensi, catture, chiave, puzzle e partita sintetica completa. Typecheck e build finale superati; avvio compilato verificato. Nel renderer reale il mostro segue la ricerca su pavimento valido e la posizione 3D coincide con la simulazione. Vedere verification.json e build.log.

Cinque visuali indipendenti, RTX 3050 D3D11, 1280×720 nativi, qualità alta, seed 7: **60,3 FPS**, p95 **16,8 ms**, campione di 180 frame (circa 3 secondi). Il precedente campione era 59,5 FPS: la fluidità resta confrontabile, senza una riduzione della risoluzione. Non è una garanzia per ogni dispositivo o incontro.

Nessun commit, push o deploy; gli altri minigiochi e le modifiche precedenti sono preservati. La frase dell'utente termina con “e”: chiarimento opzionale richiesto, lavoro sull'IA completato indipendentemente.
