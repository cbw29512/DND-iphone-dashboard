/* One-click D&D: signed, display-only, cross-network phone pairing. */
(() => {
"use strict";
const BASE="https://ntfy.sh/";
const STORE="oneclick_remote_v1";
const args=new URLSearchParams(location.search);
const phone=args.get("view")==="phone";
const encoder=new TextEncoder();
const to64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const from64=str=>Uint8Array.from(atob(str.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(str.length/4)*4,"=")),v=>v.charCodeAt(0));
const status=message=>{const el=document.getElementById(phone?"phoneSignal":"remoteStatus");if(el)el.textContent=message;};
let session=null,latestIssued=0,latestSeen=0,lastPayload="",source=null;
function copySnapshot(){
 if(typeof character==="undefined"||!character)return null;
 const c=character;
 return {name:c.name,classes:c.classes,ac:c.ac,hp:c.hp,hpMax:c.hpMax,turn:c.turn,
  slots:c.remaining||{},result:c.result||{name:"READY",total:"ROLL INITIATIVE",detail:""},
  sent:Date.now()};
}
function phoneUrl(pair){
 const u=new URL(location.href);
 u.search="";
 u.searchParams.set("view","phone");
 u.searchParams.set("room",pair.room);
 u.searchParams.set("pub",pair.public);
 return u.href;
}
async function getPair(){
 let data;
 try{data=JSON.parse(localStorage.getItem(STORE)||"null");}catch(_){}
 if(data?.room&&data?.private&&data?.public){
  try{
   const privateKey=await crypto.subtle.importKey("pkcs8",from64(data.private),{name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
   return {...data,privateKey};
  }catch(error){console.warn("Replacing invalid pairing",error);}
 }
 const keypair=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
 const privateData=to64(await crypto.subtle.exportKey("pkcs8",keypair.privateKey));
 const publicData=to64(await crypto.subtle.exportKey("spki",keypair.publicKey));
 const room="oneclick-"+Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,"0")).join("");
 data={room,private:privateData,public:publicData};
 localStorage.setItem(STORE,JSON.stringify(data));
 return {...data,privateKey:keypair.privateKey};
}
async function publish(refresh=false){
 if(phone||!session)return;
 const snap=copySnapshot();if(!snap)return;
 try{
  const ts=Math.max(Date.now(),latestIssued+1);latestIssued=ts;
  const data=JSON.stringify({version:1,ts,refresh:refresh===true,snap});
  const signature=to64(await crypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},session.privateKey,encoder.encode(data)));
  const payload=JSON.stringify({data,signature});
  if(encoder.encode(payload).length>=3700)throw Error("Result is too large for relay");
  const response=await fetch(BASE+session.room,{method:"POST",mode:"cors",headers:{"Content-Type":"text/plain"},body:payload});
  if(!response.ok)throw Error("Relay HTTP "+response.status);
  status(refresh?"Phone refresh sent":"Phone display updated");
 }catch(error){status("Phone sync failed: "+error.message);console.error("Phone sync",error);}
}
function showQR(url){
 const output=document.getElementById("remoteQR");if(!output)return;
 output.replaceChildren();
 const qr=()=>{
  if(typeof QRCode!=="function"){output.textContent="Open the link on your phone";return;}
  try{new QRCode(output,{text:url,width:180,height:180,colorDark:"#07131e",colorLight:"#ffffff"});}
  catch(error){console.warn("QR failed",error);output.textContent="Use phone link";}
 };
 if(typeof QRCode==="function")return qr();
 const script=document.createElement("script");
 script.src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
 script.onload=qr;script.onerror=()=>{output.textContent="QR unavailable: use phone link";};
 document.head.append(script);
}
async function startController(){
 const panel=document.getElementById("remotePanel");
 if(!panel)return;
 try{
  if(!crypto?.subtle)throw Error("HTTPS is required for secure pairing");
  session=await getPair();
  const url=phoneUrl(session);
  const link=document.getElementById("remotePhoneLink");
  if(link){link.href=url;link.textContent="Open paired phone display";}
  showQR(url);
  document.getElementById("phoneRefresh")?.addEventListener("click",()=>publish(true));
  status("Scan QR code. Phone works on different Wi-Fi or mobile data.");
  window.characterRemote={publish};
  if(typeof character!=="undefined"&&character)publish();
 }catch(error){status("Pairing error: "+error.message);console.error(error);}
}
async function startPhone(){
 document.body.classList.add("phone-only");
 const panel=document.getElementById("phoneView");
 if(panel)panel.hidden=false;
 try{
  const room=args.get("room")||"",pub=args.get("pub")||"";
  if(!/^oneclick-[0-9a-f]{32}$/.test(room)||!/^[A-Za-z0-9_-]{80,200}$/.test(pub))throw Error("Scan the QR on the laptop to pair this phone.");
  const publicKey=await crypto.subtle.importKey("spki",from64(pub),{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  const render=snap=>{
   const set=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=String(value??"");};
   set("phoneName",snap.name);set("phoneClass",snap.classes);
   set("phoneHP","HP "+snap.hp+"/"+snap.hpMax+" · AC "+snap.ac);
   set("phoneSlots",Object.keys(snap.slots||{}).sort((a,b)=>a-b).map(k=>"L"+k+" "+snap.slots[k]).join(" · "));
   set("phoneTurn","TURN "+snap.turn);
   set("phoneResultTitle",snap.result?.name||"READY");
   const weapon=snap.result?.weapon,grid=document.getElementById("phoneWeaponStats");
   const total=document.getElementById("phoneResultTotal");
   if(grid){grid.replaceChildren();grid.hidden=!weapon;}
   if(total)total.hidden=!!weapon;
   if(weapon&&grid){
    for(const [label,value] of [["Hit",weapon.hit],["Damage",weapon.damage],["Special damage",weapon.special]]){
     const cell=document.createElement("div");cell.className="weapon-roll-stat"+(value===null||value===undefined?" muted":"");
     const name=document.createElement("small"),amount=document.createElement("strong");
     name.textContent=label;amount.textContent=value===null||value===undefined?"—":String(value);
     cell.append(name,amount);grid.append(cell);
    }
    set("phoneResultDetails",(weapon.mode==="adv"?"ADV":weapon.mode==="dis"?"DIS":"NORMAL")+
      (weapon.critical?" · CRITICAL":"")+
      (weapon.special!==null&&weapon.special!==undefined?" · SPECIAL INCLUDED":" · NO SPECIAL"));
   }else{
    set("phoneResultTotal",snap.result?.total||"ROLL INITIATIVE");
    set("phoneResultDetails",snap.result?.detail||"");
   }
  };
  const accept=async event=>{
   try{
    if(event?.event!=="message"||typeof event.message!=="string")return;
    const outer=JSON.parse(event.message);
    if(typeof outer.data!=="string"||typeof outer.signature!=="string")return;
    const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},publicKey,from64(outer.signature),encoder.encode(outer.data));
    if(!valid)return;
    const packet=JSON.parse(outer.data);
    if(packet.version!==1||!Number.isSafeInteger(packet.ts)||packet.ts<latestSeen||!packet.snap)return;
    latestSeen=packet.ts;
    render(packet.snap);status("LIVE FROM LAPTOP");
    // Do not reload automatically: reloading Safari can lose updates during a fight.
    // A requested refresh re-renders the latest signed snapshot instead.
   }catch(error){console.warn("Ignored invalid remote event",error);}
  };
  const stream=new EventSource(BASE+room+"/sse?since=latest");
  source=stream;
  stream.onmessage=e=>{try{accept(JSON.parse(e.data));}catch(error){console.warn("Bad SSE",error);}};
  stream.onopen=()=>status("Connected · waiting for laptop");
  stream.onerror=()=>status("Reconnecting to laptop");
  let busy=false;
  async function refresh(){
   if(busy)return;busy=true;
   try{
    const response=await fetch(BASE+room+"/json?poll=1&since=latest",{cache:"no-store"});
    if(!response.ok)throw Error("Relay HTTP "+response.status);
    for(const line of (await response.text()).trim().split("\n").filter(Boolean))await accept(JSON.parse(line));
   }catch(error){console.warn("Catch-up poll unavailable",error);}
   finally{busy=false;}
  }
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh();});
  window.addEventListener("pageshow",()=>refresh());
  window.addEventListener("online",()=>refresh());
  setInterval(()=>{if(!document.hidden)refresh();},15000);
  refresh();
 }catch(error){status(error.message);console.error("Phone setup",error);}
}
if(phone)startPhone();else startController();
})();