import { existsSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const origin='http://localhost:3001';
async function network(){
 try{
  const res=await fetch(`${origin}/api/network`,{signal:AbortSignal.timeout(1500)});
  if(!res.ok)return null;
  const data=await res.json();return Array.isArray(data.ips)?data:null;
 }catch{return null;}
}
try {
 if(!existsSync(resolve(root,'dist/index.html')))throw new Error('Manca la build del gioco: esegui npm run build nella cartella Ricchioni.');
 let data=await network();
 if(process.argv.includes('--check')){
  if(!data)throw new Error('Server locale non avviato. Apri AVVIA-PARTITA.cmd per avviarlo.');
 }else if(!data){
  const tsx=resolve(root,'node_modules/tsx/dist/cli.mjs');
  if(!existsSync(tsx))throw new Error('Mancano le dipendenze: esegui npm install nella cartella Ricchioni.');
  const logs=resolve(root,'logs');mkdirSync(logs,{recursive:true});
  const stdout=openSync(resolve(logs,'party-server.log'),'a');
  const stderr=openSync(resolve(logs,'party-server-errors.log'),'a');
  try{
   const child=spawn(process.execPath,[tsx,'server/index.ts'],{
    cwd:root,detached:true,windowsHide:true,stdio:['ignore',stdout,stderr],env:{...process.env,PORT:'3001'}
   });
   child.on('error',err=>console.error(`Avvio server fallito: ${err.message}`));child.unref();
  }finally{closeSync(stdout);closeSync(stderr);}
  for(let i=0;i<30&&!data;i++){await new Promise(r=>setTimeout(r,500));data=await network();}
  if(!data)throw new Error('Il server non parte sulla porta 3001. Controlla logs/party-server-errors.log.');
 }
 console.log(`\nGioco pronto: ${origin}/`);
 for(const ip of data.ips)console.log(`Telefoni sulla stessa Wi-Fi: http://${ip}:3001/controller.html`);
 console.log('Scegli 3 giocatori; per la prima prova usa BREVE (40 punti). Nella stanza inquadrate il QR e premete PRONTO.\n');
 if(!process.argv.includes('--check')&&process.platform==='win32'){
  const browser=spawn('powershell.exe',['-NoProfile','-Command',"Start-Process 'http://localhost:3001/'"],{windowsHide:true,stdio:'ignore'});
  browser.on('error',()=>console.log(`Apri manualmente ${origin}/`));browser.unref();
 }
}catch(err){console.error(`\n${err.message}`);process.exitCode=1;}
