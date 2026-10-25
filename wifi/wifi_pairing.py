"""Controller-only pairing panel injected into the unchanged character card."""

PAIRING_PANEL = r'''
<style>
.wifi-pair{margin:0 0 12px;background:#18293b;border:1px solid #b89159;border-radius:14px;padding:13px;color:#f6f1e7}
.wifi-pair summary{cursor:pointer;font-size:16px;font-weight:900;color:#f5c67b}
.wifi-row{display:flex;align-items:center;gap:15px;flex-wrap:wrap;margin-top:11px}
.wifi-qr{background:#fff;width:172px;height:172px;padding:5px;border-radius:7px}
.wifi-text{flex:1;min-width:190px;font-size:14px;line-height:1.55;color:#dae6f2}
.wifi-text strong{font-size:16px;color:#fff}
.wifi-text a{color:#f5c67b;overflow-wrap:anywhere}
.wifi-status{font-weight:850;color:#edbe75}
.wifi-ip{margin-top:10px;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.wifi-ip label{font-size:12px;color:#e5d6bc;font-weight:700}
.wifi-ip input{width:155px;background:#0b1724;color:#fff;border:1px solid #596d85;border-radius:7px;padding:7px;font-size:14px}
.wifi-ip button{background:#957147;border:0;color:#fff;border-radius:7px;padding:8px 12px;font-weight:800}
body.display .wifi-pair{display:none}
</style>
<details class="wifi-pair" id="wifiPair" open>
  <summary>📱 Connect iPhone — scan this Wi-Fi QR</summary>
  <div class="wifi-row">
    <img id="wifiQr" class="wifi-qr" alt="Scan to open Donovan's display-only phone screen" />
    <div class="wifi-text">
      <strong>1.</strong> Connect laptop and phone to the same Wi-Fi.<br>
      <strong>2.</strong> Open iPhone Camera and scan the QR.<br>
      <strong>3.</strong> Tap attacks/spells on this laptop.<br>
      <a id="wifiUrl" target="_blank" rel="noopener">Phone display URL</a><br>
      <span class="wifi-status" id="wifiStatus">Waiting for connection…</span>
    </div>
  </div>
  <div class="wifi-ip">
    <label for="wifiIp">Laptop Wi-Fi IPv4 address</label>
    <input type="text" id="wifiIp" inputmode="decimal" placeholder="192.168.1.20" />
    <button id="wifiApply" type="button">Update QR</button>
  </div>
  <p style="font-size:12px;color:#bfcbd7;margin-bottom:0">If scanning fails, use the address shown above. Phone and laptop must share a reachable network; guest Wi-Fi may isolate devices.</p>
</details>
<script>
(() => {
 'use strict';
 if (new URLSearchParams(location.search).get('view') === 'phone') return;
 const byId=id=>document.getElementById(id);
 const urlEl=byId('wifiUrl'), img=byId('wifiQr'), ip=byId('wifiIp');
 const status=byId('wifiStatus');
 async function getInfo(manual='') {
   try {
     const qs=manual?'?address='+encodeURIComponent(manual):'';
     const resp=await fetch('/api/connect-info'+qs,{cache:'no-store'});
     if(!resp.ok) throw new Error('Address not accepted ('+resp.status+')');
     const info=await resp.json();
     if(!info.phone_url) throw new Error('No laptop Wi-Fi address detected. Enter IPv4 below.');
     ip.value=info.address;
     urlEl.href=info.phone_url;urlEl.textContent=info.phone_url;
     img.src='/api/qr.svg?address='+encodeURIComponent(info.address);
     status.textContent=info.phone_connected?'PHONE CONNECTED':'Waiting for iPhone to scan…';
   }catch(err){console.error('Wi-Fi setup error:',err);status.textContent=err.message||'Could not build phone QR';}
 }
 byId('wifiApply').addEventListener('click',()=>{getInfo(ip.value.trim());});
 getInfo();
 setInterval(async()=>{try{
   const selected=ip.value.trim();if(!selected)return;
   const response=await fetch('/api/connect-info?address='+encodeURIComponent(selected),{cache:'no-store'});
   if(!response.ok)return;const data=await response.json();
   status.textContent=data.phone_connected?'PHONE CONNECTED':'Waiting for iPhone to scan…';
 }catch(err){console.warn('Wi-Fi status update unavailable:',err);}},2500);
})();
</script>
'''


def with_pairing_panel(html: str) -> str:
    """Add the UI to the laptop controller without touching the phone artwork."""
    if '<div class="panelheader">' not in html:
        raise ValueError('Controller HTML is missing panel header')
    return html.replace('<div class="panelheader">', PAIRING_PANEL + '<div class="panelheader">', 1)
