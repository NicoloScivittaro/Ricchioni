"""Evidenza delle fonti geografiche; nessun contenuto remoto nel gioco."""
import json,re,urllib.request,concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DOC=ROOT/'docs/agent-work/geofall'
rows=json.loads((ROOT/'shared/geofallCountries.json').read_text(encoding='utf8'))
def audit(c):
    url=c['monumentSource']
    try:
        response=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=15)
        text=response.read().decode('utf8',errors='replace');title=re.search(r'<title[^>]*>(.*?)</title>',text,re.S|re.I)
        return {'country':c['id'],'monument':c['monument'],'url':url,'status':response.status,'title':re.sub(r'\s+',' ',title[1]).strip() if title else ''}
    except Exception as e:return {'country':c['id'],'monument':c['monument'],'url':url,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:result=list(pool.map(audit,rows))
(DOC/'monument-source-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
text='''# Fonti e criteri geografici — Geofall

Snapshot:12 ottobre2026. Il motore usa soltanto JSON e SVG locali. Le immagini dei monumenti sono illustrazioni schematiche originali, con didascalia del monumento; non sono fotografie copiate dai siti citati.

- Capitali e vicini terrestri: [GeoNames countryInfo](https://download.geonames.org/export/dump/countryInfo.txt), [licenza CC BY e fonti](https://www.geonames.org/export/). Attribuzione: GeoNames. Lo snapshot con hash è in source-snapshot.json. Venti capitali confrontate con la fonte, poi localizzate in italiano. Nessuna capitale multipla o contestata nel set.
- Sagome: [Natural Earth Admin0](https://www.naturalearthdata.com/downloads/110m-cultural-vectors/110m-admin-0-countries/), [public domain](https://www.naturalearthdata.com/about/terms-of-use/). Riduzione SVG dal GeoJSON dell'autore; regioni oltremare lontane escluse dalla sagoma. Sono sagome didattiche, non mappe ufficiali dei confini.
- Bandiere: [flag-icons](https://github.com/lipis/flag-icons), MIT. File locali scaricati dal repository dell'autore, licenza completa in public/geofall/FLAG-ICONS-LICENSE.txt.
- Confini: le nove opzioni sbagliate escludono tutti i vicini del bersaglio e le adiacenze reciproche. GeoNames viene integrato con fonti governative per Canada–Danimarca, Francia–Brasile/Suriname e Spagna–Marocco: sourceNeighbors conserva il dato grezzo e neighbors contiene anche questi confini sovrani. [Canada/Danimarca](https://www.canada.ca/en/global-affairs/news/2022/06/canada-and-the-kingdom-of-denmark-together-with-greenland-reach-historic-agreement-on-long-standing-boundary-disputes.html), [Francia/Brasile](https://www.diplomatie.gouv.fr/fr/information-par-pays/bresil/relations-bilaterales), [Francia/Suriname](https://www.diplomatie.gouv.fr/fr/information-par-pays/suriname/politique-et-economie), [Spagna/Marocco](https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/exteriores/Paginas/2026/110826-albares-visita-ceuta.aspx). Francia qualificata esplicitamente come metropolitana nella propria domanda; Francia esclusa dai distrattori della domanda sul Brasile. Nessuna domanda su confini marittimi. Per il Brasile viene proposta Argentina, mai un territorio d'oltremare come paese. I vicini esterni al pool usati come risposte sono Argentina, Sudan e Ungheria, presenti nel countryInfo.
- Monumenti: una sola illustrazione per paese nel pool, così nessun distrattore della domanda è un secondo monumento nello stesso paese. Ubicazioni controllate sui riferimenti UNESCO/gestori/turismo riportati sotto. Il file monument-source-audit.json registra accessibilità e titoli delle pagine; eventuale HTTP403 non è un errore di runtime e non viene contato come consultazione riuscita.

La validazione100 domande controlla10 identificativi e10 etichette distinti, una sola risposta ammessa,20/categoria, asset presenti e regole dei vicini. La verifica automatica non è una nuova certificazione geografica indipendente dalla fonte. Per ampliare il set, aggiungere JSON e fonti/asset, poi eseguire geofall-selftest.ts.

| Paese | Capitale italiana | Capitale nella fonte | Monumento e riferimento |
| --- | --- | --- | --- |
'''
for c in rows:text+=f"| {c['name']} | {c['capital']} | {c['sourceCapital']} | [{c['monument']}]({c['monumentSource']}) |\n"
(DOC/'SOURCES.md').write_text(text,encoding='utf8')
print(json.dumps(result,ensure_ascii=True))
