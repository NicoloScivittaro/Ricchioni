# Terminal — sola conversione geometrica

1. Inventariare gli archivi e preservare lo stato del repository. Verificare con un piccolo campione reale `iwmap 4`, brush convessi, mesh e prefab prima di una conversione completa.
2. Verificare il codice di RadiantMapToWavefrontObj sul campione. Usarlo solo per i costrutti effettivamente supportati; registrare eventuali incompatibilità e usare un convertitore esplicito per quelli mancanti.
3. Risolvere ricorsivamente i prefab con matrici originali e inventario delle dipendenze. Decodificare solo i formati XModel/materiale/IWI riscontrati, confrontandoli con un importatore CoD4. Niente cubi sostitutivi o risorse inventate.
4. Esportare la scena fedele in `public/assets/fps/terminal/terminal.glb`, con assi Y-up, scala dichiarata in metri e coordinate relative preservate. Registrare ogni omissione per nome, istanza e causa.
5. Verificare geometria, scala/assi, risorse mancanti e caricamento in una pagina Babylon separata. Nessun test multiplayer o modifica del gameplay/catalogo/armi/spawn. Nessun commit, push o deploy.

Proprietà del lavoro: esecuzione diretta con Sol, coerentemente con la precedente richiesta dell’utente. Il controllo statico della skill di orchestrazione rileva Sol; non sono soddisfatte le condizioni per una delega con radice Astra. Nessuna delega o variazione del modello.

Output: script riproducibili, inventario e conteggi, prova piccola, GLB dichiarato completo o parziale sulla base delle dipendenze, anteprima navigabile, report sintetico con fonti e limiti.
