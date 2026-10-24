/** Local-only push core: events happen only on DM writes. No polling. */
export function createFrameStore(){
 const sessions=new Map();
 return {
  ensure(id){if(!sessions.has(id))sessions.set(id,{revision:0,frame:null,clients:new Set()});return sessions.get(id);},
  publish(id,frame){
   const s=this.ensure(id);s.revision++;
   // Defensive copy: never hand mutable objects to subscribers.
   s.frame=structuredClone(frame);
   const event={revision:s.revision,frame:structuredClone(s.frame)};
   for(const send of [...s.clients]){try{send(event);}catch{s.clients.delete(send);}}
   return event;
  },
  subscribe(id,send){
   const s=this.ensure(id);s.clients.add(send);
   if(s.frame)send({revision:s.revision,frame:structuredClone(s.frame)});
   return ()=>s.clients.delete(send);
  },
  listeners(id){return this.ensure(id).clients.size}
 };
}
