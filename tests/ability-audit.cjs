const assert=require('node:assert/strict');
const vm=require('node:vm');
const {page,context,fighter,worker}=require('./engine-harness.cjs');
const source=require('./card-ability-source.json');
const p=page(),t=p.t,cases=[];
function test(name,fn){try{fn();cases.push({name,ok:true})}catch(error){cases.push({name,ok:false,error:error.stack})}}
function setup(name,fabled=false){
  const a=fighter(t,name,'p',10000,1000,fabled),b=fighter(t,'Peasant','p',10000,1000,false,1),e=fighter(t,'Peasant','e',20000,2000),own=[a,b],foes=[e],ctx=context(t,own,foes);
  return {a,b,e,own,foes,ctx};
}
const normalize=s=>String(s).replaceAll("\\'","'");
const entryCases=[
  ['Scarecrow','max',11500,14000],['Goblin','atk',1140,1260],['The Heartbroken','max',20000,25000],
  ['Janus, God of Beginnings','max',20000,28500],['The Last Mammoth','max',14000,22000],
  ['Paradox Creator','atk',10000,10000],['Paradox Creator','max',1000,1000],
  ['Behemoth','max',15000,18000],['Caesar, Eternal Conqueror','max',11500,12000],
  ['Theodora, Empress of Resolve','max',11000,11800],['Tax Collector','atk',1120,1150],
  ['Flare King','max',13000,14500],['Plaguebloom Shaman','max',11500,14000],['Hollow Bellsinger','max',11000,11000],
  ['The Grand Contraption','max',20000,30000],['The Creator','atk',1300,1500],
];
const turnCases=[
  ['Archer','mult',1.15,1.4],['Witch','atk',1100,1200],['Witch','hp',9000,9500],
  ['Quartz Beetle','mult',1.1,1.3],['Archmage','max',12000,11400],
  ['The Cake of Celebration','max',10100,10200],['Wyrmling','max',10500,10600],
  ['Hollow Archer','mult',3,3],['Sun Sprite','max',10700,11000],['Abomination','mult',3,4],
  ['Patient Roller','mult',2,3],['Lotus Swordmaiden','attacks',3,4],['Lotus Swordmaiden','mult',.75,.7],
  ['Berserker','attacks',2,2],['Caesar, Eternal Conqueror','attacks',2,2],
  ['Celestial Fury','attacks',2,2],['Eternal Beast','max',12000,12500],['King of Yellow','max',11500,12500],
];
for(const fabled of [false,true]){
  for(const [name,key,normal,upgraded]of entryCases)test(`${name} ${fabled?'Fabled':'normal'} entry ${key} matches source percentage`,()=>{
    const {a,e,own,foes,ctx}=setup(name,fabled);t.enter(a,e,own,foes,()=>.99,ctx);assert.equal(a[key],fabled?upgraded:normal);
  });
  for(const [name,key,normal,upgraded]of turnCases)test(`${name} ${fabled?'Fabled':'normal'} turn ${key} matches source percentage`,()=>{
    const {a,e,own,foes,ctx}=setup(name,fabled);const out=t.turnStart(a,e,own,foes,()=>name==='Patient Roller'?.99:0,ctx);assert.equal(out[key]??a[key],fabled?upgraded:normal);
  });
}
for(const row of source.cards)test(`Game-source comparison: ${row.card}`,()=>{
  const c=t.BY.get(row.card);assert.ok(c,row.card);assert.equal(c.rarityValue,row.rarity);assert.equal(!!c.isSecret,row.secret);assert.equal(c.weatherLock||null,row.weather||null);
  assert.equal(c.ability.name,normalize(row.ability));
  // Two descriptions in the decompiled file contain replacement characters.
  // The existing repaired text is kept; it is not presented as byte-identical evidence.
  if(!row.normal.includes('\ufffd'))assert.equal(c.ability.desc,normalize(row.normal));
  if(row.fabled&&row.fabled!=='None')assert.equal(t.ability(c,{fabled:true}).desc,normalize(row.fabled));
  else assert.equal(t.ability(c,{fabled:true}).desc,c.ability.desc);
  for(const flags of [{},{shiny:true},{awakened:true},{fabled:true},{corrupted:true},{void:true},{shiny:true,awakened:true,fabled:true,corrupted:true,void:true}]){
    let rarity=row.rarity;for(const [flag,mult]of Object.entries({shiny:100,awakened:1e6,fabled:1e4,corrupted:1e5,void:1e7}))if(flags[flag])rarity*=mult;
    const hp=Math.floor((10+rarity**.35*5)*(source.weatherMultipliers[row.weather]||1)),actual=t.stats(c,flags);
    assert.equal(actual.hp,hp);assert.equal(actual.atk,Math.floor(hp/2));
  }
});

for(const fabled of [false,true]){
  const tag=fabled?'Fabled':'normal';
  test(`${tag} Caesar: bonus-attack lifetime matches the confirmed normal rule and Fabled description`,()=>{
    const {a,own,foes,ctx}=setup('Caesar, Eternal Conqueror',fabled),queue=[];
    for(let i=0;i<3;i++){
      const dead=fighter(t,'Peasant','e',100,10);foes.unshift(dead);dead.hp=0;t.die(dead,a,foes,own,()=>.99,ctx);
      t.FULL_afterPrimaryHit(a,dead,100,true,own,foes,()=>.99,ctx,{attackKind:'base'},queue);
    }
    assert.equal(queue.length,fabled?3:1);assert.equal(a.shields,3);
  });
  test(`${tag} Nian stuns and steals on its second turn`,()=>{
    const {a,e,own,foes,ctx}=setup('Nian',fabled);a.turn=1;t.turnStart(a,e,own,foes,()=>0,ctx);
    assert.equal(e.skip,1);assert.equal(e.max,fabled?14000:16000);assert.equal(a.atk,fabled?1600:1400);
  });
  test(`${tag} Gnomelord explosion selects the correct team`,()=>{
    const {a,b,e,own,foes,ctx}=setup('Gnomelord Technician',fabled);t.turnStart(a,e,own,foes,()=>.99,ctx);
    assert.equal(a.hp,fabled?10000:9900);assert.equal(b.hp,fabled?10000:9900);assert.equal(e.hp,fabled?19600:19900);
  });
  test(`${tag} Romeo attacks twice and sacrifices health only on each successful activation`,()=>{
    const {a,e,own,foes,ctx}=setup('Romeo and Juliet',fabled);const pre=t.turnStart(a,e,own,foes,()=>.99,ctx);assert.equal(pre.attacks,2);
    t.FULL_prepareHit(a,e,foes,()=>.99,ctx,0,2,1);assert.equal(a.hp,10000);
    t.FULL_prepareHit(a,e,foes,()=>0,ctx,0,2,1);assert.equal(a.hp,fabled?9000:8500);
    t.FULL_prepareHit(a,e,foes,()=>0,ctx,1,2,1);assert.equal(a.hp,fabled?8100:7225);
  });
  test(`${tag} Whiteout Stalker targets the lowest-health frozen backline card`,()=>{
    const {a,e,own,foes,ctx}=setup('Whiteout Stalker',fabled),back=fighter(t,'Peasant','e',100,10);back.frozen=1;foes.push(back);
    const pre=t.turnStart(a,e,own,foes,()=>.99,ctx),hit=t.FULL_prepareHit(a,e,foes,()=>.99,ctx,0,1,pre.mult);
    assert.equal(hit.target,back);assert.equal(hit.mult,fabled?2:1.4);assert.equal(hit.meta.targetWasFrozen,true);
    const out=t.battle([fighter(t,'Whiteout Stalker','p',10000,1000,fabled)],[fighter(t,'Peasant','e',2000,10),fighter(t,'Goblin','e',100,10)],()=>.99,'',true);
    assert.match(out.debug.events.find(x=>x.type==='turn'&&x.team==='Allies').detail,/vs Goblin/);
  });
  test(`${tag} Frost Warden copies stats without weakening the opponent`,()=>{
    const {a,e,own,foes,ctx}=setup('Frost Warden',fabled);t.after(a,e,100,own,foes,()=>.99,ctx,false);
    assert.equal(e.max,20000);assert.equal(e.atk,2000);assert.equal(a.max,fabled?12000:11400);assert.equal(a.atk,fabled?1200:1140);
  });
  test(`${tag} Ghastly Herald can summon from an enemy defeated by the entry sting`,()=>{
    const {a,e,own,foes,ctx}=setup('Ghastly Herald',fabled);e.hp=e.max=100;
    t.enter(a,e,own,foes,()=>.99,ctx);assert.equal(e.dead,true);assert.equal(own.at(-1).card.name,'Ghostly Minion');assert.equal(own.at(-1).hp,fabled?30:20);
  });
  test(`${tag} Abyss Warlord includes the lethal incoming hit in stored damage`,()=>{
    const {a,e,own,foes,ctx}=setup('Abyss Warlord',fabled);a.hp=100;
    t.damage(e,a,2000,()=>.99,ctx,false,{direct:true});assert.equal(a.stored,2000);t.die(a,e,own,foes,()=>.99,ctx);assert.equal(e.hp,18000);
  });
  test(`${tag} Hollow Conscription uses original stats and crumbles after its allowed attacks`,()=>{
    const {a,e,own,foes,ctx}=setup('Soulbinder of Decay',fabled);t.enter(e,a,foes,own,()=>.99,ctx);e.max=30000;e.atk=3000;e.hp=0;
    t.die(e,a,foes,own,()=>.99,ctx);const thrall=own.at(-1);assert.equal(thrall.max,fabled?11000:8000);assert.equal(thrall.atk,fabled?1100:800);
    const turns=fabled?2:1;for(let i=0;i<turns;i++)t.FULL_endTurn(thrall,own,foes,()=>.99,ctx);assert.equal(thrall.hp,0);
  });
  test(`${tag} Fallen Knight revival and failure branches respect the two-revival limit`,()=>{
    const {a,e,own,foes,ctx}=setup('Fallen Knight',fabled);a.hp=0;t.die(a,e,own,foes,()=>.99,ctx);
    assert.equal(a.dead,!fabled);assert.equal(a.hp,fabled?2000:0);
  });
  test(`${tag} Umbral releases the consumed mark's attack penalty`,()=>{
    const {a,e,own,foes,ctx}=setup('Umbral',fabled);t.enter(e,a,foes,own,()=>.99,ctx);assert.equal(e.atk,fabled?1300:1600);
    t.damage(e,a,10,()=>.99,ctx,false,{direct:true});t.damage(e,a,10,()=>.99,ctx,false,{direct:true});assert.equal(e.atk,2000);assert.equal(e.skip,1);assert.equal(e._umbralMark,null);
  });
  test(`${tag} crown retains its decay amount when passing across different borders`,()=>{
    const {a,e,ctx,own,foes}=setup('Flare King',fabled),last=fighter(t,'Peasant','p',10000,1000,!fabled,2);own.push(last);
    t.enter(a,e,own,foes,()=>.99,ctx);a.hp=0;t.die(a,e,own,foes,()=>.99,ctx);const middle=own[1];middle.hp=0;t.die(middle,e,own,foes,()=>.99,ctx);
    assert.equal(last._crownPct,fabled?.15:.10);assert.equal(last.atk,fabled?1150:1100);
  });
}
test('Earth King grants each Fabled first-hit health bonus exactly once',()=>{
  const {a,b,e,own,foes,ctx}=setup('Earth King',true);t.enter(a,e,own,foes,()=>.99,ctx);t.damage(e,b,100,()=>.99,ctx,false,{direct:true});assert.equal(b.max,11000);t.damage(e,b,100,()=>.99,ctx,false,{direct:true});assert.equal(b.max,11000);
});
test('Repeated Vampire overheals cannot exceed its 50% shield cap',()=>{
  const {a}=setup('Vampire',true);for(let i=0;i<5;i++)t.heal(a,4000);assert.equal(a.shieldHp,5000);
});
test('Fabled Revenant begins at 50%, and failed rolls increase its next chance',()=>{
  const {a,b,e,own,foes,ctx}=setup('Revenant',true);a.hp=0;t.die(a,e,own,foes,()=>.99,ctx);b.hp=0;t.die(b,e,own,foes,()=>.49,ctx);assert.equal(a.dead,false);assert.equal(a.hp,7500);
  const s=setup('Revenant',true);s.a.hp=0;t.die(s.a,s.e,s.own,s.foes,()=>.99,s.ctx);s.b.hp=0;t.die(s.b,s.e,s.own,s.foes,()=>.6,s.ctx);assert.equal(s.a.dead,true);assert.equal(s.a._reviveChance,.65);
});
test('Fabled Festering Edge carries reduction immediately to the next enemy',()=>{
  const {a,e,own,foes,ctx}=setup('Blight Knight',true),next=fighter(t,'Peasant','e',10000,1000);foes.push(next);e.hp=0;t.die(e,a,foes,own,()=>.99,ctx);t.after(a,e,1000,own,foes,()=>.99,ctx,true);
  assert.equal(next.max,9625);assert.equal(next.hp,9625);assert.equal(a.atk,1350);
});
test('Fabled Rotten Pact expires the recipient instead of the Cultist',()=>{
  const {a,b,e,own,foes,ctx}=setup('Forgotten Cultist',true);t.enter(a,e,own,foes,()=>.99,ctx);
  assert.equal(a._rottenTurns,undefined);assert.equal(b._rottenTurns,4);assert.equal(b.atk,2500);
  for(let i=0;i<4;i++)t.FULL_endTurn(b,own,foes,()=>.99,ctx);assert.equal(b.hp,0);assert.equal(a.hp,10000);
});
for(const fabled of [false,true])test(`Endless Reign uses ${fabled?'projected':'actual'} health missing after redirection`,()=>{
  const {a,b,e,own,foes,ctx}=setup('Archbishop of the End',fabled);b.hp=7500;t.damage(e,a,5000,()=>.99,ctx,false,{direct:true});
  assert.equal(b.hp,fabled?7500:2500);assert.equal(a.atk,1750);assert.equal(a.max,17500);
});
test('Lotus finisher ignores reductions while retaining the target shield',()=>{
  const {a,e,own,foes,ctx}=setup('Lotus Swordmaiden',true);e.dr=.5;
  for(let i=0;i<3;i++)t.FULL_prepareHit(a,e,foes,()=>.99,ctx,i,4,.7);
  const hit=t.FULL_prepareHit(a,e,foes,()=>.99,ctx,3,4,.7);assert.equal(hit.ignore,false);assert.equal(hit.meta.ignoreReduction,true);
  e.shields=1;assert.equal(t.damage(a,e,1500,()=>.99,ctx,hit.ignore,hit.meta),0);assert.equal(e.shields,0);
  assert.equal(t.damage(a,e,1500,()=>.99,ctx,hit.ignore,hit.meta),1500);
});
test('Duelist retains damage amplification and cannot bypass defenses while nullified',()=>{
  const {a,e,own,foes,ctx}=setup('Duelist');t.enter(e,a,foes,own,()=>.99,ctx);e.dr=.5;e._ampTaken=.25;
  assert.equal(t.incoming(e,a,1000,()=>.99,ctx),1250);
  foes.unshift(fighter(t,'Void Reaver','e'));e._ampTaken=0;
  assert.equal(t.FULL_prepareHit(a,e,foes,()=>.99,ctx,0,1,1).ignore,false);assert.equal(t.incoming(e,a,1000,()=>.99,ctx),500);
});
test('Disabling enemy abilities also disables enemy Nullify',()=>{
  const {a,e,own,foes,ctx}=setup('Berserker');foes.unshift(fighter(t,'Void Reaver','e'));t.state.eAbilities=false;
  try{assert.equal(t.turnStart(a,e,own,foes,()=>.99,ctx).attacks,2)}finally{t.state.eAbilities=true}
});
test('Borrowed Mask copies the original ability when the dead card has spent its death trigger',()=>{
  const {a,e,ctx,own,foes}=setup('Necromancer'),crawler=fighter(t,'The Crawling Chaos');own.splice(1,0,crawler);a._onDeathUsed=true;a.hp=0;
  t.die(a,e,own,foes,()=>.99,ctx);assert.equal(crawler.ability.name,'Raise Dead');
});
test('Distinct persistent reductions remain separate and Armor growth does not grow Earth reduction',()=>{
  const {a,b,e,own,foes,ctx}=setup('Earth King',true),armor=fighter(t,'Amethyst Spider','p',10000,1000,true,2);own.push(armor);
  t.teamStart(own,foes,'');t.enter(a,e,own,foes,()=>.99,ctx);assert.equal(t.incoming(armor,e,1000,()=>.99,ctx),600);
  t.after(armor,e,100,own,foes,()=>.99,ctx,false);assert.equal(t.incoming(armor,e,1000,()=>.99,ctx),562);
  assert.deepEqual(Array.from(armor._drEffects,x=>[x.name,x.amount]),[['Amethyst Armor',.25],["Earth's Blessing",.25]]);
});
test('Void Beam hits the immediate next enemy after its primary target dies',()=>{
  const {a,e,own,foes,ctx}=setup('Void Angel',true),next=fighter(t,'Peasant','e'),last=fighter(t,'Peasant','e');foes.push(next,last);e.hp=0;t.die(e,a,foes,own,()=>.99,ctx);
  t.FULL_afterPrimaryHit(a,e,1000,true,own,foes,()=>.99,ctx,{attackKind:'base'},[]);assert.equal(next.hp,9500);assert.equal(last.hp,10000);
});
test('Burrow Bomber excess damage spills after the bypassed victim, without hitting the front',()=>{
  const {a,e,own,foes,ctx}=setup('Burrow Bomber',true),back=fighter(t,'Peasant','e',100,10),last=fighter(t,'Peasant','e');foes.push(back,last);
  const hit=t.FULL_prepareHit(a,e,foes,()=>0,ctx,0,1,1);assert.equal(hit.target,back);
  t.damage(a,back,1500,()=>.99,ctx,false,{...hit.meta,direct:true});t.die(back,a,foes,own,()=>.99,ctx);
  t.FULL_afterPrimaryHit(a,back,100,true,own,foes,()=>.99,ctx,{...hit.meta,mult:hit.mult,flat:hit.flat},[]);assert.equal(e.hp,20000);assert.equal(last.hp,8600);
});
test('Normal Caesar queues only one third hit in a real multi-kill turn',()=>{
  const a=fighter(t,'Caesar, Eternal Conqueror','p',10000,1000),foes=Array.from({length:5},(_,i)=>fighter(t,'Peasant','e',100,1,false,i));
  const out=t.battle([a],foes,()=>.99,'',true),first=out.debug.events.filter(x=>x.type==='turn'&&x.team==='Allies'&&x.turn===1);
  assert.equal(first.length,3);assert.equal(out.win,true);
});
test('The replacement frontline receives its entry effect before attacking after an entry kill',()=>{
  const fragile=fighter(t,'Peasant','p',100,10),next=fighter(t,'Scarecrow','p',10000,1000),e=fighter(t,'Rogue','e',2000,1000);
  const out=t.battle([fragile,next],[e],()=>.99,'',true),first=out.debug.events.find(x=>x.type==='turn'&&x.team==='Allies');
  assert.equal(fragile.dead,true);assert.equal(next.max,11500);assert.match(first.detail,/11\.5K\/11\.5K HP/);
});
for(const name of ['Spiderling','Storm Giant','Dream Eater','Celestial Entity','The Silent King'])test(`${name} retains dodge chance while Nullify suppresses its new dodge bonuses`,()=>{
  const {a,b,e,own,foes,ctx}=setup(name,true);t.enter(a,e,own,foes,()=>.99,ctx);foes.unshift(fighter(t,'Void Reaver','e'));a.hp=5000;
  assert.equal(t.incoming(a,e,1000,()=>0,ctx),0);assert.equal(a.hp,5000);assert.equal(a.atk,1000);assert.equal(b.max,10000);assert.equal(a._eyeNext||0,0);
});

(async()=>{
  try{
    const w=await worker();
    // Every card, including secrets and cards without Fabled upgrades, runs on both sides.
    // Mixed teams exercise passives, copied abilities, summons, revives and target selection.
    for(const row of source.cards)for(const fabled of [false,true])for(const seed of [17,93,405])for(const side of ['p','e']){
      const names=[row.card,'Necromancer','Flare King','The Crawling Chaos'],enemyNames=['Storm King','Whiteout Stalker','Janus, God of Beginnings','Peasant'];
      const make=(n,side,i)=>fighter(t,n,side,12000,1200,fabled,i);
      const playerNames=side==='p'?names:enemyNames,foeNames=side==='p'?enemyNames:names;
      const pt=playerNames.map((n,i)=>make(n,'p',i)),et=foeNames.map((n,i)=>make(n,'e',i)),out=t.battle(pt,et,t.rng32(seed),'');
      const other=vm.runInContext(`(()=>{const t=self.__test;const make=(n,side,i)=>t.fighter(t.BY.get(n),{...t.flags(),fabled:${fabled}},side,i,{hp:12000,atk:1200});return t.battle(${JSON.stringify(playerNames)}.map((n,i)=>make(n,'p',i)),${JSON.stringify(foeNames)}.map((n,i)=>make(n,'e',i)),t.rng32(${seed}),'')})()`,w.ctx);
      test(`${row.card}, ${fabled?'Fabled':'normal'}, seed ${seed}, side ${side}: page/worker combat parity`,()=>{
        assert.deepEqual(JSON.parse(JSON.stringify(out)),JSON.parse(JSON.stringify(other)));
        for(const f of [...pt,...et]){assert.ok([f.hp,f.max,f.atk].every(Number.isFinite));assert.ok(f.max>0);assert.equal(f.dead,f.hp<=0)}
      });
    }
  }catch(error){cases.push({name:'Complete card battle audit',ok:false,error:error.stack})}
  console.log(JSON.stringify(cases,null,2));p.close();process.exitCode=cases.some(x=>!x.ok)?1:0;
})();
