# Minigolf: tiro dosato e club sul mare

## Ambito
Intervento eseguito direttamente con Sol, come richiesto nella conversazione.
Mantenuti torneo, turni, punteggi, privacy/controller e ritorno al tee dopo le cadute.
Nessun commit, push o deploy.

## Modifiche
- Putt rasoterra fino all'82% di carica; oltre questa soglia, impulso verticale
  progressivo fino a 2,1 m/s. Apice massimo su piano circa 15,6 cm, con ritorno
  naturale a terra. Il potenziamento non aumenta il salto. Guida Dottore in 3D.
- Prato con dettaglio deterministico e taglio a strisce, sabbia granulare,
  bordi in pietra/legno, palline bianche con fossette e fascia del giocatore.
- Luce solare calda e ombre PCF; club costiero con passeggiate, piante, panchine,
  lampioni e mulino originale. Decorazioni unite per materiale, matrici statiche
  congelate; nessuna animazione o texture ridipinta a ogni fotogramma.
- Due mappe aggiuntive votabili: LE DUNE DEL CLUB (rampe ondulate),
  IL GREEN DELLE PALME (sponde oblique e green circolare). Totale 12 mappe.
- Superfici triangolari e sponde curve derivate dai modelli v2/v4 originali,
  indice spaziale per limitare il costo delle collisioni. Le facce di sostegno
  sotto il tappeto non diventano barriere invisibili. I bot tengono conto del
  dislivello sulle nuove rampe.

## Asset
Usati il pacchetto Models1-9 e il mulino. Attribuzioni in
public/assets/minigolf/CREDITS.md. Il campo fotogrammetrico Mini Golf Field è stato
ispezionato: non è stato usato come pista perché richiederebbe una conversione
separata delle superfici irregolari; non è aggiunto al caricamento del gioco.
I download originali non sono modificati. Rigenerazione: python scripts/minigolf-assets.py.

## Verifiche
Vedere physics.json, completion.json, browser.json e i log dei controlli.
La prova browser usa cinque telefoni e una sola camera condivisa, come nel
minigolf reale. La misura breve non è un benchmark a cinque visuali separate.

Build finale e typecheck superati (4m58s). Avvio produzione, asset compilati e
gallerie precedenti verificati via HTTP. Campione GPU: 60,0 FPS con cinque
telefoni, una camera condivisa, 1280x720 per circa 4 secondi.
