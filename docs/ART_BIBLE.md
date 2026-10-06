# Art Bible — Ricchioni Party

Documento interno. Vale per tutti gli ambienti 3D e per le scenografie 2D. Il codice che la applica è in
`src/minigames/env/` (palette, materiali, luci, cielo, cartelli, folla): **un solo kit**, usato da tutti i giochi.

## Direzione comune

Stilizzato · cartoon · colorato · low-poly curato · leggibile · esagerato quanto basta.

- Forme pulite, silhouette forti, geometrie semplici (box, cilindri a poche facce, piani con texture disegnate).
- Materiali leggermente stilizzati: colore pieno + poco speculare. Niente PBR, niente realismo, niente grigio piatto.
- Ogni gioco ha la sua palette, ma tutti usano **le stesse famiglie di materiali, la stessa luce, gli stessi cartelli**.

## Regola d'oro

**GAMEPLAY READABILITY > BELLEZZA.** Personaggi, palla, proiettili, obiettivi, checkpoint e pericoli devono emergere
prima di qualunque decorazione, anche in scala di grigi (test `G` in debug).

- Il **piano di gioco** è il punto più pulito e più contrastato dell'inquadratura: nessun oggetto decorativo sopra.
- Il decor sta **fuori** dal piano di gioco e **fuori** dall'asse camera → gioco (niente occlusioni).
- La decorazione non è mai collidibile; nessuna collisione invisibile.

## Colori

| Ruolo | Regola |
|---|---|
| Colori giocatore / squadra (rosso, blu, verde, giallo saturi) | **vietati** su grandi superfici decorative |
| Grandi superfici | toni medi e desaturati (cemento, legno, sabbia, prato, metallo verniciato) |
| Accenti | piccoli: neon magenta / ciano / ambra, strisce di pericolo giallo-nero solo sui bordi pericolosi |
| Folla | toni smorzati (vestiti "veri": jeans, grigio, beige, bordeaux scuro), mai colori puri |
| Squadre | restano riconoscibili anche per forma/parola (già così); niente rosso/blu forti vicino alle aree squadra |

### Famiglie di materiali (`PAL` in `envKit.ts`)

| Famiglia | Uso | Tono |
|---|---|---|
| cemento | pavimenti tecnici, muretti, pilastri | grigio caldo chiaro / scuro |
| metallo | tralicci, ringhiere, gru, container verniciati | grigio-blu, verniciato desaturato |
| legno | chioschi, panchine, pontili, casse | miele / noce |
| sabbia | spiaggia | crema dorato |
| erba / sintetico | campi | verde medio, a strisce |
| plastica | sedute, bidoni, sedie | pastello smorzato |
| acqua | mare, porto | blu-ciano con riflessi chiari |
| neon / emissivo | insegne, luci, bordi | solo accenti piccoli, mai superfici grandi |

## Luce (`lightRig`)

Grammatica unica: **key** (direzionale, chiara e calda) + **fill** (emisferica, abbastanza forte da leggere i
personaggi in ombra) + **rim/accent** facoltativa (MEDIUM/HIGH). Niente ombre nerissime (il fill non scende mai
sotto 0.45), niente cielo sovraesposto (il cielo non entra nel bagliore), il bagliore solo su neon e luci.

## Livelli di dettaglio

- **PRIMARY** — landmark grandi, leggibili da lontano (maxischermo, gru, faro, palma gigante, palazzine).
- **SECONDARY** — strutture e props (spalti, panchine, chioschi, container, lampioni).
- **TERTIARY** — piccoli dettagli e gag (poster, scritte, easter egg). Mai sul piano di gioco, mai in movimento veloce.

Qualità: LOW = primary + secondary essenziali, luce semplice; MEDIUM = + folla piena e accenti; HIGH = + bagliore e
dettagli extra. **L'ambiente deve essere bello anche su LOW.** La qualità non tocca mai la geometria di gioco.

## Cartelli

Un solo font (quello dei titoli, "Arial Black") e quattro stili: **neon** (pannello scuro, scritta luminosa),
**board** (cartello dipinto), **hazard** (giallo/nero, solo per pericoli), **poster** (carta, per le gag).

## In-joke ed easter egg

Pochi e forti per ambiente, sempre come TERTIARY, mai sopra elementi competitivi. Niente marchi reali, niente IP
(Nintendo, EA, FIFA…): solo parodie e nomi del gruppo.

## Prestazioni

Instancing / thin instances per tutto ciò che si ripete, mesh statiche fuse per materiale, materiali condivisi e
congelati, texture disegnate una volta (cache per testo), animazioni lente su pochi nodi condivisi. La Sparatoria in
split-screen disegna ogni oggetto fino a 5 volte: lì il decor è il più economico di tutti.
