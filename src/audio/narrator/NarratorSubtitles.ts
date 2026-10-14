export class NarratorSubtitles {
  private element:HTMLDivElement|null=null;
  show(text:string,event:'roller'|'game'|'result'):void{
    this.hide();const element=document.createElement('div');element.id='narrator-subtitles';element.dataset.event=event;element.setAttribute('aria-live','polite');
    element.style.cssText=`position:fixed;left:50%;transform:translateX(-50%);${event==='result'?'bottom:1.2%':'top:13.5%'};z-index:8000;width:min(950px,88vw);padding:7px 16px;background:#080d19dd;border:1px solid #d5ad5a;border-radius:10px;color:white;text-align:center;pointer-events:none;font:700 clamp(13px,1.65vw,22px)/1.25 system-ui;text-shadow:0 2px 3px black;`;
    const label=document.createElement('div');label.textContent='🎙️ IL NARRATORE BASTARDO';label.style.cssText='font-size:.52em;letter-spacing:.12em;color:#eac474;margin-bottom:3px';
    const subtitle=document.createElement('div');subtitle.textContent=text;subtitle.style.cssText='display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';element.append(label,subtitle);document.body.append(element);this.element=element;
  }
  hide():void{this.element?.remove();this.element=null;}
}
