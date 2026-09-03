(()=>{
  const CURRENT='34';
  let reloading=false;
  async function check(){
    if(reloading)return;
    try{
      const r=await fetch(`./site-version.json?t=${Date.now()}`,{cache:'no-store'});
      if(!r.ok)return;
      const data=await r.json();
      if(String(data?.version||'')&&String(data.version)!==CURRENT){
        reloading=true;
        const u=new URL(location.href);
        u.searchParams.set('_build',String(data.version));
        location.replace(u.toString());
      }
    }catch(_){}
  }
  check();
  setInterval(check,60000);
})();
