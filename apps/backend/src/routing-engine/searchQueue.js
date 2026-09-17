// Single worker, bounded FIFO admission. Waiting callers can leave without consuming a slot.
export function createSearchQueue(capacity=4) {
 let active=false;const waiting=[]
 const busy=()=>Object.assign(new Error('검색 요청이 많습니다. 잠시 후 다시 시도해주세요.'),{status:429,code:'ROUTING_BUSY',expose:true})
 function acquire(signal){
  signal?.throwIfAborted()
  if(active&&waiting.length>=capacity)return Promise.reject(busy())
  return new Promise((resolve,reject)=>{
   const item={start(){signal?.removeEventListener('abort',abort);active=true;let released=false;resolve(()=>{if(released)return;released=true;active=false;waiting.shift()?.start()})}}
   const abort=()=>{const i=waiting.indexOf(item);if(i>=0)waiting.splice(i,1);reject(signal.reason)}
   if(active){waiting.push(item);signal?.addEventListener('abort',abort,{once:true})}else item.start()
  })
 }
 return {acquire}
}
