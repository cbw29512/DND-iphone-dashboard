/* Donovan remote relay: signed snapshots, display-only subscriber, no monster state. */
(() => {
"use strict";
if (!location.hostname.endsWith(".github.io")) return;
const STORE="donovan_remote_session_v1", BASE="https://ntfy.sh/", enc=new TextEncoder();
const params=new URLSearchParams(location.search), displayOnly=params.get("view")==="phone";
const signal=message=>{const el=document.getElementById("signal");if(el)el.textContent=message;};
const to64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const from64=str=>Uint8Array.from(atob(str.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(str.length/4)*4,"=")),c=>c.charCodeAt(0));
let pairing=null,lastTime=0;
async function localPairing(){
  try{
    let saved;
    try{saved=JSON.parse(localStorage.getItem(STORE));}catch(_){/* New pairing. */}
    if(saved?.room&&saved?.private&&saved?.public){
      const privateKey=await crypto.subtle.importKey("pkcs8",from64(saved.private),
        {name:"ECDSA",namedCurve:"P-256"},false,["sign"]);
      return {room:saved.room,public:saved.public,privateKey};
    }
    const keys=await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
    const room="donovan-"+crypto.randomUUID().replaceAll("-","");
    const publicKey=to64(await crypto.subtle.exportKey("spki",keys.publicKey));
    const secret=to64(await crypto.subtle.exportKey("pkcs8",keys.privateKey));
    try{localStorage.setItem(STORE,JSON.stringify({room,public:publicKey,private:secret}));}
    catch(error){console.warn("Pairing does not persist after browser refresh",error);}
    return {room,public:publicKey,privateKey:keys.privateKey};
  }catch(error){console.error("Secure pairing unavailable",error);
    throw new Error("Secure pairing failed. Open this HTTPS site in an updated browser.");}
}
function phoneLink(pair){
  const url=new URL(location.href);
  url.search="";
  url.searchParams.set("view","phone");
  url.searchParams.set("room",pair.room);
  url.searchParams.set("pub",pair.public);
  return url.href;
}
function showPairing(pair){
  try{
    const panel=document.createElement("section");
    panel.className="internet-pair";
    panel.innerHTML='<strong>iPhone display · pair from anywhere</strong>'+
      '<div class="internet-row"><div id="internetQR" class="internet-qr"></div>'+
      '<div><p>Scan this QR with iPhone Camera. The phone shows Donovan’s picture and latest result only.</p>'+
      '<a id="internetLink" target="_blank" rel="noopener">Open phone display</a>'+
      '<p id="internetStatus">Connecting to online relay…</p></div></div>';
    document.querySelector(".panel").prepend(panel);
    const url=phoneLink(pair);
    const link=document.getElementById("internetLink");link.href=url;link.textContent="Phone display link";
    const old=document.getElementById("displayLink");if(old)old.href=url;
    const status=document.getElementById("connectionText");
    if(status)status.textContent="Internet display: scan the laptop QR. No shared Wi-Fi or Python server needed.";
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
    script.onload=()=>{try{new QRCode(document.getElementById("internetQR"),{text:url,width:176,height:176});}
      catch(error){console.error("QR drawing failed",error);}};
    script.onerror=()=>{document.getElementById("internetQR").textContent="Use the phone display link instead";};
    document.head.appendChild(script);
  }catch(error){console.error("Pairing panel error",error);}
}
async function remotePublish(){
  if(displayOnly)return;
  try{
    pairing=pairing||await localPairing();
    const current=snapshot();
    current.portrait=""; // Default portrait ships with the site; relay messages have a 4 KB limit.
    const data=JSON.stringify({v:1,ts:Date.now(),snap:current});
    const signature=to64(await crypto.subtle.sign(
      {name:"ECDSA",hash:"SHA-256"},pairing.privateKey,enc.encode(data)));
    const payload=JSON.stringify({data,signature});
    if(enc.encode(payload).length>3900)throw new Error("Result exceeded relay size limit");
    const result=await fetch(BASE+pairing.room,{method:"POST",mode:"cors",
      headers:{"Content-Type":"text/plain"},body:payload});
    if(!result.ok)throw new Error("Relay returned HTTP "+result.status);
    signal("SENT ONLINE");
    const status=document.getElementById("internetStatus");
    if(status)status.textContent="Latest result sent online. Phone can display it.";
  }catch(error){
    console.error("Online roll publish failed",error);signal("SEND FAILED");
    const status=document.getElementById("internetStatus");
    if(status)status.textContent="Send failed: "+error.message;
  }
}
async function startPhone(){
  try{
    const room=params.get("room")||"",pub=params.get("pub")||"";
    if(!/^donovan-[a-f0-9]{32}$/.test(room)||!/^[A-Za-z0-9_-]{80,200}$/.test(pub))
      throw new Error("Open the QR pairing link from your laptop; no room is selected.");
    const verifyKey=await crypto.subtle.importKey("spki",from64(pub),
      {name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
    const source=new EventSource(BASE+room+"/sse?since=latest");
    source.onopen=()=>signal("WAITING FOR LAPTOP");
    source.onerror=error=>{console.warn("Relay reconnecting",error);signal("RECONNECTING");};
    source.onmessage=async event=>{
      try{
        const outer=JSON.parse(event.data);
        if(outer.event!=="message")return;
        const {data,signature}=JSON.parse(outer.message);
        if(typeof data!=="string"||typeof signature!=="string")return;
        const valid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},
          verifyKey,from64(signature),enc.encode(data));
        if(!valid)return;
        const incoming=JSON.parse(data);
        if(incoming.v!==1||!incoming.snap?.result||incoming.ts<lastTime)return;
        lastTime=incoming.ts;renderScreen(incoming.snap);signal("LIVE FROM LAPTOP");
      }catch(error){console.warn("Ignored malformed relay update",error);}
    };
  }catch(error){
    console.error("Phone pairing failed",error);signal("PAIRING ERROR");
    document.getElementById("resultDetails").textContent=error.message;
  }
}
async function start(){
  try{
    if(!crypto?.subtle)throw new Error("HTTPS required");
    if(displayOnly){await startPhone();return;}
    pairing=await localPairing();showPairing(pairing);
    publish=remotePublish; // Replace hosted no-op, preserving the local Wi-Fi transport.
    await remotePublish();
  }catch(error){console.error("Internet pairing unavailable",error);signal("PAIRING FAILED");}
}
start();
})();
