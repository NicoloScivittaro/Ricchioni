"""Append verified advanced content; originals are immutable. Network is build-time only."""
import json,math,urllib.request,hashlib,concurrent.futures,html,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; DOC=ROOT/'docs/agent-work/geofall-2';OUT=ROOT/'public/geofall/advanced'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE='https://download.geonames.org/export/dump/countryInfo.txt'
NATURAL='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'
def fetch(url):return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=35).read()
raw=(DOC/'geonames.txt').read_text(encoding='utf-8');info={}
for line in raw.splitlines():
 if line and not line.startswith('#'):
  r=line.split('\t');info[r[0]]={'capital':r[5],'iso3':r[1],'neighbors':[x for x in r[17].split(',') if x],'continent':r[8]}
# GeoNames omits the real Botswana/Zambia border. Exclude either as a distractor for the other.
BORDER_SOURCE='https://www.parliament.gov.zm/node/11873'
info['BW']['neighbors']=sorted(set(info['BW']['neighbors']+['ZM']));info['ZM']['neighbors']=sorted(set(info['ZM']['neighbors']+['BW']))
names=dict(x.split(':',1) for x in "BT:Bhutan|LA:Laos|MN:Mongolia|KG:Kirghizistan|NA:Namibia|BW:Botswana|FJ:Figi|WS:Samoa|TO:Tonga|VU:Vanuatu|SB:Isole Salomone|FM:Stati Federati di Micronesia|MH:Isole Marshall|MU:Mauritius|SC:Seychelles|TD:Ciad|ML:Mali|GN:Guinea|CI:Costa d’Avorio|ID:Indonesia|MC:Monaco|BF:Burkina Faso|BJ:Benin|GH:Ghana|CM:Camerun|SN:Senegal|IE:Irlanda|KH:Cambogia|MM:Myanmar|LK:Sri Lanka|NP:Nepal|TH:Thailandia|VN:Vietnam|ZW:Zimbabwe|ET:Etiopia|TZ:Tanzania|IR:Iran|AO:Angola|ZM:Zambia|ZA:Sudafrica|MZ:Mozambico|MW:Malawi|LS:Lesotho|SZ:Eswatini|CD:Repubblica Democratica del Congo|CG:Repubblica del Congo|GA:Gabon|GQ:Guinea Equatoriale|CF:Repubblica Centrafricana|SL:Sierra Leone|LR:Liberia|GM:Gambia|GW:Guinea-Bissau|MA:Marocco|DZ:Algeria|TN:Tunisia|LY:Libia|NE:Niger|TG:Togo|NG:Nigeria|SD:Sudan|RU:Russia|UZ:Uzbekistan|TJ:Tagikistan|KZ:Kazakistan|BD:Bangladesh|PK:Pakistan|AF:Afghanistan|PG:Papua Nuova Guinea|TL:Timor Est".split('|'))
original=json.loads((DOC/'original-100.json').read_text(encoding='utf-8'));countries=json.loads((ROOT/'shared/geofallCountries.json').read_text(encoding='utf-8'));countries=[c for c in countries if c['id'] in {a['target'] for a in original}];by={c['id']:c for c in countries};old_codes=set(by)
for c in countries:names[c['id']]=c['name']
capitals='BT LA MN KG NA BW FJ WS TO VU SB FM MH MU SC'.split()
expected=['Thimphu','Vientiane','Ulaanbaatar','Bishkek','Windhoek','Gaborone','Suva','Apia',"Nuku’alofa",'Port Vila','Honiara','Palikir','Majuro','Port Louis','Victoria']
for c,e in zip(capitals,expected):assert info[c]['capital'].replace("'",'’')==e,(c,info[c]['capital'],e)
flags='TD ML GN CI ID MC BF BJ GH CM SN NA BW FJ WS'.split()
outlines='BT LA MN KG NA BW TD ML GN CI BJ GH CM SN BF'.split()
borders=outlines[:]
monuments=[('KH','Angkor Wat','668'),('ID','Borobudur','592'),('MM','Templi di Bagan','1588'),('LA','Vat Phou','481'),('BT','Paro Taktsang',None),('LK','Sigiriya','202'),('NP','Swayambhunath','121'),('TH','Templi di Ayutthaya','576'),('VN','Ponte giapponese di Hoi An','948'),('ZW','Grande Zimbabwe','364'),('ML','Grande Moschea di Djenné','116'),('ET','Chiesa di San Giorgio a Lalibela','18'),('TZ','Rovine di Kilwa Kisiwani','144'),('SN','Casa degli Schiavi di Gorée','26'),('IR','Persepoli','114')]
for c,name,n in monuments:
 if c not in by:by[c]={'id':c,'name':names[c]}
 by[c].update(monument=name,monumentSource=f'https://whc.unesco.org/en/list/{n}/' if n else 'https://paro.gov.bt/religious-site/taktshang-tiger-nest-monastery/',monumentImage=f'/geofall/advanced/monument-{c}.svg')
for code in names:
 if code not in by:by[code]={'id':code,'name':names[code]}
 if code not in {a['target'] for a in original}:
  by[code].update(capital=info[code]['capital'].replace("'",'’'),sourceCapital=info[code]['capital'],neighbors=info[code]['neighbors'],sourceNeighbors=info[code]['neighbors'],neighborSources=[SOURCE]+([BORDER_SOURCE] if code in ['BW','ZM'] else []))
geo=json.loads((DOC/'naturalearth-50m.json').read_text(encoding='utf-8'));features={f['properties']['ADM0_A3']:f for f in geo['features']}
def outline(code):
 f=features[info[code]['iso3']];polys=f['geometry']['coordinates'];polys=[polys] if f['geometry']['type']=='Polygon' else polys
 def area(p):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(p[0],p[0][1:])))
 main=max(polys,key=area)[0];cy=sum(p[1] for p in main)/len(main);k=math.cos(math.radians(cy));pts=[(x*k,-y) for x,y,*_ in main]
 xx=[x for x,y in pts];yy=[y for x,y in pts];scale=min(430/(max(xx)-min(xx)),350/(max(yy)-min(yy)));ox=250-(max(xx)+min(xx))*scale/2;oy=200-(max(yy)+min(yy))*scale/2
 path='M'+' L'.join(f'{x*scale+ox:.2f},{y*scale+oy:.2f}' for x,y in pts)+'Z'
 (OUT/f'outline-{code}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400"><path d="{path}" fill="#173859" stroke="#102941" stroke-width="2" stroke-linejoin="round"/></svg>',encoding='utf-8');by[code]['outline']=f'/geofall/advanced/outline-{code}.svg'
for c in outlines:outline(c)
flagmeta=[]
def flag(code):
 url=f'https://raw.githubusercontent.com/hampusborgos/country-flags/main/svg/{code.lower()}.svg';p=(OUT.parent if code in old_codes else OUT)/f'flag-{code}.svg'
 if not p.exists() or code in old_codes:p.write_bytes(fetch(url))
 b=p.read_bytes();svg=ET.fromstring(b);v=svg.attrib['viewBox'].split();ratio=float(v[2])/float(v[3]);
 # Explicit rasterization size with the true aspect ratio; SVG symbols keep their geometry.
 text=b.decode();import re
 text=re.sub(r'(<svg[^>]*?)\swidth="[^"]*"',r'\1',text,count=1);text=re.sub(r'(<svg[^>]*?)\sheight="[^"]*"',r'\1',text,count=1);text=text.replace('<svg ',f'<svg width="1000" height="{1000/ratio:.3f}" ',1);p.write_text(text,encoding='utf-8');b=p.read_bytes();flagmeta.append({'country':code,'source':url,'path':str(p.relative_to(ROOT)).replace('\\','/'),'ratio':ratio,'sha256':hashlib.sha256(b).hexdigest()});by[code]['flag']=f'/geofall/{"" if code in old_codes else "advanced/"}flag-{code}.svg'
# Ireland as a plausible reverse-order distractor; national proportions retained. Originals remain unchanged.
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(flag,flags+['IE']+sorted(old_codes)))
assert next(x for x in flagmeta if x['country']=='MC')['ratio']==1.25
assert next(x for x in flagmeta if x['country']=='ID')['ratio']==1.5
assert next(x for x in flagmeta if x['country']=='IE')['ratio']==2
# Original vector illustrations from architecture descriptions, no captions/text or borrowed photos.
def svg(code,d):
 (OUT/f'monument-{code}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 400"><rect width="500" height="400" rx="18" fill="#e9f5ff"/>{d}</svg>',encoding='utf-8')
def tower(x,y,w,h,color='#b79572'):
 return f'<path d="M{x-w/2} {y+h}V{y+30}l{w/2}-30 {w/2} 30v{h-30}Z" fill="{color}" stroke="#5c493f" stroke-width="4"/>'
def windows(xs,y):return ''.join(f'<path d="M{x} {y}v35h18v-35Z" fill="#393c3b"/>' for x in xs)
draw={
 'KH':'<rect x="35" y="290" width="430" height="35" fill="#bda477"/>'+''.join(tower(x,75 if x==250 else 125,60,220 if x==250 else 170) for x in [95,175,250,325,405])+windows(range(75,430,38),255),
 'ID':''.join(f'<path d="M{55+i*24} {315-i*35}h{390-i*48}v30H{55+i*24}Z" fill="#74716a" stroke="#454b4b" stroke-width="5"/>' for i in range(5))+''.join(f'<path d="M{x-18} 165q18-45 36 0v15h-36Z" fill="#74716a" stroke="#454b4b" stroke-width="4"/>' for x in [160,215,270,325])+'<path d="M220 110q30-65 60 0v30h-60Z" fill="#74716a" stroke="#454b4b" stroke-width="5"/>',
 'MM':''.join(tower(x,80 if x==255 else 160,80,240 if x==255 else 160,'#c28759') for x in [85,165,255,350,430])+'<path d="M255 40v50 M85 130v35 M430 130v35" stroke="#ae8139" stroke-width="6"/>',
 'LA':'<path d="M40 350L135 170h300L450 350Z" fill="#809b61"/><path d="M170 340l40-160h40l-20 160Z" fill="#cabfa0"/>'+tower(295,145,115,140)+'<path d="M235 180h125v20H235" fill="#64503d"/>',
 'BT':'<path d="M35 375L65 230 140 110 230 75 400 220 455 375Z" fill="#899188"/><path d="M100 220v-85h105v85 M215 240V100h110v140 M315 280V160h105v120" fill="#efe6d0"/><path d="M90 135l62-40 63 40 M205 100l65-45 65 45 M305 160l63-40 62 40" fill="#a23f32" stroke="#532d24" stroke-width="5"/>'+windows([125,170],160)+windows([240,285],140)+windows([335,380],195),
 'LK':'<path d="M75 350L90 165 155 85 340 80 410 180 425 350Z" fill="#aa8359"/><path d="M105 165l60-65h160l60 80-35 25H140Z" fill="#668255"/><path d="M125 340l90-140h18l-80 140" fill="#d9c39e"/><path d="M185 145h120v15H185 M210 120h75v15H210" fill="#b69370"/>',
 'NP':'<path d="M100 300q0-120 150-120t150 120Z" fill="#f3eddc"/><rect x="213" y="140" width="74" height="55" fill="#e0b553"/><path d="M207 140l43-75 43 75Z" fill="#b98b38"/><path d="M235 65l15-35 15 35" fill="#b98b38"/><path d="M225 165q12-13 24 0 M253 165q12-13 24 0" fill="none" stroke="#204863" stroke-width="6"/><path d="M50 320h400v20H50" fill="#bfbba4"/>',
 'TH':'<path d="M45 310h410v25H45" fill="#bba181"/>'+''.join(tower(x,75 if x==260 else 160,65,235 if x==260 else 150,'#ae6a49') for x in [90,170,260,355,425])+'<path d="M228 175h64 M238 130h44 M246 90h28" stroke="#e0b07a" stroke-width="8"/>',
 'VN':'<path d="M50 290q200 55 400 0v35q-200 55-400 0Z" fill="#ae9577"/><path d="M75 265V180h350v85" fill="#d9aa75"/><path d="M50 180q100-10 120-50h160q20 40 120 50Z" fill="#6a5547"/><path d="M90 220h320 M125 180v85 M195 180v85 M265 180v85 M335 180v85" stroke="#694d3d" stroke-width="7"/><path d="M40 355h420" stroke="#65a6b7" stroke-width="15"/>',
 'ZW':'<path d="M50 315V175q190-75 390 0v140H330V200q-135-30-180 0v115Z" fill="#baae84" stroke="#807451" stroke-width="5"/><path d="M320 315V180q30-120 60 0v135Z" fill="#baae84" stroke="#807451" stroke-width="5"/>'+''.join(f'<path d="M{55} {y}h380" stroke="#8c8064" stroke-width="4"/>' for y in [205,235,265,295]),
 'ML':'<path d="M45 320V200h410v120" fill="#bb8357"/>'+''.join(tower(x,90 if x==250 else 140,55,230 if x==250 else 180,'#bb8357') for x in [110,250,390])+''.join(f'<path d="M{x} 185v115 M{x-7} 220h14 M{x-7} 255h14" stroke="#62442e" stroke-width="7"/>' for x in range(65,440,30)),
 'ET':'<path d="M60 350V100h380v250" fill="#795942"/><path d="M175 150v-65h150v65h65v145h-65v65H175v-65h-65V150Z" fill="#c59a72" stroke="#533c2e" stroke-width="7"/><path d="M205 180v-65h90v65h65v85h-65v65h-90v-65h-65v-85Z" fill="#b48664" stroke="#8c634a" stroke-width="5"/>',
 'TZ':'<path d="M55 320V190h390v130" fill="#c2b393"/><path d="M105 190v-40q25-40 50 0v40 M190 190v-55q30-45 60 0v55 M285 190v-40q25-40 50 0v40" fill="#e1d0ad" stroke="#746852" stroke-width="7"/>'+windows([80,155,230,305,380],235)+'<path d="M30 340h440" stroke="#90b7b0" stroke-width="15"/>',
 'SN':'<path d="M65 325V110h370v215" fill="#c97664"/><path d="M55 110l195-50 195 50" fill="#976347"/><path d="M145 325v-80q105-105 210 0v80" fill="#32322d"/><path d="M85 290l90-100h45l-75 100 M415 290l-90-100h-45l75 100" fill="#dfc299"/>'+windows([95,145,335,385],145),
 'IR':'<path d="M35 315h430v25H35" fill="#ceba92"/>'+''.join(f'<path d="M{x} 315V115h25v200 M{x-7} 110h39v20h-39" fill="#d8caa8" stroke="#877a5e" stroke-width="4"/>' for x in [70,145,220,295,370])+'<path d="M60 90h55l-10-25h-35 M135 90h55l-10-25h-35 M210 90h55l-10-25h-35 M285 90h55l-10-25h-35 M360 90h55l-10-25h-35" fill="#d8caa8"/>'}
for c,_,_ in monuments:svg(c,draw[c])
questions=[]
def ans(c,category):
 row=by[c];return {'id':c,'label':row['capital'] if category=='capitali' else row['monument'] if category=='monumenti' else row['name'],**({'image':row[{'bandiere':'flag','sagome':'outline','monumenti':'monumentImage'}[category]]} if category in ['bandiere','sagome','monumenti'] else {})}
def centroid(c):
 f=features.get(info[c]['iso3']);return (f['properties']['LABEL_X'],f['properties']['LABEL_Y']) if f else (0,0)
def nearby(c,pool):
 x,y=centroid(c);return sorted(pool,key=lambda d:(centroid(d)[0]-x)**2*math.cos(math.radians(y))**2+(centroid(d)[1]-y)**2)
chosen={'BT':'IN','LA':'VN','MN':'RU','KG':'UZ','NA':'AO','BW':'NA','TD':'CM','ML':'GN','GN':'SL','CI':'GH','BJ':'NG','GH':'TG','CM':'GA','SN':'GM','BF':'BJ'}
for category,pool in [('bandiere',flags),('confini',borders),('capitali',capitals),('sagome',outlines),('monumenti',[c for c,_,_ in monuments])]:
 for i,c in enumerate(pool):
  sources=[f'https://www.geonames.org/countries/{c}/']
  if category=='confini':
   right=chosen[c];assert right in info[c]['neighbors'];options=[d for d in names if d!=c and info[d]['continent']==info[c]['continent'] and d not in info[c]['neighbors'] and c not in info[d]['neighbors']];wrong=nearby(c,options)[:9];sources+=[SOURCE]+([BORDER_SOURCE] if c=='BW' else []);prompt=f'Quale Stato condivide un confine terrestre con {names[c]}?'
  else:
   right=c;wrong=[d for d in pool if d!=c]
   if category=='bandiere':
    if c=='CI':wrong=['IE']+wrong
    # Chad/Romania rely on shades that a TV may not faithfully distinguish: never a head-to-head distractor.
    wrong=wrong[:9];sources+=['https://github.com/hampusborgos/country-flags'];prompt=f'Qual è la bandiera di {names[c]}?'
   elif category=='capitali':wrong=nearby(c,wrong)[:9];sources+=[SOURCE];prompt=f'Qual è la capitale di {names[c]}?'
   elif category=='sagome':wrong=nearby(c,wrong)[:9];sources+=['https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries/'];prompt=f'Quale sagoma rappresenta {names[c]}?'
   else:wrong=nearby(c,wrong)[:9];sources=[by[c]['monumentSource']]+[by[d]['monumentSource'] for d in wrong];prompt=f'Quale monumento o complesso storico si trova in {names[c]}?'
  assert len(wrong)==9 and len(set(wrong))==9
  q={'id':f'advanced-{category}-{c}','category':category,'prompt':prompt,'target':c,'correct':ans(right,category),'wrong':[ans(d,category) for d in wrong],'difficulty':3 if i<8 else 4,'sources':sources};questions.append(q)
assert len(questions)==75
(ROOT/'shared/geofallQuestions.json').write_text(json.dumps(original+questions,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT/'shared/geofallCountries.json').write_text(json.dumps(list(by.values()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(DOC/'flag-audit.json').write_text(json.dumps(flagmeta,indent=2),encoding='utf-8')
(DOC/'source-snapshot.json').write_text(json.dumps({'sources':[{'url':SOURCE,'sha256':hashlib.sha256((DOC/'geonames.txt').read_bytes()).hexdigest()},{'url':NATURAL,'sha256':hashlib.sha256((DOC/'naturalearth-50m.json').read_bytes()).hexdigest()}],'questions':75,'excluded':['Ciad/Romania come coppia: differenze cromatiche troppo sottili sulla TV','Palau da GeoNames: Melekeok non distingue Ngerulmud; omesso dal set capitali','Kiribati: Tarawa vs Tarawa Sud; omesso dal set capitali'],'borderCorrection':{'countries':['BW','ZM'],'source':BORDER_SOURCE}},indent=2,ensure_ascii=False),encoding='utf-8')
print('PASS append75, original100 retained,45 visual answer assets,16 flag variants preserving ratios')
