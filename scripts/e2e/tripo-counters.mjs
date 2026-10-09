export async function visualCounters(page) {
 return page.evaluate(async()=>{
  const urls=[...new Set(performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/\/characters\/goblinVisual\.ts(?:\?|$)/.test(n)))];
  const modules=[...new Set(await Promise.all(urls.map(url=>import(url))))];
  const rows=modules.map(m=>m.goblinVisualCounters());
  return {liveInstances:rows.reduce((s,r)=>s+r.liveInstances,0),abortedLoads:rows.reduce((s,r)=>s+r.abortedLoads,0),lateDisposedContainers:rows.reduce((s,r)=>s+r.lateDisposedContainers,0),modules:urls};
 });
}
