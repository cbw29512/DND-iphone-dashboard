/** Local-development transport; DM sends only deliberate public-frame changes. */
export function makeLocalDmPush(key,endpoint='/local-api/frame'){
 return async frame=>{
  const response=await fetch(endpoint,{method:'POST',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
   body:JSON.stringify({session:'demo',frame})});
  if(!response.ok)throw Error('Local push failed: '+response.status);
  return response.json();
 };
}
export function openLocalPhoneStream(key,{onFrame,onStatus},endpoint='/local-api/events'){
 const url=new URL(endpoint,location.href);url.searchParams.set('displayKey',key);
 const events=new EventSource(url);
 let revision=-1;
 events.onopen=()=>onStatus?.('Connected');
 events.onerror=()=>onStatus?.('Reconnecting…');
 events.onmessage=msg=>{
  try{const data=JSON.parse(msg.data);if(data.revision>revision){
   revision=data.revision;onFrame(data.frame,data.revision);
  }}catch{onStatus?.('Invalid frame ignored');}
 };
 return ()=>events.close();
}
