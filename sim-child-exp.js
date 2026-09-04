// Thin wrapper around the stable single-run worker.
// Captures the full requested ban list (up to 10) for Experimental mode.
importScripts('./sim-child.js?v=46');
const EXP_CHILD_baseOnMessage=self.onmessage;
self.onmessage=e=>{
  try{self.__cardbornAllBans=Array.isArray(e?.data?.bans)?e.data.bans.slice(0,10):[]}catch(_){self.__cardbornAllBans=[]}
  return EXP_CHILD_baseOnMessage?.call(self,e);
};
