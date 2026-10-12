"""Build locale riproducibile: GeoNames, Natural Earth, flag-icons; SVG monumenti originali.
Nessun servizio nel runtime. Non sostituisce asset esistenti degli altri giochi.
"""
import json, math, urllib.request, concurrent.futures, html, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/geofall'; DOC=ROOT/'docs/agent-work/geofall'
OUT.mkdir(parents=True,exist_ok=True); DOC.mkdir(parents=True,exist_ok=True)
def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'PartyGame-content-audit/1.0'}),timeout=45).read()
SOURCE='https://download.geonames.org/export/dump/countryInfo.txt'
raw=fetch(SOURCE).decode(); info={}
for line in raw.splitlines():
    if line and not line.startswith('#'):
        r=line.split('\t'); info[r[0]]={'capital':r[5],'neighbors':r[17].split(','),'sourceNeighbors':r[17].split(','),'iso3':r[1]}
BRAZIL_SOURCE='https://www.diplomatie.gouv.fr/fr/information-par-pays/bresil/relations-bilaterales'
SURINAME_SOURCE='https://www.diplomatie.gouv.fr/fr/information-par-pays/suriname/politique-et-economie'
CANADA_SOURCE='https://www.canada.ca/en/global-affairs/news/2022/06/canada-and-the-kingdom-of-denmark-together-with-greenland-reach-historic-agreement-on-long-standing-boundary-disputes.html'
SPAIN_SOURCE='https://www.lamoncloa.gob.es/serviciosdeprensa/notasprensa/exteriores/Paginas/2026/110826-albares-visita-ceuta.aspx'
# GeoNames separates overseas territories and omits some modern sovereign boundaries.
# Supplement with primary governmental sources before building country distractors.
corrections={'FR':(['BR','SR'],[BRAZIL_SOURCE,SURINAME_SOURCE]),'BR':(['FR'],[BRAZIL_SOURCE]),'CA':(['DK'],[CANADA_SOURCE]),'ES':(['MA'],[SPAIN_SOURCE])}
for code,(neighbors,sources) in corrections.items():
    info[code]['neighbors']=sorted(set(info[code]['neighbors']+neighbors))
rows=[
 ('IT','Italia','Roma','Colosseo','https://colosseo.it/en/'),
 ('FR','Francia','Parigi','Torre Eiffel','https://www.toureiffel.paris/en'),
 ('DE','Germania','Berlino','Porta di Brandeburgo','https://www.visitberlin.de/en/brandenburg-gate'),
 ('ES','Spagna','Madrid','Sagrada Familia','https://sagradafamilia.org/en/home'),
 ('PT','Portogallo','Lisbona','Torre di Belém','https://whc.unesco.org/en/list/263/'),
 ('BE','Belgio','Bruxelles','Atomium','https://atomium.be/'),
 ('AT','Austria','Vienna','Palazzo di Schönbrunn','https://whc.unesco.org/en/list/786/'),
 ('SE','Svezia','Stoccolma','Palazzo di Drottningholm','https://whc.unesco.org/en/list/559/'),
 ('NO','Norvegia','Oslo','Chiesa di Urnes','https://whc.unesco.org/en/list/58/'),
 ('FI','Finlandia','Helsinki','Duomo di Helsinki','https://www.myhelsinki.fi/places/helsinki-cathedral/'),
 ('PL','Polonia','Varsavia','Castello di Malbork','https://whc.unesco.org/en/list/847/'),
 ('RO','Romania','Bucarest','Castello di Bran','https://bran-castle.com/'),
 ('GR','Grecia','Atene','Partenone','https://whc.unesco.org/en/list/404/'),
 ('TR','Turchia','Ankara','Santa Sofia','https://whc.unesco.org/en/list/356/'),
 ('EG','Egitto','Il Cairo','Piramidi di Giza','https://whc.unesco.org/en/list/86/'),
 ('IN','India','Nuova Delhi','Taj Mahal','https://whc.unesco.org/en/list/252/'),
 ('CN','Cina','Pechino','Grande Muraglia','https://whc.unesco.org/en/list/438/'),
 ('CA','Canada','Ottawa','CN Tower','https://www.cntower.ca/'),
 ('US','Stati Uniti','Washington, D.C.','Statua della Libertà','https://www.nps.gov/stli/index.htm'),
 ('BR','Brasile','Brasilia','Cristo Redentore','https://whc.unesco.org/en/list/1100/')]
# English/transliteration from the downloaded snapshot -> localized display.
expected=['Rome','Paris','Berlin','Madrid','Lisbon','Brussels','Vienna','Stockholm','Oslo','Helsinki','Warsaw','Bucharest','Athens','Ankara','Cairo','New Delhi','Beijing','Ottawa','Washington','Brasilia']
for r,e in zip(rows,expected): assert info[r[0]]['capital']==e,(r[0],info[r[0]]['capital'],e)
geoUrl='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
geo=json.loads(fetch(geoUrl)); countries=[]
for code,name,cap,mon,src in rows:
    f=next(f for f in geo['features'] if f['properties']['ADM0_A3']==info[code]['iso3'])
    polys=f['geometry']['coordinates']; polys=[polys] if f['geometry']['type']=='Polygon' else polys
    def area(p): return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p[0],p[0][1:])))
    main=max(polys,key=area)[0]; cx=sum(p[0] for p in main)/len(main); cy=sum(p[1] for p in main)/len(main)
    # Exclude overseas regions from the silhouette; preserve nearby islands.
    pts=[[p for p in poly[0]] for poly in polys if abs(sum(p[0] for p in poly[0])/len(poly[0])-cx)<25 and abs(sum(p[1] for p in poly[0])/len(poly[0])-cy)<22]
    k=math.cos(math.radians(cy)); pts=[[(x*k,-y) for x,y,*_ in poly] for poly in pts]
    xx=[x for poly in pts for x,y in poly]; yy=[y for poly in pts for x,y in poly]; scale=min(360/(max(xx)-min(xx)),280/(max(yy)-min(yy)))
    ox=200-(max(xx)+min(xx))*scale/2; oy=160-(max(yy)+min(yy))*scale/2
    paths=' '.join('M'+' L'.join(f'{x*scale+ox:.1f},{y*scale+oy:.1f}' for x,y in poly)+'Z' for poly in pts)
    (OUT/f'outline-{code}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320"><path d="{paths}" fill="#173859" stroke="#102941" stroke-width="2" stroke-linejoin="round"/></svg>',encoding='utf8')
    countries.append({'id':code,'name':name,'capital':cap,'sourceCapital':info[code]['capital'],'sourceNeighbors':info[code]['sourceNeighbors'],'neighbors':info[code]['neighbors'],'neighborSources':[SOURCE]+corrections.get(code,([],[]))[1],'monument':mon,'monumentSource':src,'flag':f'/geofall/flag-{code}.svg','outline':f'/geofall/outline-{code}.svg','monumentImage':f'/geofall/monument-{code}.svg'})
def flag(r):
    code=r[0]; data=fetch(f'https://raw.githubusercontent.com/lipis/flag-icons/main/flags/4x3/{code.lower()}.svg'); assert b'<svg' in data
    (OUT/f'flag-{code}.svg').write_bytes(data)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(flag,rows))
(OUT/'FLAG-ICONS-LICENSE.txt').write_bytes(fetch('https://raw.githubusercontent.com/lipis/flag-icons/main/LICENSE'))
# Illustrations are schematic, original vector drawings, with readable captions in game.
draw={
 'IT':'<ellipse cx="200" cy="145" rx="160" ry="65" fill="#d7ac78"/><path d="M40 145v95q160 80 320 0v-95" fill="#d7ac78"/>'+''.join(f'<path d="M{x} 175q12-30 24 0v35h-24z M{x} 225q12-30 24 0v35h-24z" fill="#5f4935"/>' for x in range(65,340,35)),
 'FR':'<path d="M200 25L175 130 155 215 110 290H145L182 220H218L255 290H290L245 215 225 130Z" fill="#71604f"/><path d="M200 55v160 M175 130h50 M160 200h80 M145 250h110 M160 200l65-70 M240 200l-65-70" fill="none" stroke="#c7a881" stroke-width="8"/><path d="M182 290v-30q18-35 36 0v30" fill="#e9f5ff"/>',
 'DE':'<path d="M50 130h300v30H50z M40 250h320v25H40z" fill="#dbc89e"/>'+''.join(f'<path d="M{x} 160v90h24v-90" fill="#c9b48a"/>' for x in range(65,330,48))+'<path d="M155 130v-25h90v25 M175 105v-20h50v20" fill="#416a5a"/>',
 'ES':'<path d="M65 285V150l20-105 20 105v135 M125 285V120l20-100 20 100v165 M195 285V125l20-110 20 110v160 M265 285V150l20-105 20 105v135" fill="#c2936b" stroke="#775034" stroke-width="8"/><path d="M110 285v-70q90-70 180 0v70" fill="#d8af81"/>',
 'PT':'<path d="M115 280V100h170v180 M95 280v-55h210v55" fill="#ded2a5"/><path d="M110 100h180v-20H110z M100 225h200v-25H100z" fill="#b6a577"/>'+''.join(f'<rect x="{x}" y="58" width="23" height="24" fill="#b6a577"/>' for x in (115,155,195,235,270))+'<path d="M170 270v-60q30-40 60 0v60" fill="#6b695c"/>',
 'BE':'<g stroke="#728495" stroke-width="12"><path d="M200 50L85 120 100 230 200 270 310 230 320 115 200 50 200 270 M85 120l225 110 M320 115L100 230 M200 160L200 50 M85 120L200 160 320 115 M100 230L200 160 310 230"/></g>'+''.join(f'<circle cx="{x}" cy="{y}" r="27" fill="#a9c8dd" stroke="#415d76" stroke-width="5"/>' for x,y in [(200,50),(85,120),(100,230),(200,270),(310,230),(320,115),(200,160)]),
 'AT':'<path d="M30 150h340v130H30z" fill="#edcf73"/><path d="M30 150l30-30h280l30 30 M140 120v-30h120v30" fill="#796657"/>'+''.join(f'<rect x="{x}" y="175" width="18" height="32" fill="#5d7281"/>' for x in range(50,350,30))+'<path d="M178 280v-52q22-35 44 0v52" fill="#705446"/>',
 'SE':'<path d="M40 160h320v120H40 M145 135h110v145H145" fill="#e4c476"/><path d="M35 160l45-40h70 M365 160l-45-40h-70 M140 135l60-45 60 45" fill="#728177"/><path d="M175 280v-80h50v80" fill="#4d6775"/>'+''.join(f'<rect x="{x}" y="180" width="20" height="36" fill="#4d6775"/>' for x in (60,100,280,320)),
 'NO':'<path d="M90 270V160h220v110 M125 160v-55h150v55 M155 105V65h90v40" fill="#6e422f"/><path d="M65 165l135-70 135 70 M100 110l100-55 100 55 M140 70l60-40 60 40" fill="#432a26"/><path d="M175 270v-50q25-35 50 0v50" fill="#262726"/>',
 'FI':'<path d="M45 260h310v25H45 M70 260V160h260v100" fill="#eeebe4"/><path d="M60 160l140-45 140 45" fill="#d7dfe2"/><path d="M160 120V90q0-70 40-70t40 70v30" fill="#4d9c8c"/><path d="M197 5v20h6V5" fill="#ba9552"/>'+''.join(f'<rect x="{x}" y="168" width="14" height="80" fill="#bdc9cc"/>' for x in range(100,315,35)),
 'PL':'<path d="M45 285V160h310v125 M100 160V90h55v195 M240 285V100h55v185" fill="#b96347"/><path d="M35 160l25-40 25 40 M90 90l37-50 38 50 M230 100l38-50 37 50 M290 160l35-45 35 45" fill="#704538"/>'+''.join(f'<rect x="{x}" y="200" width="16" height="30" fill="#543d31"/>' for x in range(70,335,40)),
 'RO':'<path d="M60 280V170h260v110 M90 170V90h60v190 M240 280V110h55v170" fill="#ded6c7"/><path d="M50 170l30-35 35 35 M78 90l42-60 42 60 M226 110l42-70 42 70 M160 160l35-65 40 65" fill="#9b493c"/><path d="M175 280v-70q20-30 40 0v70" fill="#66503d"/>',
 'GR':'<path d="M40 285h320v-22H40 M50 140l150-60 150 60Z M50 140v20h300v-20" fill="#e7d4a8"/>'+''.join(f'<rect x="{x}" y="160" width="25" height="105" fill="#cab88f"/>' for x in range(65,340,45)),
 'TR':'<path d="M65 275V175h270v100 M115 175v-35q85-130 170 0v35" fill="#ceae83"/><path d="M115 140q85-130 170 0" fill="#a48165"/><path d="M40 275V85l10-55 10 55v190 M340 275V85l10-55 10 55v190" fill="#decaa3"/><path d="M180 275v-60q20-30 40 0v60" fill="#65554c"/>',
 'EG':'<path d="M20 275L145 65 270 275Z" fill="#d7a548"/><path d="M145 65l45 210h80Z" fill="#9c6d29"/><path d="M220 275l85-155 75 155Z" fill="#e7bd6d"/><path d="M305 120l15 155h60Z" fill="#b1853c"/>',
 'IN':'<path d="M85 275V165h230v110 M145 165v-40q0-45 55-80 55 35 55 80v40" fill="#f5ead2"/><path d="M145 125q55-95 110 0" fill="#d9d8d3"/><path d="M40 275V100h20v175 M340 275V100h20v175" fill="#e8dfc8"/><path d="M180 275v-65q20-35 40 0v65" fill="#526372"/><path d="M200 25v22" stroke="#ae8e39" stroke-width="6"/>',
 'CN':'<path d="M25 255l75-80 80 25 75-90 100 55v60l-100-55-70 90-85-25-75 80Z" fill="#b39972" stroke="#786547" stroke-width="7"/><path d="M75 180v-60h50v60 M235 125V70h50v55 M320 155V95h50v60" fill="#b39972"/>'+''.join(f'<rect x="{x}" y="{y}" width="12" height="18" fill="#b39972"/>' for x,y in [(75,102),(112,102),(235,52),(272,52),(320,77),(358,77)]),
 'CA':'<path d="M190 290l5-190h10l5 190Z" fill="#c3cdd5"/><ellipse cx="200" cy="100" rx="65" ry="15" fill="#728795"/><path d="M155 100V82h90v18" fill="#b7c6d1"/><path d="M200 15v67" stroke="#526c7c" stroke-width="6"/>',
 'US':'<path d="M155 280l25-140-30-40 15-65 20 10-7 48 27 22 25-10 15 100-15 75Z" fill="#62a78d"/><circle cx="202" cy="102" r="20" fill="#62a78d"/><path d="M130 280h130v25H130 M166 85l18-17 5 16 13-22 12 23 15-18 8 23" fill="#62a78d"/><path d="M163 32l-7-18 15 5-1 17" fill="#eabc40"/>',
 'BR':'<circle cx="200" cy="85" r="25" fill="#ddd8ce"/><path d="M180 110l-120 15v25l115-10-20 130h90l-20-130 115 10v-25l-120-15Z" fill="#ddd8ce"/><path d="M140 270h120v25H140" fill="#8b938b"/><path d="M180 140l20 90 20-90" fill="none" stroke="#9fa8a4" stroke-width="5"/>'}
for code,_,_,mon,_ in rows:
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320"><title>{html.escape(mon)}</title><rect width="400" height="320" rx="20" fill="#e9f5ff"/>{draw[code]}</svg>'
    (OUT/f'monument-{code}.svg').write_text(svg,encoding='utf8')
(ROOT/'shared/geofallCountries.json').write_text(json.dumps(countries,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
questions=[]; byId={c['id']:c for c in countries}
articles={'IT':"l'",'FR':'la ','DE':'la ','ES':'la ','PT':'il ','BE':'il ','AT':"l'",'SE':'la ','NO':'la ','FI':'la ','PL':'la ','RO':'la ','GR':'la ','TR':'la ','EG':"l'",'IN':"l'",'CN':'la ','CA':'il ','US':'gli ','BR':'il '}
of={'IT':"dell'",'FR':'della ','DE':'della ','ES':'della ','PT':'del ','BE':'del ','AT':"dell'",'SE':'della ','NO':'della ','FI':'della ','PL':'della ','RO':'della ','GR':'della ','TR':'della ','EG':"dell'",'IN':"dell'",'CN':'della ','CA':'del ','US':'degli ','BR':'del '}
extraNames={'SD':'Sudan','HU':'Ungheria','AR':'Argentina'}
for i,c in enumerate(countries):
    difficulty=1 if i in (0,1,2,3,14,15,16,17,18,19) else 2
    def option(v,kind):
        if kind=='capitali': return {'id':v['id'],'label':v['capital']}
        if kind=='monumenti': return {'id':v['id'],'label':v['monument'],'image':v['monumentImage']}
        return {'id':v['id'],'label':v['name'],'image':v['flag'] if kind=='bandiere' else v['outline']}
    for kind,verb in [('bandiere','Trova la bandiera di'),('capitali','Qual è la capitale di'),('sagome','Trova la sagoma di'),('monumenti','Quale monumento si trova in')]:
        others=[v for v in countries if v['id']!=c['id']]; others=others[i%len(others):]+others[:i%len(others)]
        correct=option(c,kind)
        prompt=f'Quale monumento si trova in {c["name"]}?' if kind=='monumenti' else f'{verb[:-3]} {of[c["id"]]}{c["name"]}?'
        if kind=='monumenti' and c['id']=='US': prompt='Quale monumento si trova negli Stati Uniti?'
        questions.append({'id':f'{kind}-{c["id"]}','category':kind,'prompt':prompt,'target':c['id'],'correct':correct,'wrong':[option(v,kind) for v in others[:9]],'difficulty':difficulty,'sources':[c['monumentSource'] if kind=='monumenti' else geoUrl if kind=='sagome' else 'https://github.com/lipis/flag-icons' if kind=='bandiere' else SOURCE]})
    eligible=[v for v in c['neighbors'] if c['id']!='FR' or v not in ('BR','SR')]
    neighbor=next((v['id'] for v in countries if v['id'] in eligible),None)
    if c['id']=='EG': neighbor='SD'
    if c['id']=='RO': neighbor='HU'
    if c['id']=='BR': neighbor='AR'
    assert neighbor in c['neighbors'],c['id']
    wrong=[v for v in countries if v['id']!=c['id'] and v['id'] not in c['neighbors'] and c['id'] not in v['neighbors']]
    assert len(wrong)>=9
    target='la Francia metropolitana' if c['id']=='FR' else articles[c['id']]+c['name']
    questions.append({'id':f'confini-{c["id"]}','category':'confini','prompt':f'Quale paese confina via terra con {target}?','target':c['id'],'correct':{'id':neighbor,'label':byId[neighbor]['name'] if neighbor in byId else extraNames[neighbor]},'wrong':[{'id':v['id'],'label':v['name']} for v in wrong[:9]],'difficulty':difficulty,'sources':c['neighborSources']})
assert len(questions)==100
(ROOT/'shared/geofallQuestions.json').write_text(json.dumps(questions,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(DOC/'source-snapshot.json').write_text(json.dumps({'date':'2026-10-12','countryInfo':SOURCE,'countryInfoSha256':hashlib.sha256(raw.encode()).hexdigest(),'naturalEarth':geoUrl,'selected':countries},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('PASS assets: 20 flags, 20 outlines, 20 original monument illustrations; 20 capitals checked against GeoNames snapshot.')
