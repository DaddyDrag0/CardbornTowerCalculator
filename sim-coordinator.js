// Depth-style coordinator worker for Infinite Tower.
// One coordinator owns up to 8 single-run child workers and continuously feeds
// the next queued run to whichever child finishes first.

const MAX_WORKERS=8;
const CHILD_URL='./sim-child-exp.js?v=38';

self.onmessage=e=>{
  const req=e.data||{};
  if(req.type!=='batch')return;

  const runs=Math.max(1,Math.floor(Number(req.runs)||1));
  const workerCount=Math.min(MAX_WORKERS,runs);
  const results=new Array(runs);
  const workers=[];
  const active=new Map();
  let nextRun=0,completed=0,settled=false;

  const stopAll=()=>workers.forEach(w=>{try{w.terminate()}catch(_){}});
  const fail=err=>{
    if(settled)return;settled=true;stopAll();
    self.postMessage({type:'error',error:String(err?.stack||err)});
  };
  const report=(floor)=>{
    const vals=[...active.values()].map(x=>x.floor).filter(Number.isFinite);
    self.postMessage({
      type:'progress',completed,total:runs,workerCount,activeRuns:active.size,
      floor:Number(floor)||req.start||1,
      minActiveFloor:vals.length?Math.min(...vals):undefined,
      maxActiveFloor:vals.length?Math.max(...vals):undefined
    });
  };
  const finish=()=>{
    if(settled||completed<runs)return;
    settled=true;stopAll();self.postMessage({type:'result',results,workerCount});
  };
  const dispatch=(w,workerIndex)=>{
    if(settled)return;
    if(nextRun>=runs){active.delete(workerIndex);finish();return}
    const runIndex=nextRun++;
    const seed=(Number(req.base)+Math.imul(Number(req.teamIndex)||0,0x9e3779b9)+Math.imul(runIndex,2654435761))>>>0;
    const jobId=`${req.teamIndex||0}:${runIndex}:${seed}`;
    w.__job={jobId,runIndex,workerIndex};
    active.set(workerIndex,{runIndex,floor:Number(req.start)||1});
    report(req.start);
    w.postMessage({type:'run',jobId,team:req.team,bans:req.bans||[],start:req.start,cap:req.cap,speed:req.speed,seed,corruptedAbility:req.corruptedAbility||''});
  };

  try{
    for(let i=0;i<workerCount;i++){
      const w=new Worker(CHILD_URL);workers.push(w);
      w.onerror=ev=>fail(ev?.message||'Infinite Tower child worker failed');
      w.onmessage=ev=>{
        const msg=ev.data||{};
        if(msg.type==='ready')return;
        if(msg.type==='boot-error'||msg.type==='error'){fail(msg.error||'Infinite Tower child worker failed');return}
        const job=w.__job;if(!job||msg.jobId!==job.jobId)return;
        if(msg.type==='progress'){
          active.set(i,{runIndex:job.runIndex,floor:Math.max(1,Math.floor(Number(msg.floor)||Number(req.start)||1))});
          report(msg.floor);return;
        }
        if(msg.type==='result'){
          results[job.runIndex]=msg.result;completed++;active.delete(i);report(msg.result?.death<=req.cap?msg.result.death:msg.result?.cleared);
          if(completed>=runs){finish();return}
          dispatch(w,i);
        }
      };
      dispatch(w,i);
    }
  }catch(err){fail(err)}
};
