const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const repo=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const dataFiles=Array.from({length:5},(_,i)=>`data/cards-${i+1}.js`).concat(['data/meta.js','data/corrupted.js']);
const mainFiles=JSON.parse(read('app-loader.js').match(/const f=(\[.*?\]),p=/s)[1].replaceAll("'",'"'));
const expose=`window.__test={state,BY,CARDS,FABLED,flags,fighter,makePlayer,makeEnemy,rng32,floorSeed,ready,save,load,code,decode,stats,ability,simulate,battle,enter,turnStart,incoming,damage,die,heal,FULL_prepareHit,FULL_afterPrimaryHit,FULL_effectDamage,FULL_active,VOID_addFracture,VOID_rulesReady,VOID_FRACTURE_RULES,BAN_PRESET_encode,BAN_PRESET_decode,BAN_PRESET_apply,BAN_PRESET_syncFromState,BAN_PRESET_visible,GAME_BAN_limit,EXPERIMENTAL_limit,teamStart,after,FULL_endTurn,FULL_queueRevive,FULL_resolveTeamDeaths,FULL_ensureEntry,setContext:ctx=>FULL_CONTEXT=ctx};`;

function page(saved={}){
  const errors=[];
  const dom=new JSDOM('<!doctype html><html><head></head><body><div id="app"></div><div id="cardTooltip"></div></body></html>',{url:'http://localhost/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;
  for(const [key,value] of Object.entries(saved))w.localStorage.setItem(key,value);
  w.console={info(){},log(){},warn(){},error(...args){errors.push(args)}};
  w.alert=()=>{};w.prompt=()=>null;w.matchMedia=()=>({matches:false,addEventListener(){}});
  for(const file of dataFiles)w.eval(read(file));
  const parts=mainFiles.map(read);
  parts[parts.length-1]=parts.at(-1).replace('load();state.pAbilities',expose+'\nload();state.pAbilities');
  w.eval(parts.join('\n'));
  return {w,t:w.__test,errors,close:()=>w.close()};
}

function context(t,pt,et){const ctx={team:f=>f?.side==='p'?pt:et,opponentTeam:f=>f?.side==='p'?et:pt,all:[pt,et],turn:0};t.setContext(ctx);return ctx}
function fighter(t,name,side='p',hp=10000,atk=1000,fabled=false,index=0){return t.fighter(t.BY.get(name),{...t.flags(),fabled},side,index,{hp,atk})}

async function worker(){
  const messages=[],sandbox={console:{info(){},error(...args){throw Error(JSON.stringify(args))}},setTimeout,clearTimeout,TextEncoder,TextDecoder,URL,Math,Map,Set,Promise,postMessage:m=>messages.push(m)};
  sandbox.self=sandbox;sandbox.fetch=async url=>({ok:true,text:async()=>read(String(url).replace(/^\.\//,'').split('?')[0])});
  const ctx=vm.createContext(sandbox);
  sandbox.importScripts=(...files)=>files.forEach(file=>vm.runInContext(read(file.replace(/^\.\//,'').split('?')[0]),ctx));
  let src=read('sim-child.js');src=src.replace('(0,eval)(parts.join(\'\')+hook);',`parts.push(${JSON.stringify(expose.replace(/,BAN_PRESET_encode.*?,setContext:/s,',setContext:'))});(0,eval)(parts.join('')+hook);`);
  vm.runInContext(src,ctx);await vm.runInContext('boot()',ctx);return {ctx,sandbox,messages};
}

module.exports={page,context,fighter,worker,read};
