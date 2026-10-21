# Terminal: cinque visuali

Due correzioni nel renderer condiviso di Terminal: selezione delle mesh per layer prima delle valutazioni costose e cache degli atlanti per programma GPU. Nessuna modifica a geometria, texture, risoluzione, armi, danni o collisioni.

Confronto alternato A/B nella stessa scena Full HD, qualità alta, scala 1, cinque personaggi e armi importati. Mesh candidate per fotogramma: 3433 → 2366 (-31%); invii uniform4 degli atlanti/materiali: 197 → 55 (-72%). FPS e condizioni complete in verification.json: i campioni headless variano molto e restano bassi a risoluzione nativa; questa correzione non dimostra 60 FPS stabili.

Superati typecheck, build, confronto degli oggetti visibili su quattro orientamenti per tutte e cinque le camere, sei modelli di arma, ADS, ricarica, colpo/danno, eliminazione e respawn. Prova compilata in production.json.
