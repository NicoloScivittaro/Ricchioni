# Fonti e criteri geografici — Geofall

Snapshot:12 ottobre 2026. Il motore usa soltanto JSON e SVG locali. Le immagini dei monumenti sono illustrazioni schematiche originali, con didascalia del monumento; non sono fotografie copiate dai siti citati.

- Capitali e vicini terrestri: [GeoNames countryInfo](https://download.geonames.org/export/dump/countryInfo.txt), [licenza CC BY e fonti](https://www.geonames.org/export/). Attribuzione: GeoNames. Lo snapshot con hash è in source-snapshot.json. Venti capitali confrontate con la fonte, poi localizzate in italiano. Nessuna capitale multipla o contestata nel set.
- Sagome: [Natural Earth Admin 0](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/), [public domain](https://www.naturalearthdata.com/about/terms-of-use/). Riduzione SVG dal GeoJSON dell'autore; regioni oltremare lontane escluse dalla sagoma. Sono sagome didattiche, non mappe ufficiali dei confini.
- Bandiere: [flag-icons](https://github.com/lipis/flag-icons), MIT. File locali scaricati dal repository dell'autore, licenza completa in public/geofall/FLAG-ICONS-LICENSE.txt.
- Confini: le nove opzioni sbagliate escludono tutti i vicini del bersaglio e le adiacenze reciproche. GeoNames viene integrato con fonti governative per Canada–Danimarca, Francia–Brasile/Suriname e Spagna–Marocco: sourceNeighbors conserva il dato grezzo e neighbors contiene anche questi confini sovrani. [Canada/Danimarca](https://www.canada.ca/en/global-affairs/news/2022/06/canada-and-the-kingdom-of-denmark-together-with-greenland-reach-historic-agreement-on-long-standing-boundary-disputes.html), [Francia/Brasile](https://www.diplomatie.gouv.fr/fr/information-par-pays/bresil/relations-bilaterales), [Francia/Suriname](https://www.diplomatie.gouv.fr/fr/information-par-pays/suriname/politique-et-economie), [Spagna/Marocco](https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/exteriores/Paginas/2026/110826-albares-visita-ceuta.aspx). Francia qualificata esplicitamente come metropolitana nella propria domanda; Francia esclusa dai distrattori della domanda sul Brasile. Nessuna domanda su confini marittimi. Per il Brasile viene proposta Argentina, mai un territorio d'oltremare come paese. I vicini esterni al pool usati come risposte sono Argentina, Sudan e Ungheria, presenti nel countryInfo.
- Monumenti: una sola illustrazione per paese nel pool, così nessun distrattore della domanda è un secondo monumento nello stesso paese. Ubicazioni controllate sui riferimenti UNESCO/gestori/turismo riportati sotto. Il file monument-source-audit.json registra accessibilità e titoli delle pagine; eventuale HTTP 403 non è un errore di runtime e non viene contato come consultazione riuscita.

La validazione 100 domande controlla 10 identificativi e 10 etichette distinti, una sola risposta ammessa,20/categoria, asset presenti e regole dei vicini. La verifica automatica non è una nuova certificazione geografica indipendente dalla fonte. Per ampliare il set, aggiungere JSON e fonti/asset, poi eseguire geofall-selftest.ts.

| Paese | Capitale italiana | Capitale nella fonte | Monumento e riferimento |
| --- | --- | --- | --- |
| Italia | Roma | Rome | [Colosseo](https://colosseo.it/en/) |
| Francia | Parigi | Paris | [Torre Eiffel](https://www.toureiffel.paris/en) |
| Germania | Berlino | Berlin | [Porta di Brandeburgo](https://www.visitberlin.de/en/brandenburg-gate) |
| Spagna | Madrid | Madrid | [Sagrada Familia](https://sagradafamilia.org/en/home) |
| Portogallo | Lisbona | Lisbon | [Torre di Belém](https://whc.unesco.org/en/list/263/) |
| Belgio | Bruxelles | Brussels | [Atomium](https://atomium.be/) |
| Austria | Vienna | Vienna | [Palazzo di Schönbrunn](https://whc.unesco.org/en/list/786/) |
| Svezia | Stoccolma | Stockholm | [Palazzo di Drottningholm](https://whc.unesco.org/en/list/559/) |
| Norvegia | Oslo | Oslo | [Chiesa di Urnes](https://whc.unesco.org/en/list/58/) |
| Finlandia | Helsinki | Helsinki | [Duomo di Helsinki](https://www.myhelsinki.fi/places/helsinki-cathedral/) |
| Polonia | Varsavia | Warsaw | [Castello di Malbork](https://whc.unesco.org/en/list/847/) |
| Romania | Bucarest | Bucharest | [Castello di Bran](https://bran-castle.com/) |
| Grecia | Atene | Athens | [Partenone](https://whc.unesco.org/en/list/404/) |
| Turchia | Ankara | Ankara | [Santa Sofia](https://whc.unesco.org/en/list/356/) |
| Egitto | Il Cairo | Cairo | [Piramidi di Giza](https://whc.unesco.org/en/list/86/) |
| India | Nuova Delhi | New Delhi | [Taj Mahal](https://whc.unesco.org/en/list/252/) |
| Cina | Pechino | Beijing | [Grande Muraglia](https://whc.unesco.org/en/list/438/) |
| Canada | Ottawa | Ottawa | [CN Tower](https://www.cntower.ca/) |
| Stati Uniti | Washington, D.C. | Washington | [Statua della Libertà](https://www.nps.gov/stli/index.htm) |
| Brasile | Brasilia | Brasilia | [Cristo Redentore](https://whc.unesco.org/en/list/1100/) |
