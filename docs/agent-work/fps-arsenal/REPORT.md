# Sparatoria — sei armi con ruoli distinti

Il cecchino usa un'ottica circolare 4× con croce, tacche, punto centrale rosso e oscuramento esterno. Lo zoom cambia realmente la prospettiva; la sensibilità scende durante la mira. La sagoma dell'arma scompare dentro l'ottica e torna uscendo dalla mira. Maschera e reticolo si adattano alla singola visuale e al telefono, anche dopo la rotazione dello schermo.

| Arma | Danno base | Cadenza massima | Caricatore | Comportamento |
| --- | ---: | ---: | ---: | --- |
| Cecchino | 125 | 0,85/s | 5 | Un colpo per pressione, ottica 4×, forte dispersione senza mirare |
| USP45 | 30 | 7/s | 12 | Semiautomatica rapida, ricarica 1,1 s |
| Ray Gun rossa | 80 diretto | 2,8/s | 20 | Impulsi energetici verdi, piccolo danno ad area |
| AK-47 | 16 | 8,5/s | 30 | Automatica versatile |
| M4A1 | 23 | 6/s medi | 30 | Raffiche di tre colpi, intervallo interno 75 ms |
| Minigun | 9 | 17/s | 100 | Fuoco continuo, movimento più lento e ricarica 3,2 s |

Il cecchino elimina in un colpo un avversario a 100 HP senza protezioni. Giubbotto, protezione di rinascita e abilità continuano a intervenire sul danno. Nessun bonus di danno deriva dallo zoom.

## Ray Gun

Resta attiva soltanto la Ray Gun rossa con bobine luminose (`raygun.glb`). La versione rosa V1 esce dalla rotazione; l'asset originale resta conservato. Gli ID delle vecchie istantanee risolvono alla Ray Gun mantenuta.

Gli impulsi verdi ad anello volano in linea retta a 55 unità/s fino a 60 unità. La simulazione controlla ogni segmento contro geometria e corpi nella loro posizione corrente: un avversario può schivarli. Pareti e pavimenti fermano il proiettile. Il bersaglio diretto riceve 80 danni e viene escluso dal danno ad area; gli altri avversari entro 1,8 unità ricevono fino a 45 danni, con attenuazione e controllo delle coperture. Preservata l'assenza di danno al tiratore.

Aspetto e suoni sono ispirati agli impulsi energetici della Ray Gun; i numeri sono bilanciati per questo party game. Riferimenti ufficiali: [impulsi energetici circolari](https://www.callofduty.com/ca/en/blog/2022/02/call-of-duty-vanguard-warzone-season-two-multiplayer-zombies), [danno ad area all'impatto](https://www.callofduty.com/guides/zombies/call-of-duty-guides-modern-warfare-zombies-acquisitions).

## Aspetto, audio e prestazioni

Materiali metallici più leggibili mantenendo texture originali e bobine emissive. Cecchino con sparo grave, schiocco e otturatore; Ray Gun con impulso e impatto elettrico; minigun con colpi metallici rapidi. Rinculo e ritorno della pistola più asciutti; M4 più controllabile; lampi e traccianti coerenti con il tipo di arma. I telefoni ricevono eventi di sparo effettivi degli avversari, anche per i singoli colpi semiautomatici.

Ottica composta da una sola immagine statica per visuale: nessuna seconda camera, render target o postproduzione aggiunti. Effetti Ray Gun condivisi fra le camere, con un pool fisso di 32 impulsi e 8 impatti; nessuna crescita delle mesh dopo 100 lanci e impatti. Restano cache degli asset, geometrie condivise e caricamento su richiesta. HUD TV con munizioni e punteggio su righe separate.

I modelli importati rimangono statici nelle loro parti meccaniche; estrazione, rinculo, oscillazione e posa generale di ricarica sono animate dal viewmodel. Non sono stati aggiunti scheletri o animazioni originali di Call of Duty.

## Verifiche

- [Contratto delle sei armi](contracts.json): una sola Ray Gun, ottica 4×, danni e modalità di sparo; SHA-256 dei file originali nei Download invariati.
- [Combattimento nell'host reale](gameplay-checks.json): USP tenuta premuta = un colpo; sei pressioni = sei colpi; buffer durante il recupero; nessun doppio colpo nei sottopassi; annullamento input; fuoco automatico e raffica da tre; ricarica automatica; rotazione delle sei armi senza ripetizioni; bot con grilletto semiautomatico; vittoria a 10.
- Stesso test: cecchino letale e giubbotto efficace; Ray Gun senza danno istantaneo, 80 danni diretti, danno ad area separato, bersaglio schivato, copertura e immunità del tiratore. Impatti verificati su Cantiere, Terminal e Nuketown; muro di Terminal rispettato.
- [Renderer e telefono](visual-checks.json): sei modelli GLB caricati; ottica 4× e scomparsa del modello a 1, 2 e 5 visuali; uscita dall'ottica per ricarica, morte, pausa e cambio arma; telefono verticale e orizzontale; predizione del grilletto semiautomatico; nessun errore browser.
- [Rete con due telefoni reali](network-checks.json): consegna di stato ottica, evento di sparo, impulso e impatto tramite il server locale.
- [Build servita dal server locale](production-checks.json): caricamento della galleria, ottica 4× e impulsi nel client compilato, avvio della schermata host senza errori.
- `npx tsx scripts/fps-weapons-check.ts`, `npx tsx scripts/fps-ads-selftest.ts`, `npx tsx scripts/fps-aim-selftest.ts`.

Build finale `npm run build`: riuscita (TypeScript e Vite; Vite 4m 23s). Rimane l'avviso preesistente relativo alle dimensioni dei chunk. I test usano input sintetici in Chrome; non è una prova con controller fisici. Nessun commit, push o deploy eseguito.
