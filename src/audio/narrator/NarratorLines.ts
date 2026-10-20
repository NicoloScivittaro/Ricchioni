export type NarratorEvent='roller'|'game'|'result';
export type Condition='winner'|'loser'|'tie'|'winningStreak'|'losingStreak'|'comeback'|'leaderChange'|'gap'|'botWinner'|'botLoser';
export interface NarratorLine {id:string;text:string;subtitle:string;spokenText:string;event:NarratorEvent;condition?:Condition;character?:string;game?:string;priority:number;weight:number;cooldown:number;speed:number;asset:string}
const list:NarratorLine[]=[];
function add(id:string,text:string,event:NarratorEvent,extra:Partial<NarratorLine>={}):void{
 const spokenText=text.replace(/Goblin Time/g,'Goblin Taim').replace(/GEOFALL/g,'Geofòl').replace(/BACKROOMS/g,'Bècrums').replace(/Victor/g,'Vìctor').replace(/Ao'/g,'Aò').replace(/N'culo/g,'In culo');
 list.push({id,text,subtitle:text,spokenText,event,priority:1,weight:1,cooldown:75,speed:event==='roller'?1.12:1.08,asset:`/audio/narrator/${id}.ogg`,...extra});
}
const rollers=[
 "E mo' vediamo quale figura de merda ve tocca fa'!",
 "Gira, gira, che qualcuno deve ancora rosicà!",
 "Ao', riposate le scuse. Tra poco servono de nuovo!",
 "Pronti? Er talento non serve. Le scuse sì!",
 "La ruota gira. Voi state già a cercà un colpevole!",
 "Un altro gioco. Un'altra occasione de deludeme!",
 "Ao', 'sto rullo c'ha più equilibrio de voi!",
 "Silenzio! Sto scegliendo come farve rosicà!",
 "Fate i seri. Tanto dura cinque secondi!",
 "Gira er rullo, calano le aspettative!",
 "Nun ve rilassate. La vergogna fa gli straordinari!",
 "Vediamo chi inaugura er reparto scuse!",
 "Ao', lasciate perde i pronostici. Non ce prendete!",
 "Che spettacolo! Ancora non giocate e già litigate!",
 "Er prossimo gioco? Quello dove dite che er pad non va!",
 "Teneteve forte. Stavolta la figuraccia è inclusa!",
 "La ruota decide. Io giudico. Voi rosicate!",
 "Aria nuova! Stesse facce da sconfitta!",
 "Mo' gira. Le scuse, almeno, cambiatele!",
 "Ao', fate spazio. Sta arrivando un altro disastro!",
 "Prendete fiato. Per protestà, mica per vince!",
 "Er rullo non vi deve niente. Manco le scuse!",
 "Ecco er sorteggio. Avesse girato er cervello, invece!",
 "Tre cose certe: gioco, casino e qualcuno che rosica!",
 "Scommetto sulla vostra figuraccia. Quota bassissima!"
];rollers.forEach((text,i)=>add(`roller-${i+1}`,text,'roller'));

const generic:[Condition,string][]=[
 ['winner',"Primo! Ao', nun te abituà. È pericoloso!"],['winner',"Ha vinto! Controllate che non sia uno scherzo!"],['winner',"Un applauso al primo. Piccolo, sennò se monta!"],['winner',"Il vincitore c'è. L'umiltà l'avemo persa!"],['winner',"Bravo er primo! Finalmente una scusa de meno!"],
 ['loser',"L'ultimo? Uno spettacolo. Per gli avversari!"],['loser',"Ao', l'ultimo ha confuso partecipa' con compete'!"],['loser',"Ultimo posto! Almeno la classifica l'hai riempita!"],['loser',"Quello in fondo ha dato tutto. Non bastava niente!"],['loser',"Che figura de merda! Er fondo è tutto tuo!"],
 ['tie',"Pari! Ao', pure la classifica ha rinunciato a sceglie!"],['tie',"Ex aequo! Rosicate insieme, risparmiamo tempo!"],['tie',"Un pareggio. Finalmente riuscite a condividere qualcosa!"],
 ['winningStreak',"Tre vittorie de fila? Mo' ve tocca stallo a senti'!"],['winningStreak',"Ancora primo! Almeno tre de fila. Basta, abbiamo capito!"],
 ['losingStreak',"Tre ultimi posti de fila! La costanza, almeno, c'è!"],['losingStreak',"Ancora in fondo! Tre volte non è sfortuna, è abbonamento!"],
 ['comeback',"Stava in fondo alla generale, mo' vince er round. Ao'!"],['comeback',"Dal fondo della classifica al primo del round. Finalmente!"],
 ['leaderChange',"È cambiato er leader! Pure le scuse adesso cambiano proprietario!"],['leaderChange',"Nuovo leader! Quello de prima mo' fa finta de niente!"],
 ['gap',"Almeno dieci punti de distacco. Er leader ve saluta da lontano!"],['gap',"Dieci punti o più dietro er leader. Ao', c'è traffico?"],
 ['botWinner',"Ha vinto un bot! E voi avete pure le dita!"],['botLoser',"Ultimo er bot! Per una volta le scuse non le devo senti'!"]
];generic.forEach(([condition,text],i)=>add(`result-${i+1}`,text,'result',{condition,priority:['tie','winningStreak','losingStreak','comeback','leaderChange'].includes(condition)?3:1}));

const personal:Record<string,string[]>={
 goblin:["Goblin primo! Che strano, quello che ha creato er gioco!","Goblin vince! Ao', almeno stavolta funziona!","Primo er Goblin! Mo' ce lo racconta fino a domani!","Goblin sul podio! Er creatore ha trovato er tasto giusto!","Goblin ultimo! Manco barando riesci a vince?","Ultimo er Goblin! Te sei scritto pure la sconfitta?","Goblin in fondo! Questa la chiami una funzione nuova?","Goblin ultimo! Ao', l'hai fatto tu 'sto gioco!","Goblin, almeno tre vittorie de fila! Mo' tutti a rosicà!","Goblin, tre ultimi posti! Er gioco funziona. Sei tu!"],
 buttafuori:["Boschi ha vinto! Mo' se crede er campione del mondo!","Boschi primo! Aspè, famme capì... hai vinto davvero?","Vince Boschi! La sicurezza del podio è garantita!","Boschi primo! Per una volta qua te fanno entrà!","Boschi ultimo! Tutta 'sta potenza e perdi contro un menù!","Ultimo Boschi! Aspè, famme capì... no, hai perso!","Boschi in fondo! Er podio stavolta non te fa entrà!","Boschi ultimo! Te proteggo io... dalle aspettative!","Boschi, tre vittorie de fila! Mo' chi lo sopporta?","Boschi, tre ultimi posti! Le scuse non entrano più!"],
 dottore:["Victor primo! Stavolta er cervello l'ha acceso davvero!","Vince Victor! M'ho svejato, e se vede!","Victor sul podio! Nun svejatelo, che sta vincendo!","Primo Victor! Ao', la sveglia oggi ha funzionato!","Victor ultimo! Svejato sì, ma troppo tardi!","Ultimo Victor! La partita non c'ha er tasto rimanda!","Victor in fondo! M'ho svejato... a risultati finiti!","Victor ultimo! Domani svejate un turno prima!","Victor, tre vittorie de fila! Rimani svejo, per favore!","Victor, tre ultimi posti! Cambiamo suoneria alla sveglia!"],
 judoka:["Carbo vince! Fermate tutto, segnateve la data!","Carbo primo! Stavolta er regolamento je dà ragione!","Vince Carbo! La protesta può aspettà!","Primo Carbo! Ao', un applauso. Senza ricorso!","Carbo ultimo! NO, ASPETTA... no, hai perso davvero!","Ultimo Carbo! Er regolamento de casa tua non vale!","Carbo in fondo! ANGORA CHE DICI? Che hai perso!","Carbo ultimo! La classifica non accetta reclami!","Carbo, tre vittorie de fila! Er ricorso lo fanno gli altri!","Carbo, tre ultimi posti! Pure er regolamento s'è arreso!"],
 ciro:["Ciro primo! Non se l'aspettava manco lui!","Vince Ciro! Er podio oggi non se paga a rate!","Ciro sul podio! Facciamo ottanta a te... de applausi!","Primo Ciro! Oggi paga qualcun altro. In punti!","Ciro ultimo! Er podio lo puoi pagà a rate!","Ultimo Ciro! Paga domani, ma oggi hai perso!","Ciro in fondo! Non c'hai spicci, manco punti!","Ciro ultimo! La classifica non accetta bonifici!","Ciro, tre vittorie de fila! Stavolta nun c'è da trattà!","Ciro, tre ultimi posti! Er debito de punti cresce!"]
};for(const [character,texts]of Object.entries(personal))texts.forEach((text,i)=>add(`personal-${character}-${i+1}`,text,'result',{character,condition:i<4?'winner':i<8?'loser':i===8?'winningStreak':'losingStreak',priority:i>=8?4:2}));

const games:Record<string,string[]>={
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
};for(const [game,texts]of Object.entries(games))texts.forEach((text,i)=>add(`game-${game}-${i+1}`,text,'game',{game,priority:5,spokenText:text.replace(/31/g,'Trentuno').replace(/GOBLIN TIME/g,'Goblin Taim').replace(/GEOFALL/g,'Geofòl').replace(/BACKROOMS/g,'Bècrums'),speed:1.14}));
export const NARRATOR_LINES:readonly NarratorLine[]=list;
