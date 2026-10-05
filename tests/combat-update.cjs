const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const repo=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(repo,file),'utf8');
const dataFiles=Array.from({length:5},(_,i)=>`data/cards-${i+1}.js`).concat(['data/meta.js','data/corrupted.js']);
const mainFiles=JSON.parse(read('app-loader.js').match(/const f=(\[.*?\]),p=/s)[1].replaceAll("'",'"'));
const expose=`window.__test={state,BY,CARDS,FABLED,flags,fighter,makePlayer,makeEnemy,rng32,floorSeed,ready,save,load,code,decode,stats,ability,battle,enter,turnStart,incoming,damage,die,heal,FULL_prepareHit,FULL_afterPrimaryHit,FULL_effectDamage,FULL_active,VOID_addFracture,VOID_rulesReady,VOID_FRACTURE_RULES,BAN_PRESET_encode,BAN_PRESET_decode,BAN_PRESET_apply,BAN_PRESET_syncFromState,BAN_PRESET_visible,GAME_BAN_limit,EXPERIMENTAL_limit,setContext:ctx=>FULL_CONTEXT=ctx};`;

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
const cases=[];
function test(name,fn){try{fn();cases.push({name,ok:true})}catch(error){cases.push({name,ok:false,error:error.stack})}}

const p=page(),t=p.t,r=t.rng32(123);
test('All 160 definitions and 140 Fabled descriptions have registered handlers',()=>{
  assert.equal(t.CARDS.length,160);assert.equal(Object.keys(t.FABLED).length,140);
  assert.equal(p.w.CARDBORN_ABILITY_AUDIT.ok,true,JSON.stringify(p.w.CARDBORN_ABILITY_AUDIT));
  assert.deepEqual(p.errors,[]);
});
test('Missing server values stop World 8 estimates with an explicit error',()=>{
  assert.equal(t.VOID_rulesReady(),false);
  assert.throws(()=>t.battle([fighter(t,'Nullwing Harvester')],[fighter(t,'Peasant','e')],r,''),/confirmed/);
});
test('Void border stats and team codes survive save, load, and import',()=>{
  const team=t.state.teams[0];team.cards.forEach(s=>{s.name='Nihilus, the Final Horizon';s.flags={...t.flags(),void:true,fabled:true}});
  const imported=t.decode(t.code(team));assert.equal(imported.cards[0].flags.void,true);assert.equal(imported.cards[0].flags.fabled,true);
  const c=t.BY.get('Nihilus, the Final Horizon');assert.ok(t.stats(c,{...t.flags(),void:true}).hp>t.stats(c,t.flags()).hp);
  t.save();t.load();assert.equal(t.state.teams[0].cards[0].flags.void,true);
});
test('Three starting bans, six purchased bans, hidden preset tails, and import',()=>{
  const bans=t.CARDS.filter(c=>!c.isSecret).slice(0,8).map(c=>c.name);
  assert.equal(t.GAME_BAN_limit(),3);
  t.state.banSlots=6;t.state.banPresets[0]={bans:bans.slice(0,6),normalCount:6};t.BAN_PRESET_apply();assert.equal(t.state.bans.length,6);
  t.BAN_PRESET_syncFromState();const code=t.BAN_PRESET_encode();assert.equal(t.BAN_PRESET_decode(code).normalCount,6);
  t.state.banSlots=3;t.BAN_PRESET_apply();t.save();assert.equal(t.state.bans.length,3);assert.equal(t.state.banPresets[0].normalCount,6);
  t.state.banSlots=6;t.BAN_PRESET_apply();assert.equal(t.state.bans.length,6);
  t.state.experimentalBans=true;t.state.bans=bans;t.BAN_PRESET_syncFromState();t.state.experimentalBans=false;t.BAN_PRESET_apply();assert.equal(t.state.bans.length,6);assert.equal(t.state.banPresets[0].bans.length,8);
});
test('Nihilus normal burst occurs on its third turn and charging DR expires',()=>{
  const a=fighter(t,'Nihilus, the Final Horizon'),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);
  t.enter(a,b,[a],[b],r,ctx);assert.equal(t.incoming(a,b,1000,r,ctx),800);
  t.turnStart(a,b,[a],[b],r,ctx);t.turnStart(a,b,[a],[b],r,ctx);assert.equal(b.hp,10000);
  t.turnStart(a,b,[a],[b],r,ctx);assert.equal(b.hp,9250);assert.equal(t.incoming(a,b,1000,r,ctx),1000);
});
test('Nihilus Fabled pulses, third-turn burst, and permanent attack reduction',()=>{
  const a=fighter(t,'Nihilus, the Final Horizon','p',10000,1000,true),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);
  t.enter(a,b,[a],[b],r,ctx);assert.equal(t.incoming(a,b,1000,r,ctx),750);
  for(let i=0;i<3;i++)t.turnStart(a,b,[a],[b],r,ctx);
  assert.equal(b.hp,8400);assert.equal(b.atk,800);assert.equal(a._singularityCharging,false);
});
test('Aurelion reduces per living ally and negates one threshold hit',()=>{
  const a=fighter(t,'Aurelion'),ally=fighter(t,'Peasant'),enemy=fighter(t,'Peasant','e'),ctx=context(t,[a,ally],[enemy]);
  assert.equal(t.incoming(a,enemy,1000,r,ctx),920);a.hp=4500;
  assert.equal(t.incoming(a,enemy,1000,r,ctx),0);assert.equal(a.hp,7000);
  a.hp=4500;assert.equal(t.incoming(a,enemy,1000,r,ctx),920);
});
test('Verdant Worm entry healing and Fabled death grants',()=>{
  const a=fighter(t,'Verdant Worm','p',10000,1000,true),ally=fighter(t,'Peasant'),enemy=fighter(t,'Peasant','e'),ctx=context(t,[a,ally],[enemy]);ally.hp=5000;
  t.enter(a,enemy,[a,ally],[enemy],r,ctx);assert.equal(ally.hp,7000);a.hp=0;
  t.die(a,enemy,[a,ally],[enemy],r,ctx);assert.equal(ally.max,12500);assert.equal(ally.hp,9500);assert.equal(ally.atk,1180);
});
test('Grand Contraption summons two different same-border cards in the right position',()=>{
  const a=fighter(t,'The Grand Contraption','p',10000,1000,true),ally=fighter(t,'Peasant'),enemy=fighter(t,'Peasant','e'),own=[a,ally],ctx=context(t,own,[enemy]);a.flags.void=true;
  t.enter(a,enemy,own,[enemy],r,ctx);assert.equal(a.max,30000);a.hp=0;t.die(a,enemy,own,[enemy],r,ctx);
  assert.equal(own.length,4);assert.equal(own[3],ally);assert.notEqual(own[1].card.name,own[2].card.name);assert.equal(own[1].flags.void,true);assert.equal(own[2].flags.fabled,true);
});
test('Fabled Creator has the equal-rarity stat grants, shield, and extra attack',()=>{
  const a=fighter(t,'The Creator','p',10000,1000,true),b=fighter(t,'The Creator','e',10000,1000,true),ctx=context(t,[a],[b]);
  t.enter(a,b,[a],[b],r,ctx);assert.equal(a.max,17500);assert.equal(a.atk,1500);assert.equal(a.shields,1);assert.equal(a._creatorExtra,1);
});
test('Fabled King of Yellow gains 25% and weakens enemies each third turn',()=>{
  const a=fighter(t,'King of Yellow','p',10000,1000,true),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);
  t.turnStart(a,b,[a],[b],r,ctx);assert.equal(a.max,12500);assert.equal(a.atk,1250);
  t.turnStart(a,b,[a],[b],r,ctx);t.turnStart(a,b,[a],[b],r,ctx);assert.equal(b.atk,900);assert.ok(Number.isFinite(a.hp));
});
test('Fabled Cosmic growth only counts Starfall kills, once per defeated card',()=>{
  const a=fighter(t,'Cosmic Dragon','p',10000,1000,true),b=fighter(t,'Peasant','e',200,10),c=fighter(t,'Peasant','e',300,10),ctx=context(t,[a],[b,c]);
  t.enter(a,b,[a],[b,c],r,ctx);assert.equal(a.atk,1800);assert.equal(a.max,14000);
  const next=fighter(t,'Peasant','e',100,10);ctx.all[1].push(next);next.hp=0;t.die(next,a,ctx.all[1],[a],r,ctx);assert.equal(a.atk,1800);
});
test('Fabled World Eater steals 45% and heals for the health stolen',()=>{
  const a=fighter(t,'World Eater','p',10000,1000,true),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);a.hp=5000;b.hp=0;
  t.die(b,a,[b],[a],r,ctx);assert.equal(a.max,14500);assert.equal(a.hp,9500);assert.equal(a.atk,1450);
});
test('The Unwritten copies a new entry ability and only activates entry once',()=>{
  const a=fighter(t,'The Unwritten','p',10000,1000,true),ally=fighter(t,'Peasant'),b=fighter(t,'Verdant Worm','e',20000,3000),ctx=context(t,[a,ally],[b]);ally.hp=5000;
  t.enter(a,b,[a,ally],[b],r,ctx);assert.equal(a.ability.name,'Bloomburst');assert.equal(a.max,12000);assert.equal(ally.hp,7000);
  t.enter(a,b,[a,ally],[b],r,ctx);assert.equal(ally.hp,7000);
});
test('Fabled Arcane threshold and increasing flat cut participate in defense',()=>{
  const a=fighter(t,'Arcane Overlord','p',1000,100,true),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);
  assert.equal(t.incoming(a,b,349,r,ctx),0);assert.equal(t.incoming(a,b,500,r,ctx),400);assert.equal(t.incoming(a,b,500,r,ctx),360);
});
test('Fabled Rift Dragon reduces every second incoming attack by 80%',()=>{
  const a=fighter(t,'Rift Dragon','p',10000,1000,true),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);
  assert.equal(t.incoming(a,b,1000,r,ctx),1000);assert.equal(t.incoming(a,b,1000,r,ctx),200);
});
test('Ghostly Minions remain in the battle, and summons never mutate saved teams',()=>{
  const a=fighter(t,'Ghastly Herald'),b=fighter(t,'Peasant','e',1000,10),own=[a],foes=[b],ctx=context(t,own,foes);
  b._deathWhisper={source:a,pct:.20,amp:.25};b.hp=0;t.die(b,a,foes,own,r,ctx);assert.equal(own[1].card.name,'Ghostly Minion');a.dead=true;a.hp=0;assert.equal(t.FULL_active(own),own[1]);
  assert.equal(t.state.teams[0].cards.length,4);
});

// Synthetic values exercise the mechanics independently of the missing game numbers.
// These values stay in the test process and are never written into production data.
Object.assign(t.VOID_FRACTURE_RULES,{damagePerStack:.1,healingReductionPerStack:.1,shatterDamage:.2,shatterBase:'sourceAttack',maxStacks:5});
test('Three stacks Shatter and reset; healing uses Fracture reduction',()=>{
  const a=fighter(t,'Nullwing Harvester'),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);
  assert.equal(t.VOID_addFracture(a,b,2,r,ctx),false);b.hp=5000;t.heal(b,1000);assert.equal(b.hp,5800);
  assert.equal(t.VOID_addFracture(a,b,1,r,ctx),true);assert.equal(b._voidFracture,0);assert.equal(b.hp,5600);
});
test('Nullwing bonus hits cannot queue another bonus hit',()=>{
  const a=fighter(t,'Nullwing Harvester','p',10000,1000,true),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]),queue=[];
  t.FULL_afterPrimaryHit(a,b,100,false,[a],[b],r,ctx,{attackKind:'base'},queue);assert.equal(queue.length,1);assert.equal(queue[0].mult,1.10);
  t.FULL_afterPrimaryHit(a,b,100,false,[a],[b],r,ctx,{attackKind:'voidExtra'},queue);assert.equal(queue.length,1);
});
test('Vaeloryn preserves stacks and enforces its two-turn Shatter cooldown',()=>{
  const a=fighter(t,'Vaeloryn, The Last'),b=fighter(t,'Peasant','e',100000,10),ctx=context(t,[a],[b]);
  assert.equal(t.VOID_addFracture(a,b,3,r,ctx),true);assert.equal(b._voidFracture,3);assert.equal(b._voidCancelNextAbility,true);
  ctx.turn=1;assert.equal(t.VOID_addFracture(a,b,1,r,ctx),false);ctx.turn=2;assert.equal(t.VOID_addFracture(a,b,1,r,ctx),true);
});
test('Vaeloryn cancellation suppresses the next defense activation once',()=>{
  const a=fighter(t,'Arcane Overlord','p',1000,100,true),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);a._voidCancelNextAbility=true;
  assert.equal(t.incoming(a,b,500,r,ctx),500);assert.equal(a._voidCancelNextAbility,false);assert.equal(t.incoming(a,b,500,r,ctx),400);
});
test('An ability with no turn effect retains its cancellation until the attack effect',()=>{
  const a=fighter(t,'Nullwing Harvester'),b=fighter(t,'Peasant','e'),ctx=context(t,[a],[b]);a._voidCancelNextAbility=true;
  t.turnStart(a,b,[a],[b],r,ctx);assert.equal(a._voidCancelNextAbility,true);
  t.FULL_afterPrimaryHit(a,b,100,false,[a],[b],r,ctx,{attackKind:'base'},[]);assert.equal(a._voidCancelNextAbility,false);assert.equal(b._voidFracture,undefined);
});
test('Cartographer reversal applies to the actual live team order',()=>{
  const a=fighter(t,'Cartographer of Nowhere'),b=fighter(t,'Peasant','e'),c=fighter(t,'Knight','e'),foes=[b,c],ctx=context(t,[a],foes);
  t.enter(a,b,[a],foes,r,ctx);assert.equal(foes[0],c);assert.equal(foes[1],b);assert.equal(b._voidFracture,1);assert.equal(c.index,0);
});
test('Orphax carries actual excess damage to the next living enemy',()=>{
  const a=fighter(t,'Orphax','p',10000,200),b=fighter(t,'Peasant','e',100,10),c=fighter(t,'Peasant','e',1000,10),foes=[b,c],ctx=context(t,[a],foes);
  const dealt=t.damage(a,b,200,r,ctx,false,{direct:true});assert.equal(dealt,100);t.die(b,a,foes,[a],r,ctx);
  t.FULL_afterPrimaryHit(a,b,dealt,true,[a],foes,r,ctx,{attackKind:'base'},[]);assert.equal(c.hp,850);
});
test('Choir shatters heal allies and cap its additive Void World damage bonus',()=>{
  const a=fighter(t,'Choir of the Unmade'),ally=fighter(t,'Orphax'),b=fighter(t,'Peasant','e',100000,10),ctx=context(t,[a,ally],[b]);ally.hp=2000;
  for(let i=0;i<8;i++)t.VOID_addFracture(a,b,3,r,ctx);
  assert.equal(ally._voidChoirBonus,.50);assert.ok(Math.abs(ally.atk-1500)<=4);assert.equal(ally.hp,10000);
});

async function worker(){
  const messages=[],sandbox={console:{info(){},error(...args){throw Error(JSON.stringify(args))}},setTimeout,clearTimeout,TextEncoder,TextDecoder,URL,Math,Map,Set,Promise,postMessage:m=>messages.push(m)};
  sandbox.self=sandbox;sandbox.fetch=async url=>({ok:true,text:async()=>read(String(url).replace(/^\.\//,'').split('?')[0])});
  const ctx=vm.createContext(sandbox);
  sandbox.importScripts=(...files)=>files.forEach(file=>vm.runInContext(read(file.replace(/^\.\//,'').split('?')[0]),ctx));
  let src=read('sim-child.js');src=src.replace('(0,eval)(parts.join(\'\')+hook);',`parts.push(${JSON.stringify(expose.replace(/,BAN_PRESET_encode.*?,setContext:/s,',setContext:'))});(0,eval)(parts.join('')+hook);`);
  vm.runInContext(src,ctx);await vm.runInContext('boot()',ctx);return {ctx,sandbox,messages};
}

(async()=>{
  try{
    const w=await worker();
    const result=await vm.runInContext(`self.__cardbornChildRun({team:{cards:[{name:'Nihilus, the Final Horizon',flags:{fabled:true,void:true}},{name:'Aurelion',flags:{}},{name:'The Creator',flags:{fabled:true}},{name:'Verdant Worm',flags:{}}]},start:1,cap:1,seed:123,speed:2.5,bans:[]})`,w.ctx);
    test('Child worker boots the complete current engine and returns finite results',()=>{assert.equal(result.seed,123);assert.ok(Number.isFinite(result.actions));assert.ok(Number.isFinite(result.seconds));assert.equal(w.messages.some(m=>m.type==='ready'),true)});
    Object.assign(w.sandbox.__test.VOID_FRACTURE_RULES,t.VOID_FRACTURE_RULES);
    const groups=[['Nihilus, the Final Horizon','Aurelion','The Creator','Verdant Worm'],['Nullwing Harvester','Choir of the Unmade','Orphax','Vaeloryn, The Last'],['The Unwritten','The Grand Contraption','Cosmic Dragon','Rift Dragon']];
    for(const names of groups)for(const seed of [17,93,405]){
      const foes=['Vaeloryn, The Last','Arcane Overlord','Dread Lord','World Eater'];
      const mainPt=names.map((name,i)=>fighter(t,name,'p',20000,1000,true,i)),mainEt=foes.map((name,i)=>fighter(t,name,'e',20000,1000,true,i));
      const main=t.battle(mainPt,mainEt,t.rng32(seed),'');
      const other=vm.runInContext(`(()=>{const t=self.__test;const make=(name,side,i)=>t.fighter(t.BY.get(name),{...t.flags(),fabled:true},side,i,{hp:20000,atk:1000});return t.battle(${JSON.stringify(names)}.map((n,i)=>make(n,'p',i)),${JSON.stringify(foes)}.map((n,i)=>make(n,'e',i)),t.rng32(${seed}),'')})()`,w.ctx);
      test(`Page/child worker combat parity: ${names[0]}, seed ${seed}`,()=>{assert.deepEqual(JSON.parse(JSON.stringify(other)),JSON.parse(JSON.stringify(main)));assert.ok(Number.isFinite(main.actions))});
    }
  }catch(error){cases.push({name:'Child worker boot and simulation',ok:false,error:error.stack})}
  console.log(JSON.stringify(cases,null,2));p.close();
  process.exitCode=cases.some(c=>!c.ok)?1:0;
})();
