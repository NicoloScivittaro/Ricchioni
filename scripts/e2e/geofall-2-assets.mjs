import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {launch,HOST_URL} from './lib.mjs';
const browser=await launch(),out='docs/agent-work/geofall-2',result=[];
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720});
 const files=readdirSync('public/geofall/advanced').filter(f=>f.endsWith('.svg'));
 for(const type of ['flag','outline','monument','flag-original']){
  const original=type==='flag-original',selected=original?readdirSync('public/geofall').filter(f=>f.startsWith('flag-')&&f.endsWith('.svg')):files.filter(f=>f.startsWith(type));
  await page.setContent(`<style>body{background:#17283b;color:white;font:14px Arial;margin:12px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.tile{background:#e9f5ff;color:#142d45;padding:8px;text-align:center;border-radius:7px}img{width:100%;height:165px;object-fit:contain}p{margin:3px}</style><div class="grid">${selected.map(f=>`<div class="tile"><img src="${HOST_URL}geofall/${original?'':'advanced/'}${f}"><p>${f}</p></div>`).join('')}</div>`);
  const dimensions=await page.evaluate(async()=>{const images=[...document.images];await Promise.all(images.map(i=>i.decode()));return images.map(i=>({src:i.src,w:i.naturalWidth,h:i.naturalHeight}));});assert.ok(dimensions.every(i=>i.w>0&&i.h>0));
  if(type.startsWith('flag')){const data=JSON.parse(readFileSync(`${out}/flag-audit.json`));for(const i of dimensions){const code=/flag-(\w+)\.svg/.exec(i.src)[1];assert.ok(Math.abs(i.w/i.h-data.find(x=>x.country===code).ratio)<.01);}}
  await page.screenshot({path:`${out}/assets-${type}-1280.png`,fullPage:true});result.push({type,dimensions});
 }
}finally{writeFileSync(`${out}/assets-browser.json`,JSON.stringify(result,null,2));await browser.close();}
