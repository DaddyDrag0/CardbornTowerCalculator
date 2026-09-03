(()=>{
  const rename=()=>{
    document.title='Infinite Tower';
    document.querySelectorAll('h1,h2,h3,h4').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(t==='Infinite Dungeon'||t==='Infinite Dungeon Calculator'||t==='Cardborn · Infinite Dungeon Calculator'||t==='Cardborn Infinite Dungeon Calculator'){
        el.textContent='Infinite Tower';
      }
    });
  };
  rename();
  const app=document.getElementById('app');
  if(app)new MutationObserver(rename).observe(app,{childList:true,subtree:true});
})();
