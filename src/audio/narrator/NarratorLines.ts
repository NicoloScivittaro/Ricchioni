export type NarratorEvent='roller'|'game'|'result';
export type Condition='winner'|'loser'|'tie'|'winningStreak'|'losingStreak'|'comeback'|'leaderChange'|'gap'|'botWinner'|'botLoser';
export interface NarratorLine {id:string;text:string;subtitle:string;spokenText:string;event:NarratorEvent;condition?:Condition;character?:string;game?:string;priority:number;weight:number;cooldown:number;speed:number;asset:string}
const list:NarratorLine[]=[];
function add(id:string,text:string,event:NarratorEvent,extra:Partial<NarratorLine>={}):void{
 const spokenText=(extra.spokenText??text).replace(/Goblin Time/gi,'Goblin Taim').replace(/GEOFALL/g,'Geofòl').replace(/BACKROOMS/g,'Bècrums').replace(/Victor/g,'Vìctor').replace(/Ao'/g,'Aò').replace(/N'culo/g,'In culo').replace(/\b31\b/g,'Trentuno').replace(/\bmo'/gi,'mò').replace(/[A-ZÀ-Ý]{2,}/g,word=>word.toLocaleLowerCase('it-IT'));
 const speed=extra.speed??(event==='roller'?1.03:event==='game'?1.04:extra.condition==='loser'||extra.condition==='losingStreak'?.99:1.01);
 list.push({id,text,subtitle:text,event,priority:1,weight:1,cooldown:75,asset:`/audio/narrator/${id}.ogg`,...extra,spokenText,speed});
}
const rollers=[
 "Mò vediamo chi fa la prossima figura di merda.",
 "Gira, gira. Tanto il talento non esce dal rullo.",
 "Teneteve le scuse. I risultati li vediamo tutti.",
 "Pronti? Fate schifo con una sicurezza commovente.",
 "La ruota gira. Il cervello vostro, un po' meno.",
 "Un altro gioco. Stessa collezione de figuracce.",
 "Ao', pure il rullo ha più controllo de voi.",
 "Silenzio. Sto scegliendo come farve rosicà.",
 "Fate i seri. La figuraccia viene meglio.",
 "Gira il rullo. Il talento è ancora in caricamento.",
 "Non ve rilassate. La dignità ha già preso ferie.",
 "Vediamo chi protesta prima de capì i comandi.",
 "Meno pronostici. Più connessioni fra neuroni.",
 "Ancora non giocate e già piangete. Che fenomeni.",
 "Ecco il gioco dove date la colpa al controller.",
 "Teneteve forte. La figuraccia è compresa nel prezzo.",
 "La ruota decide. Io giudico. Voi fate schifo.",
 "Gioco nuovo. Stesse facce da ultimo posto.",
 "Cambiate almeno le scuse. Le so a memoria.",
 "Fate spazio. Sta per passà un altro disastro.",
 "Prendete fiato. Per piagne, mica per vince.",
 "Il rullo non ve deve niente. Manco pietà.",
 "Se girava il cervello, stavamo già al prossimo.",
 "Gioco, casino e uno che rosica. Sempre voi.",
 "Punto sulla figuraccia. Praticamente soldi sicuri."
];rollers.forEach((text,i)=>add(`roller-${i+1}`,text,'roller'));

const generic:[Condition,string][]=[
 ['winner',"Primo. Goditelo: il miracolo non fa curriculum."],['winner',"Ha vinto. Il livello degli altri spiega parecchio."],['winner',"Un applauso al primo. Piano: già se crede un fenomeno."],['winner',"Il vincitore c'è. L'umiltà è rimasta ultima."],['winner',"Bravo il primo. Mò abbassa la cresta."],
 ['loser',"Ultimo. Non è sfortuna: è proprio il livello."],['loser',"Ultimo. Il controller funziona. Purtroppo per te."],['loser',"Ultimo posto. Il tutorial cercava de avvisatte."],['loser',"Hai dato tutto. Era pochissimo."],['loser',"Che figura de merda. E senza manco fatica."],
 ['tie',"Pari. Due talenti sprecati, senza il talento."],['tie',"Ex aequo. Avete pareggiato pure la figuraccia."],['tie',"Pari. Pure la classifica s'è rotta de giudicavve."],
 ['winningStreak',"Tre vittorie de fila. Mò chi cazzo lo sopporta?"],['winningStreak',"Tre primi posti. L'ego non entra più nella stanza."],
 ['losingStreak',"Tre ultimi posti. Il talento vostro è la costanza."],['losingStreak',"Tre volte in fondo. Non è sfortuna, è abbonamento."],
 ['comeback',"Dal fondo al primo del round. Un neurone s'è svegliato."],['comeback',"Era in fondo, mò vince il round. Pure i miracoli capitano."],
 ['leaderChange',"Nuovo leader. Quello de prima già parla de lag."],['leaderChange',"Cambia il leader. Le scuse passano al vecchio."],
 ['gap',"Dieci punti de distacco, almeno. Serve il binocolo."],['gap',"Il leader vi dà almeno dieci punti. Siete tappezzeria."],
 ['botWinner',"Ha vinto un bot. Un file. Contro gente con le dita."],['botLoser',"Ultimo il bot. Finalmente uno che perde e sta zitto."]
];generic.forEach(([condition,text],i)=>add(`result-${i+1}`,text,'result',{condition,priority:['tie','winningStreak','losingStreak','comeback','leaderChange'].includes(condition)?3:1}));

const personal:Record<string,string[]>={
 goblin:["Goblin primo! Che strano, quello che ha creato er gioco!","Goblin vince! Ao', almeno stavolta funziona!","Primo er Goblin! Mo' ce lo racconta fino a domani!","Goblin sul podio! Er creatore ha trovato er tasto giusto!","Goblin ultimo. Hai creato il gioco e sei l'unico bug.","Ultimo il Goblin. Te sei programmato pure l'alibi?","Goblin in fondo! Questa la chiami una funzione nuova?","Goblin ultimo! Ao', l'hai fatto tu 'sto gioco!","Goblin, almeno tre vittorie de fila! Mo' tutti a rosicà!","Goblin, tre ultimi posti! Er gioco funziona. Sei tu!"],
 buttafuori:["Boschi ha vinto! Mo' se crede er campione del mondo!","Boschi primo! Aspè, famme capì... hai vinto davvero?","Vince Boschi! La sicurezza del podio è garantita!","Boschi primo! Per una volta qua te fanno entrà!","Boschi ultimo. Fai più paura al portone che agli avversari.","Ultimo Boschi. Tutta quella potenza, zero risultati.","Boschi in fondo! Er podio stavolta non te fa entrà!","Boschi ultimo! Te proteggo io... dalle aspettative!","Boschi, tre vittorie de fila! Mo' chi lo sopporta?","Boschi, tre ultimi posti! Le scuse non entrano più!"],
 dottore:["Victor primo! Stavolta er cervello l'ha acceso davvero!","Vince Victor! M'ho svejato, e se vede!","Victor sul podio! Nun svejatelo, che sta vincendo!","Primo Victor! Ao', la sveglia oggi ha funzionato!","Victor ultimo. Hai svegliato tutti, tranne il cervello.","Ultimo Victor. La sveglia suona, il talento dorme.","Victor in fondo! M'ho svejato... a risultati finiti!","Victor ultimo! Domani svejate un turno prima!","Victor, tre vittorie de fila! Rimani svejo, per favore!","Victor, tre ultimi posti! Cambiamo suoneria alla sveglia!"],
 judoka:["Carbo vince! Fermate tutto, segnateve la data!","Carbo primo! Stavolta er regolamento je dà ragione!","Vince Carbo! La protesta può aspettà!","Primo Carbo! Ao', un applauso. Senza ricorso!","Carbo ultimo. No, aspetta... hai perso. Anche il ricorso.","Ultimo Carbo. Il regolamento non copre le tue figuracce.","Carbo in fondo! ANGORA CHE DICI? Che hai perso!","Carbo ultimo! La classifica non accetta reclami!","Carbo, tre vittorie de fila! Er ricorso lo fanno gli altri!","Carbo, tre ultimi posti! Pure er regolamento s'è arreso!"],
 ciro:["Ciro primo! Non se l'aspettava manco lui!","Vince Ciro! Er podio oggi non se paga a rate!","Ciro sul podio! Facciamo ottanta a te... de applausi!","Primo Ciro! Oggi paga qualcun altro. In punti!","Ciro ultimo. Il podio è gratis: non te lo puoi permette.","Ultimo Ciro. Tratta quanto vuoi, i punti non te li sconto.","Ciro in fondo! Non c'hai spicci, manco punti!","Ciro ultimo! La classifica non accetta bonifici!","Ciro, tre vittorie de fila! Stavolta nun c'è da trattà!","Ciro, tre ultimi posti! Er debito de punti cresce!"]
};for(const [character,texts]of Object.entries(personal))texts.forEach((text,i)=>add(`personal-${character}-${i+1}`,text,'result',{character,condition:i<4?'winner':i<8?'loser':i===8?'winningStreak':'losingStreak',priority:i>=8?4:2}));

const games:Record<string,string[]>={
 ferro:["SETTE ARMI, CINQUE GUERRIERI... MA SOLTANTO UNO RESTERÀ IN PIEDI!"],
 orda:["ORDA FINALE! Soltanto uno ne uscirà vivo!","ORDA FINALE! I mostri arrivano. Le scuse non sparano!"],
 quiz:["CHI CAZZO LO SA? Vediamo chi copia da chi!","CHI CAZZO LO SA? Le risposte a caso almeno fattele bene!"],
 reaction:["BOTTA AL VOLO! Er dito svejo, er cervello se po' riposà!","BOTTA AL VOLO! Prima er segnale, poi la figuraccia!"],
 memory:["MEMORIA DA UBRIACO! Vediamo che ve siete già scordati!","MEMORIA DA UBRIACO! Non vale chiede a quello accanto!"],
 arena:["ARENA DEL DISAGIO! Restate in piedi. È già un'impresa!","ARENA DEL DISAGIO! Spingete gli altri, non le scuse!"],
 dodgeball:["DODGEBALL DEI COGLIONI! La palla non sente i reclami!","DODGEBALL DEI COGLIONI! Schivate, fenomeni!"],
 soccer:["CALCIO DEI DISAGIATI! Finalmente uno sport da rovinà!","CALCIO DEI DISAGIATI! La porta è quella. Le scuse, là!"],
 volleyball:["PALLAVOLO DEI DISAGIATI! La palla va dall'altra parte!","PALLAVOLO DEI DISAGIATI! Non è un abbraccio alla rete!"],
 kart3d:["RIBALTATI! Metteteve er casco. Anche alle idee!","RIBALTATI! Er freno non è una decorazione!"],
 cultura:["CULTURA O CAZZATA? Finalmente er vostro campo!","CULTURA O CAZZATA? Stavolta mentire è previsto!"],
 fps:["SPARATORIA DEI DISAGIATI! Mira da talpa, vedemo!","SPARATORIA DEI DISAGIATI! Sparate agli altri, fenomeni!"],
 cornicione:["BOTTE SUL CORNICIONE! Menateve, senza l'avvocato!","BOTTE SUL CORNICIONE! Occhio ar bordo, campioni!"],
 minigolf:["MINIGOLF DEI DISAGIATI! La pallina va nel buco!","MINIGOLF DEI DISAGIATI! Piano, non è un rigore!"],
 geofall:["GEOFALL! Er mondo crolla. Voi intanto pensate!","GEOFALL! Trovate la casella. Prima che sparisca!"],
 backrooms:["BACKROOMS! Una porta giusta. Tante idee sbagliate!","BACKROOMS! Fate piano. Pure le scuse fanno rumore!"],
 goblinTime:["GOBLIN TIME! Qua vince er più infame!","GOBLIN TIME! Cinque carte. E zero amicizie!"],
 trentuno:["31 DEGLI INFAMI! Facile, finché arrivano 'sti fenomeni!","31 DEGLI INFAMI! Bussa chi vuole. Vince chi può!"]
};for(const [game,texts]of Object.entries(games))texts.forEach((text,i)=>add(`game-${game}-${i+1}`,text,'game',{game,priority:5,spokenText:text.replace(/31/g,'Trentuno').replace(/GOBLIN TIME/g,'Goblin Taim').replace(/GEOFALL/g,'Geofòl').replace(/BACKROOMS/g,'Bècrums')}));
export const NARRATOR_LINES:readonly NarratorLine[]=list;
