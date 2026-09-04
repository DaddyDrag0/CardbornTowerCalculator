// Single-run child worker for the Depth-style Infinite Tower worker pool.
// Each child handles exactly one run at a time and reports floor progress/results
// back to sim-coordinator.js.

self.window=self;
const noop=()=>{};
const dummyNode=()=>({
  style:{},dataset:{},classList:{add:noop,remove:noop,toggle:noop},
  appendChild:noop,remove:noop,addEventListener:noop,setAttribute:noop,
  querySelector:()=>null,querySelectorAll:()=>[],focus:noop,setSelectionRange:noop,
  innerHTML:'',textContent:'',value:'',disabled:false
});
self.document={
  getElementById:()=>dummyNode(),
  createElement:()=>dummyNode(),
  head:dummyNode(),body:dummyNode(),documentElement:{dataset:{}}
};
self.localStorage={getItem:()=>null,setItem:noop,removeItem:noop};

const ENGINE_VERSION='46';
const DATA_FILES=['cards-1.js','cards-2.js','cards-3.js','cards-4.js','cards-5.js','meta.js','corrupted.js'];
const ENGINE_FILES=['app-1.txt','app-2.txt','app-3.txt','app-5.txt','app-fabled-source.txt','app-7a.txt','app-7b.txt','app-7c.txt','app-7d.txt','app-7e.txt','app-cosmic-fix.txt','app-fabled-restore.txt','app-8.txt','app-9.txt','app-11.txt','app-12-worker.txt','app-corrupted-engine.txt','app-bellsinger-fix.txt'];

let bootPromise=null;
function boot(){
  if(bootPromise)return bootPromise;
  bootPromise=(async()=>{
    importScripts(...DATA_FILES.map(x=>`./data/${x}?v=${ENGINE_VERSION}`));
    const parts=await Promise.all(ENGINE_FILES.map(async x=>{
      const r=await fetch(`./${x}?v=${ENGINE_VERSION}`,{cache:'no-store'});
      if(!r.ok)throw new Error(`Failed to load ${x}`);
      return r.text();
    }));
    parts.splice(3,0,'function bind(){}\n');
    const hook=`\nself.__cardbornChildRun=async function(payload){\n  const t=blankTeam();\n  t.cards=Array.from({length:4},(_,i)=>{\n    const s=payload.team?.cards?.[i]||{},f=flags();\n    BORDERS.forEach(k=>f[k]=!!s.flags?.[k]);\n    return{name:BY.has(s.name)?s.name:'',flags:f};\n  });\n  t.corr='';\n  state.teams[0]=t;\n  state.team=0;\n  state.start=Math.max(1,Math.min(MAX_FLOOR,Math.floor(Number(payload.start)||1)));\n  state.cap=Math.max(state.start,Math.min(MAX_FLOOR,Math.floor(Number(payload.cap)||MAX_FLOOR)));\n  const requestedBans=Array.isArray(self.__cardbornAllBans)&&self.__cardbornAllBans.length?self.__cardbornAllBans:(payload.bans||[]);\n  state.bans=requestedBans.filter(n=>BY.has(n)&&!BY.get(n).isSecret).slice(0,10);\n  state.speed=SPEEDS.includes(Number(payload.speed))?Number(payload.speed):2.5;\n  state.pAbilities=true;state.eAbilities=true;\n  const corruptedAbility=CORRUPTED_selected(payload.corruptedAbility||'');\n  const seed=payload.seed>>>0,start=state.start,cap=state.cap;\n  let cleared=start-1,actions=0,changes=0,last=[],death=cap;\n  for(let floor=start;floor<=cap;floor++){\n    if(floor===start||((floor-start)&15)===0)self.postMessage({type:'progress',jobId:payload.jobId,floor});\n    const r=rng32(floorSeed(seed,floor)),pt=makePlayer(t),et=makeEnemy(floor,r);\n    last=et.slice(0,4).map(x=>x.card.name);\n    const b=battle(pt,et,r,corruptedAbility);\n    actions+=b.actions;changes+=b.changes;\n    if(!b.win){\n      death=floor;self.postMessage({type:'progress',jobId:payload.jobId,floor});\n      return{seed,cleared,actions,changes,last,death,enemy:infiniteStats(floor),seconds:runSeconds({actions,changes}),debug:null};\n    }\n    cleared=floor;\n  }\n  return{seed,cleared,actions,changes,last,death:cap+1,enemy:infiniteStats(cap),seconds:runSeconds({actions,changes}),debug:null};\n};\n})();`;
    (0,eval)(parts.join('')+hook);
    self.postMessage({type:'ready'});
  })().catch(err=>{self.postMessage({type:'boot-error',error:String(err?.stack||err)});throw err});
  return bootPromise;
}

self.onmessage=async e=>{
  const payload=e.data||{};if(payload.type!=='run')return;
  try{await boot();const result=await self.__cardbornChildRun(payload);self.postMessage({type:'result',jobId:payload.jobId,result})}
  catch(err){self.postMessage({type:'error',jobId:payload.jobId,error:String(err?.stack||err)})}
};
boot();
