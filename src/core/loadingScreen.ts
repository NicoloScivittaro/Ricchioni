/** Indeterminate progress: readiness, never elapsed seconds, releases the screen. */
export function loadingScreen(parent:HTMLElement,name:string,icon='◆'):HTMLDivElement{
 const el=document.createElement('div');el.className='game-asset-loading';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
 el.style.cssText='position:fixed;inset:0;z-index:15000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;background:radial-gradient(ellipse at 50% 35%,#23344a,#0b0e19 70%);color:#f5ebda;text-align:center;padding:24px;font-family:Arial,sans-serif';
 const style=document.createElement('style');style.textContent='@keyframes asset-progress{0%{transform:translateX(-110%)}100%{transform:translateX(340%)}}@media(prefers-reduced-motion:reduce){.asset-progress{animation-duration:4s!important}}';
 const emblem=document.createElement('div');emblem.textContent=icon;emblem.style.cssText='font-size:64px;color:#edc579';
 const title=document.createElement('strong');title.textContent=name;title.style.cssText='font-size:clamp(20px,3vw,36px);letter-spacing:.08em;max-width:85vw';
 const label=document.createElement('span');label.textContent='PREPARAZIONE MODELLI E TEXTURE';label.style.cssText='font-size:12px;letter-spacing:.17em;color:#b9c9dc';
 const rail=document.createElement('div');rail.style.cssText='width:min(400px,75vw);height:7px;border-radius:9px;background:#ffffff12;overflow:hidden';rail.setAttribute('role','progressbar');rail.setAttribute('aria-label','Caricamento delle risorse');
 const bar=document.createElement('i');bar.className='asset-progress';bar.style.cssText='display:block;width:30%;height:100%;border-radius:9px;background:linear-gradient(90deg,#c58d40,#ffe1a0);animation:asset-progress 1.5s ease-in-out infinite';rail.appendChild(bar);
 const note=document.createElement('span');note.textContent='Il gioco inizierà quando la scena sarà pronta.';note.style.cssText='color:#8798af;font-size:13px';
 el.append(style,emblem,title,label,rail,note);parent.appendChild(el);return el;
}
