// Lightweight worker wrapper for the 8-way Infinite Tower simulator.
// The underlying engine used to build a complete battle-debug timeline for every
// simulated run. A single long/stalled battle could produce thousands of events,
// making one worker fail and causing the whole pool to fall back to the main thread.
//
// Keep the exact combat result, seed, floor, action and timing data, but defer the
// expensive debug replay until the user actually clicks a run in the UI.

const FAST_nativePostMessage=self.postMessage.bind(self);
self.postMessage=function(message,transfer){
  if(message?.type==='ready'){
    // replayFloor is a global engine binding after sim-worker finishes booting.
    // Worker simulations only need the outcome; the page recreates debug on demand.
    try{replayFloor=function(){return{debug:null}}}catch(_){}
  }
  if(message?.type==='result'&&message.result)message.result.debug=null;
  return transfer!==undefined?FAST_nativePostMessage(message,transfer):FAST_nativePostMessage(message);
};

importScripts('./sim-worker.js?v=27');
