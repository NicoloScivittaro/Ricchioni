# Visuali dei soli giocatori umani

Da solo: una visuale a schermo intero. Con amici: una visuale ciascuno (pad o telefono), senza riquadri dei bot. Tutti i partecipanti restano nella simulazione, nel mondo e nelle classifiche. Minigolf e altri giochi con camera condivisa conservano la singola camera.

Orda, confronto breve a risoluzione interna invariata1669×939,22 mostri animati,5 partecipanti: precedente5 visuali **36.8 FPS**; ora1 visuale **60.0 FPS**,3 visuali **59.3 FPS**,5 visuali **35.7 FPS**. RTX3050, campioni6s dopo riscaldamento. Misura del renderer, senza simulazione completa IA/rete. Il test forza1.15per confrontare lo stesso numero di pixel; il gioco in solo conserva il rendering nativo1.

Typecheck, build, verifica visiva e nove casi del renderer reale (Backrooms/Sparatoria/Ribaltati,1/3/5umani) superati. Controllati mascheramento avatar, jumpscare umano con bot intercalati, cattura bot senza creazione di visuale, spettatore su umani e ridimensionamento. Selettore/layout coperti da1a5umani. Nessun commit, push o deploy.
