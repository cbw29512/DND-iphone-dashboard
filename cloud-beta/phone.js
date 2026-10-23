import {configured,currentUser,signIn,signOut,readPublicFrames} from './cloud-api.js';
import {silhouetteFor} from './silhouettes.js';
const $=q=>document.querySelector(q);
let selected=null,revision=-1,refreshing=false,interval=null;
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
function showLoggedIn(yes){$('#phone-login').hidden=yes;$('#phone-screen').hidden=!yes;$('#phone-status').textContent=yes?'Connecting…':'Not connected';}
function render(state){
 const screen=$('#phone-card');screen.replaceChildren();
 if(!state?.name){screen.append(el('p','helper','Waiting for the DM to begin…'));return;}
 screen.append(el('p','eyebrow','IRON LANTERN · ROUND '+(state.round??1)),el('h2','phone-monster-name',state.name));
 const art=el('div','phone-view-portrait');
 art.append(silhouetteFor(state.sourceId||state.kind||'player'));screen.append(art);
 if(state.action?.type==='attack'){
   const a=state.action;
   screen.append(el('p','phone-attack-name',a.name));
   screen.append(el('span','phone-field-label','TO HIT'),el('strong','phone-hit-number',a.total));
   if(a.critical||a.fumble)screen.append(el('span','phone-natural',a.critical?'NATURAL 20':'NATURAL 1'));
   screen.append(el('span','phone-field-label','DAMAGE · '+String(a.damageType||'').toUpperCase()));
   screen.append(el('strong','phone-damage-number',a.damage));
 }else screen.append(el('p','phone-attack-name',state.kind==='player'?'PLAYER TURN':'MONSTER TURN'),el('span','phone-field-label','INITIATIVE '+(state.initiative??'—')));
}
async function refresh(){
 if(refreshing||!currentUser())return;refreshing=true;
 try{
  const frames=await readPublicFrames();
  const picker=$('#phone-battle-picker');
  const ids=frames.map(f=>f.session_id);
  if(!selected||!ids.includes(selected))selected=ids[0]||null;
  const old=picker.querySelector('select');
  if(!old||old.dataset.options!==ids.join('|')){
   picker.replaceChildren();
   const select=el('select');select.dataset.options=ids.join('|');select.setAttribute('aria-label','Choose authorized battle display');
   frames.forEach((f,i)=>{const option=el('option',f.public_state?.battleName||('Battle '+(i+1)));option.value=f.session_id;select.append(option);});
   select.addEventListener('change',()=>{selected=select.value;revision=-1;refresh();});
   picker.append(select);
  }
  if(picker.querySelector('select'))picker.querySelector('select').value=selected||'';
  const frame=frames.find(f=>f.session_id===selected);
  if(!frame){revision=-1;render(null);}
  else if(frame.revision>revision){revision=frame.revision;render(frame.public_state);}
  $('#phone-status').textContent='● Connected · updated '+new Date().toLocaleTimeString();
 }catch(e){$('#phone-status').textContent='Reconnecting…';$('#phone-error').textContent=e.message;}
 finally{refreshing=false;}
}
function start(){showLoggedIn(true);clearInterval(interval);refresh();interval=setInterval(refresh,2500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});}
$('#phone-auth-form').addEventListener('submit',async e=>{
 e.preventDefault();$('#phone-error').textContent='';
 try{await signIn($('#phone-email').value,$('#phone-password').value);$('#phone-password').value='';start();}
 catch(err){$('#phone-error').textContent='Sign in failed: '+err.message;}
});
$('#phone-logout').addEventListener('click',()=>{clearInterval(interval);signOut();showLoggedIn(false);});
if(!configured())$('#phone-error').textContent='Cloud backend is not configured yet.';
if(currentUser())start();
