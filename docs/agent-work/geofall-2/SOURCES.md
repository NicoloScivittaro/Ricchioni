# Geofall2 — fonti e criteri

Snapshot dei dati consultati:12 ottobre2026. Il runtime usa JSON/SVG locali e non chiama servizi geografici.

Le100 domande originali sono conservate integralmente. Le75 aggiunte hanno15 elementi per categoria,8 difficili(livello3) e7 estremi(livello4).

- Capitali e vicini: [GeoNames](https://www.geonames.org/countries/), snapshot countryInfo.txt con SHA256 in source-snapshot.json. Nomi localizzati solo dove necessario. Sono stati evitati Palau(Melekeok/Ngerulmud) e Kiribati(Tarawa/Tarawa Sud) per non propagare ambiguità del dataset.
- Confini: ogni distrattore è escluso dal vicinato diretto e reciproco; selezione fra paesi della stessa regione continentale, ordinati per prossimità. Botswana/Zambia: GeoNames omette il confine, corretto con [Kazungula Bridge Authority Act](https://www.parliament.gov.zm/node/11873). Nessuna domanda su territori o linee contese; sono inclusi paesi con confinanti certi.
- Sagome: [NaturalEarth50m](https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries/), public domain, poligono continentale principale e proiezione locale scalata. Sono illustrazioni didattiche del profilo, non carte ufficiali di confine. SVG430×350 utili dentro viewBox500×400.
- Bandiere: [country-flags dell’autore](https://github.com/hampusborgos/country-flags/blob/main/README.md), originali Wikimedia Commons/normative nazionali secondo il manutentore, public domain. Sono conservati viewBox, colori e simboli; dimensione raster di riferimento1000px con rapporto nativo. Anche20 vecchie bandiere, prima icone4:3, sono corrette agli stessiURL. Audit36 file con rapporto/SHA256. Monaco4:5, Indonesia2:3, Irlanda1:2, Costa d’Avorio2:3. [Fonte governativaIndonesia](https://setneg.go.id/baca/index/jelang_17_agustus_kementerian_sekretariat_negara_serahkan_bendera_merah_putih_ke_seluruh_daerah) e [fonteIrlanda](https://www.military.ie/en/public-information/defence-forces-museums/defence-forces-history/the-national-flag/). Ciad/Romania non sono confrontati direttamente: le sfumature sono un criterio poco affidabile sulla TV. Mali/Guinea, Irlanda/Costa d’Avorio, Indonesia/Monaco sono distinguibili per ordine dei colori/proporzioni.
- Monumenti: ubicazione da UNESCO e amministrazione pubblica di Paro per Taktsang;15 paesi distinti, una sola risposta del paese chiesto. Illustrazioni SVG schematiche originali, senza nomi nel disegno, né fotografie copiate; le etichette delle risposte rimangono quelle del gioco.

source-audit.json registra45 URL:29 letture HTTP dirette riuscite.14 pagine UNESCO restituiscono403 allo script Python, NaturalEarth406 e il sito parlamentare una catenaTLS non validata dal Python locale. Le stesse fonti primarie sono state consultate con successo tramite lo strumento web; non sono state aggirate verificheTLS o contati403 come successi. Validazione automatica delle risposte confrontata con lo snapshot della fonte e controllo separato del casoBotswana/Zambia. Non è una certificazione geografica indipendente dai dati citati.

| Nuova domanda | Livello | Risposta | Fonte |
| --- | --- | --- | --- |
| advanced-bandiere-TD | 3 | Ciad | [Riferimento](https://www.geonames.org/countries/TD/) |
| advanced-bandiere-ML | 3 | Mali | [Riferimento](https://www.geonames.org/countries/ML/) |
| advanced-bandiere-GN | 3 | Guinea | [Riferimento](https://www.geonames.org/countries/GN/) |
| advanced-bandiere-CI | 3 | Costa d’Avorio | [Riferimento](https://www.geonames.org/countries/CI/) |
| advanced-bandiere-ID | 3 | Indonesia | [Riferimento](https://www.geonames.org/countries/ID/) |
| advanced-bandiere-MC | 3 | Monaco | [Riferimento](https://www.geonames.org/countries/MC/) |
| advanced-bandiere-BF | 3 | Burkina Faso | [Riferimento](https://www.geonames.org/countries/BF/) |
| advanced-bandiere-BJ | 3 | Benin | [Riferimento](https://www.geonames.org/countries/BJ/) |
| advanced-bandiere-GH | 4 | Ghana | [Riferimento](https://www.geonames.org/countries/GH/) |
| advanced-bandiere-CM | 4 | Camerun | [Riferimento](https://www.geonames.org/countries/CM/) |
| advanced-bandiere-SN | 4 | Senegal | [Riferimento](https://www.geonames.org/countries/SN/) |
| advanced-bandiere-NA | 4 | Namibia | [Riferimento](https://www.geonames.org/countries/NA/) |
| advanced-bandiere-BW | 4 | Botswana | [Riferimento](https://www.geonames.org/countries/BW/) |
| advanced-bandiere-FJ | 4 | Figi | [Riferimento](https://www.geonames.org/countries/FJ/) |
| advanced-bandiere-WS | 4 | Samoa | [Riferimento](https://www.geonames.org/countries/WS/) |
| advanced-confini-BT | 3 | India | [Riferimento](https://www.geonames.org/countries/BT/) |
| advanced-confini-LA | 3 | Vietnam | [Riferimento](https://www.geonames.org/countries/LA/) |
| advanced-confini-MN | 3 | Russia | [Riferimento](https://www.geonames.org/countries/MN/) |
| advanced-confini-KG | 3 | Uzbekistan | [Riferimento](https://www.geonames.org/countries/KG/) |
| advanced-confini-NA | 3 | Angola | [Riferimento](https://www.geonames.org/countries/NA/) |
| advanced-confini-BW | 3 | Namibia | [Riferimento](https://www.geonames.org/countries/BW/) |
| advanced-confini-TD | 3 | Camerun | [Riferimento](https://www.geonames.org/countries/TD/) |
| advanced-confini-ML | 3 | Guinea | [Riferimento](https://www.geonames.org/countries/ML/) |
| advanced-confini-GN | 4 | Sierra Leone | [Riferimento](https://www.geonames.org/countries/GN/) |
| advanced-confini-CI | 4 | Ghana | [Riferimento](https://www.geonames.org/countries/CI/) |
| advanced-confini-BJ | 4 | Nigeria | [Riferimento](https://www.geonames.org/countries/BJ/) |
| advanced-confini-GH | 4 | Togo | [Riferimento](https://www.geonames.org/countries/GH/) |
| advanced-confini-CM | 4 | Gabon | [Riferimento](https://www.geonames.org/countries/CM/) |
| advanced-confini-SN | 4 | Gambia | [Riferimento](https://www.geonames.org/countries/SN/) |
| advanced-confini-BF | 4 | Benin | [Riferimento](https://www.geonames.org/countries/BF/) |
| advanced-capitali-BT | 3 | Thimphu | [Riferimento](https://www.geonames.org/countries/BT/) |
| advanced-capitali-LA | 3 | Vientiane | [Riferimento](https://www.geonames.org/countries/LA/) |
| advanced-capitali-MN | 3 | Ulaanbaatar | [Riferimento](https://www.geonames.org/countries/MN/) |
| advanced-capitali-KG | 3 | Bishkek | [Riferimento](https://www.geonames.org/countries/KG/) |
| advanced-capitali-NA | 3 | Windhoek | [Riferimento](https://www.geonames.org/countries/NA/) |
| advanced-capitali-BW | 3 | Gaborone | [Riferimento](https://www.geonames.org/countries/BW/) |
| advanced-capitali-FJ | 3 | Suva | [Riferimento](https://www.geonames.org/countries/FJ/) |
| advanced-capitali-WS | 3 | Apia | [Riferimento](https://www.geonames.org/countries/WS/) |
| advanced-capitali-TO | 4 | Nuku’alofa | [Riferimento](https://www.geonames.org/countries/TO/) |
| advanced-capitali-VU | 4 | Port Vila | [Riferimento](https://www.geonames.org/countries/VU/) |
| advanced-capitali-SB | 4 | Honiara | [Riferimento](https://www.geonames.org/countries/SB/) |
| advanced-capitali-FM | 4 | Palikir | [Riferimento](https://www.geonames.org/countries/FM/) |
| advanced-capitali-MH | 4 | Majuro | [Riferimento](https://www.geonames.org/countries/MH/) |
| advanced-capitali-MU | 4 | Port Louis | [Riferimento](https://www.geonames.org/countries/MU/) |
| advanced-capitali-SC | 4 | Victoria | [Riferimento](https://www.geonames.org/countries/SC/) |
| advanced-sagome-BT | 3 | Bhutan | [Riferimento](https://www.geonames.org/countries/BT/) |
| advanced-sagome-LA | 3 | Laos | [Riferimento](https://www.geonames.org/countries/LA/) |
| advanced-sagome-MN | 3 | Mongolia | [Riferimento](https://www.geonames.org/countries/MN/) |
| advanced-sagome-KG | 3 | Kirghizistan | [Riferimento](https://www.geonames.org/countries/KG/) |
| advanced-sagome-NA | 3 | Namibia | [Riferimento](https://www.geonames.org/countries/NA/) |
| advanced-sagome-BW | 3 | Botswana | [Riferimento](https://www.geonames.org/countries/BW/) |
| advanced-sagome-TD | 3 | Ciad | [Riferimento](https://www.geonames.org/countries/TD/) |
| advanced-sagome-ML | 3 | Mali | [Riferimento](https://www.geonames.org/countries/ML/) |
| advanced-sagome-GN | 4 | Guinea | [Riferimento](https://www.geonames.org/countries/GN/) |
| advanced-sagome-CI | 4 | Costa d’Avorio | [Riferimento](https://www.geonames.org/countries/CI/) |
| advanced-sagome-BJ | 4 | Benin | [Riferimento](https://www.geonames.org/countries/BJ/) |
| advanced-sagome-GH | 4 | Ghana | [Riferimento](https://www.geonames.org/countries/GH/) |
| advanced-sagome-CM | 4 | Camerun | [Riferimento](https://www.geonames.org/countries/CM/) |
| advanced-sagome-SN | 4 | Senegal | [Riferimento](https://www.geonames.org/countries/SN/) |
| advanced-sagome-BF | 4 | Burkina Faso | [Riferimento](https://www.geonames.org/countries/BF/) |
| advanced-monumenti-KH | 3 | Angkor Wat | [Riferimento](https://whc.unesco.org/en/list/668/) |
| advanced-monumenti-ID | 3 | Borobudur | [Riferimento](https://whc.unesco.org/en/list/592/) |
| advanced-monumenti-MM | 3 | Templi di Bagan | [Riferimento](https://whc.unesco.org/en/list/1588/) |
| advanced-monumenti-LA | 3 | Vat Phou | [Riferimento](https://whc.unesco.org/en/list/481/) |
| advanced-monumenti-BT | 3 | Paro Taktsang | [Riferimento](https://paro.gov.bt/religious-site/taktshang-tiger-nest-monastery/) |
| advanced-monumenti-LK | 3 | Sigiriya | [Riferimento](https://whc.unesco.org/en/list/202/) |
| advanced-monumenti-NP | 3 | Swayambhunath | [Riferimento](https://whc.unesco.org/en/list/121/) |
| advanced-monumenti-TH | 3 | Templi di Ayutthaya | [Riferimento](https://whc.unesco.org/en/list/576/) |
| advanced-monumenti-VN | 4 | Ponte giapponese di Hoi An | [Riferimento](https://whc.unesco.org/en/list/948/) |
| advanced-monumenti-ZW | 4 | Grande Zimbabwe | [Riferimento](https://whc.unesco.org/en/list/364/) |
| advanced-monumenti-ML | 4 | Grande Moschea di Djenné | [Riferimento](https://whc.unesco.org/en/list/116/) |
| advanced-monumenti-ET | 4 | Chiesa di San Giorgio a Lalibela | [Riferimento](https://whc.unesco.org/en/list/18/) |
| advanced-monumenti-TZ | 4 | Rovine di Kilwa Kisiwani | [Riferimento](https://whc.unesco.org/en/list/144/) |
| advanced-monumenti-SN | 4 | Casa degli Schiavi di Gorée | [Riferimento](https://whc.unesco.org/en/list/26/) |
| advanced-monumenti-IR | 4 | Persepoli | [Riferimento](https://whc.unesco.org/en/list/114/) |
