# Backrooms / Minigolf / chiarezza Goblin Time

Baseline `9b8425e`, albero pulito; repo Desktop/Ricchioni. Sol diretto per preferenza esplicita già data, nessuna delega/provider alternativo. Nessun commit automatico, push o deploy richiesto.

Obiettivi: ridurre i picchi di lavoro nei due giochi 3D mantenendo grafica, regole, fisica e personaggi; rendere Goblin Time comprensibile e dare 60 secondi per ogni scelta ordinaria, inclusa la risposta. Gli effetti espliciti di carte che accorciano il turno mantengono la propria regola e vengono segnalati chiaramente. Confermare subito continua a essere possibile.

Misura prima/dopo su browser Chrome GPU, stesso seed e qualità alta, 5 giocatori. Isolare costi HUD/render/personaggi e numero di chiamate; pause/cleanup/input/collisioni restano invariati. Non cambiare quality.ts né ridurre risoluzione/modelli/texture.

Goblin: timer server condivisi; TV mostra chi gioca, chi deve scegliere/rispondere e cosa sta succedendo senza rivelare la mano. Telefono mostra obiettivo, istruzione del momento, solo azioni rilevanti, tipi di carte spiegati, scelta con effetto leggibile, contatore selezioni e conferma esplicita. Cronologia accessibile senza occupare la schermata principale. Conservare abilità, privacy e autorevolezza server.

Verifiche: regressioni pure Goblin/Backrooms/Minigolf, timer 60s reali e pausa, protocollo/reconnect/privacy, telefoni piccoli e orizzontali, scelte/reazioni/turno dichiarazione, browser con più giocatori, profilo prima/dopo, typecheck e build, report italiano. Nuovo backend 3005/Vite5176 per le prove, vecchi server preservati.
