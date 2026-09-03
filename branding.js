(()=>{
  const enforce=()=>{
    document.title='Infinite Tower';
    document.documentElement.dataset.theme='slate';
    try{
      localStorage.removeItem('cardborn-theme');
      const key='cardborn-infinite-v4';
      const saved=JSON.parse(localStorage.getItem(key)||'null');
      if(saved&&saved.theme!=='slate'){
        saved.theme='slate';
        localStorage.setItem(key,JSON.stringify(saved));
      }
    }catch(_){}
    document.querySelectorAll('.theme-switch').forEach(el=>el.remove());
    document.querySelectorAll('h1,h2,h3,h4').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(t==='Infinite Dungeon'||t==='Infinite Dungeon Calculator'||t==='Cardborn · Infinite Dungeon Calculator'||t==='Cardborn Infinite Dungeon Calculator'){
        el.textContent='Infinite Tower';
      }
    });
  };
  enforce();
  const app=document.getElementById('app');
  if(app)new MutationObserver(enforce).observe(app,{childList:true,subtree:true});
})();
