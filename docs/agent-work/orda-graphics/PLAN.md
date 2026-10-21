# Orda — grafica e cinque visuali

Intervento diretto, mantenendo la preferenza per Sol. Ambito: renderer Orda, arena, distributori, HUD, effetti e derivati grafici. Conservare regole, danni, prezzi, animazioni di combattimento e comandi. Nessun commit/push/deploy.

Prima: campione ripetibile di6s con22 mostri animati,5 visuali, armi differenti e framebuffer1920x1080/interno1669x939. Fixture del renderer reale, non simulazione completa del multiplayer. Raccogli FPS/tempi e draw calls. Poi ottimizzare sulla base del collo di bottiglia: ridurre lavoro ripetuto per camera, materiali statici/mesh e geometrie eccessive; mantenere la risoluzione del confronto. Miglioramenti estetici con texture procedurali, luci simulate e HUD/segni leggibili senza nuovi ostacoli.

Accettazione: confronto alle stesse condizioni, verifica visiva di arena e stazioni/arma, nessuna modifica ai file shared delle regole; typecheck e build finale. Report breve con limiti del benchmark e massimo3 screenshot. Originali Downloads intatti.
