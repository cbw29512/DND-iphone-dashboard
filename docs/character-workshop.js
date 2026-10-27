/* Character Forge workshop: isolated, interactive 2014 Fighter demonstration.
   Derived stats are computed from build state; no independent form totals. */
(function(root){
"use strict";
const ABILITIES=["STR","DEX","CON","INT","WIS","CHA"];
const WEAPONS={
 longsword:{label:"Longsword",damage:"1d8",stat:"STR",twoHanded:false},
 rapier:{label:"Rapier",damage:"1d8",stat:"FINESSE",twoHanded:false},
 longbow:{label:"Longbow",damage:"1d8",stat:"DEX",twoHanded:true}
};
const START_SCORES={STR:16,DEX:12,CON:14,INT:10,WIS:10,CHA:8};
const fresh=()=>({name:"Kael Voss",classId:"fighter",subclass:null,level:5,
 scores:{...START_SCORES},weapons:["longsword"],shield:true,armor:"chain",
 foeNotActed:false,foeSurprised:false,currentHP:null,secondWindUsed:false,surgeUsed:false,result:null});
let state=fresh();
const mod=n=>Math.floor((n-10)/2);
const sign=n=>(n>=0?"+":"")+n;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(n))?Math.trunc(Number(n)):lo));
function derive(s){
 const lv=clamp(s.level,1,20),scores=s.scores||START_SCORES;
 const mods=Object.fromEntries(ABILITIES.map(k=>[k,mod(clamp(scores[k],1,30))]));
 const prof=Math.min(6,2+Math.floor((lv-1)/4));
 const maxHP=Math.max(1,10+mods.CON)+(lv-1)*Math.max(1,6+mods.CON);
 const armor=s.armor==="none"?10+mods.DEX:16;
 const ac=armor+(s.shield?2:0);
 const speed=s.armor==="chain"&&scores.STR<13?20:30;
 const attacks=lv>=20?4:lv>=11?3:lv>=5?2:1;
 const critMin=s.subclass==="champion"&&lv>=3?(lv>=15?18:19):20;
 const characterWeapons=(s.weapons||[]).filter(k=>WEAPONS[k]).map(k=>{
  const w=WEAPONS[k],attackMod=w.stat==="FINESSE"?Math.max(mods.STR,mods.DEX):mods[w.stat];
  return {id:k,label:w.label,damage:w.damage,attack:attackMod+prof,
   modifier:attackMod,bonus:sign(attackMod+prof),damageLabel:w.damage+sign(attackMod),
   ability:w.stat==="FINESSE"?(mods.DEX>mods.STR?"DEX":"STR"):w.stat,
   blocked:!!(w.twoHanded&&s.shield)};
 });
 const alerts=[];
 if(s.subclass==="assassin"){
  alerts.push("HOMEBREW: Rogue Assassin attached to a Fighter. This is not a legal 2014 RAW subclass choice; DM approval required. No Rogue levels or Sneak Attack added.");
 }else if(s.subclass==="champion"&&lv<3){
  alerts.push("Champion features start at Fighter level 3. No subclass benefits yet.");
 }
 if(s.armor==="chain"&&scores.STR<13)alerts.push("Chain mail needs STR 13. Speed is reduced by 10 ft (unless a separate rule removes that penalty).");
 if(s.shield&&s.weapons.includes("longbow"))alerts.push("A longbow needs two hands. Doff the shield before using it.");
 return {prof,maxHP,ac,speed,attacks,mods,critMin,weaponList:characterWeapons,alerts,
  trainedAthletics:mods.STR+prof,initiative:mods.DEX,
  mode:s.subclass==="assassin"?"HOMEBREW":"RAW"};
}
function seededRoll(s,weapon,random=Math.random){
 const d=derive(s),w=d.weaponList.find(x=>x.id===weapon);
 if(!w||w.blocked)return {error:w?.blocked?"Longbow needs two hands. Doff your shield first.":"Add a weapon to your build."};
 const adv=s.subclass==="assassin"&&s.level>=3&&!!s.foeNotActed;
 const hitIfSurprised=s.subclass==="assassin"&&s.level>=3&&!!s.foeSurprised;
 const rows=[];
 for(let i=0;i<d.attacks;i++){
  const first=Math.floor(random()*20)+1,second=adv?Math.floor(random()*20)+1:null;
  const natural=adv?Math.max(first,second):first;
  const crit=natural>=d.critMin;
  const rolls=crit?2:1;
  const damageDie=Array.from({length:rolls},()=>Math.floor(random()*8)+1);
  const damage=damageDie.reduce((a,b)=>a+b,0)+w.modifier;
  rows.push({natural,second,attack:natural+w.attack,damage,crit,rolls,damageDie});
 }
 const note=hitIfSurprised?
  "Assassin homebrew: if the DM confirms a hit against a surprised creature, the hit is critical. This preview does not assume the target was hit.":
  "These are attack rolls and potential damage, not confirmed hits. The DM checks target AC.";
 return {type:"weapon",name:w.label,rows,note,adv,critMin:d.critMin,homebrew:hitIfSurprised};
}
root.CharacterWorkshopEngine=Object.freeze({fresh,derive,seededRoll,mod,sign,clamp,WEAPONS,START_SCORES});
if(typeof document==="undefined")return;
const $=id=>document.getElementById(id);
const pick=(kind,id)=>{
 const d=derive(state);
 if(kind==="class"){state.classId="fighter";}
 else if(kind==="subclass"){
  if(state.subclass===id)state.subclass=null;
  else state.subclass=id;
 }else if(kind==="weapon"){
  if(state.weapons.includes(id))state.weapons=state.weapons.filter(x=>x!==id);
  else state.weapons.push(id);
 }else if(kind==="shield")state.shield=!state.shield;
 state.result=null;
 render();
};
const eventFor={class:"classDrop",subclass:"subclassDrop",weapon:"equipmentDrop",shield:"equipmentDrop"};
function cardScore(key,value){
 const cell=document.createElement("div");cell.className="ability-tile";
 const head=document.createElement("div");head.className="ability-top";
 const label=document.createElement("strong");label.textContent=key;
 const bonus=document.createElement("span");bonus.id="bonus"+key;bonus.textContent=sign(mod(value));
 head.append(label,bonus);
 const edit=document.createElement("div");edit.className="ability-edit";
 const decrement=document.createElement("button");decrement.type="button";decrement.textContent="−";decrement.setAttribute("aria-label","Decrease "+key);
 const input=document.createElement("input");input.id="score"+key;input.type="number";input.min="1";input.max="30";input.value=value;input.setAttribute("aria-label",key+" ability score");
 const increment=document.createElement("button");increment.type="button";increment.textContent="+";increment.setAttribute("aria-label","Increase "+key);
 function change(next){state.scores[key]=clamp(next,1,30);state.result=null;render();}
 decrement.addEventListener("click",()=>change(state.scores[key]-1));
 increment.addEventListener("click",()=>change(state.scores[key]+1));
 input.addEventListener("change",()=>change(input.value));
 edit.append(decrement,input,increment);cell.append(head,edit);
 return cell;
}
function setResult(result){
 state.result=result;
 renderResult();
}
function rollWeapon(id){
 const result=seededRoll(state,id);
 if(result.error){
  setResult({type:"notice",name:"Equipment check",note:result.error});
  return;
 }
 setResult(result);
}
function restoreWind(){
 if(state.secondWindUsed){setResult({type:"notice",name:"Second Wind",note:"Already used. Take a short or long rest to regain this feature."});return;}
 const d=derive(state),heal=Math.floor(Math.random()*10)+1+d.prof*0+state.level;
 const current=Math.min(d.maxHP,state.currentHP==null?d.maxHP:state.currentHP);
 state.currentHP=Math.min(d.maxHP,current+heal);state.secondWindUsed=true;
 setResult({type:"heal",name:"Second Wind",heal,from:current,to:state.currentHP,note:"Bonus action, once per short/long rest (2014)."});
 render();
}
function surge(){
 if(state.level<2){setResult({type:"notice",name:"Action Surge",note:"Fighter gets Action Surge at level 2."});return;}
 if(state.surgeUsed){setResult({type:"notice",name:"Action Surge",note:"Action Surge is expended. Short or long rest restores it."});return;}
 state.surgeUsed=true;setResult({type:"feature",name:"Action Surge",note:"You gain one additional action this turn. Choose another action to use it; attacks are not silently rolled."});
 render();
}
function renderResult(){
 const r=state.result,title=$("resultTitle"),numbers=$("resultNumbers"),note=$("resultNote");
 const ov=$("overlayNumbers");numbers.replaceChildren();ov.replaceChildren();
 title.textContent=r?.name||"Ready to play";
 note.textContent=r?.note||"Press a weapon to roll your Attack action.";
 const cells=[];
 if(r?.type==="weapon")r.rows.forEach((roll,i)=>{
  cells.push({label:"ATTACK "+(i+1),value:roll.attack});
  cells.push({label:"DAMAGE "+(i+1),value:roll.damage,tip:roll.crit?"CRITICAL":r.adv?"ADV":"POTENTIAL"});
 });
 else if(r?.type==="heal"){cells.push({label:"HEALED",value:r.heal});cells.push({label:"CURRENT HP",value:r.to});}
 else if(r?.type==="feature"){cells.push({label:"EXTRA ACTION",value:"+1"});}
 else if(r?.type==="notice"){cells.push({label:"CHECK",value:"!"});}
 else cells.push({label:"READY",value:"⚔"});
 for(const c of cells){
  const make=()=>{
   const el=document.createElement("div");el.className="result-cell";
   const small=document.createElement("small");small.textContent=c.label;
   const strong=document.createElement("strong");strong.textContent=c.value;
   el.append(small,strong);
   if(c.tip){const x=document.createElement("em");x.textContent=c.tip;el.append(x);}
   return el;
  };
  numbers.append(make());ov.append(make());
 }
 $("overlayActor").textContent=state.name||"Adventurer";
 $("overlayAction").textContent=r?.name||"READY FOR COMBAT";
 $("overlayNote").textContent=r?.note||"Press a weapon action on the card";
}
function render(){
 const d=derive(state);
 $("characterName").value=state.name;
 $("levelSelect").value=String(state.level);
 $("className").textContent="Fighter";$("classMeta").textContent="2014 martial class · d10 Hit Die";
 $("subclassName").textContent=state.subclass==="champion"?"Champion":state.subclass==="assassin"?"Assassin":"Choose an archetype";
 $("subclassMeta").textContent=state.subclass==="champion"?"Fighter subclass · 2014 RAW":
 state.subclass==="assassin"?"Rogue subclass · HOMEBREW":"Drop or tap a subclass";
 $("classDrop").classList.toggle("selected",true);
 $("subclassDrop").classList.toggle("selected",!!state.subclass);
 $("rulesNotice").className="rules-notice"+(d.alerts.length?" has-warning":"");
 $("rulesNotice").textContent=d.alerts.length?d.alerts.join("  "):
 "2014 Fighter rules are applied to the calculations below. Choose Champion for a standard Fighter subclass.";
 for(const k of ABILITIES){
  const input=$("score"+k);if(input&&document.activeElement!==input)input.value=state.scores[k];
  $("bonus"+k).textContent=sign(d.mods[k]);
 }
 const chips=$("gearChips");chips.replaceChildren();
 for(const id of state.weapons.concat(state.shield?["shield"]:[])){
  const chip=document.createElement("button");chip.type="button";chip.className="gear-chip";
  chip.textContent=(id==="shield"?"Shield":WEAPONS[id]?.label||id)+" ×";
  chip.title="Remove "+id;chip.addEventListener("click",()=>pick(id==="shield"?"shield":"weapon",id));
  chips.append(chip);
 }
 const held=state.weapons;
 document.querySelectorAll(".block-tile").forEach(button=>{
  const {kind,id}=button.dataset;const sel=kind==="class"?true:
   kind==="subclass"?state.subclass===id:kind==="shield"?state.shield:held.includes(id);
  button.classList.toggle("chosen",sel);
  button.setAttribute("aria-pressed",String(sel));
 });
 $("armorSelect").value=state.armor;
 $("cardMode").textContent=d.mode;
 $("cardMode").classList.toggle("homebrew",d.mode==="HOMEBREW");
 $("cardName").textContent=state.name.trim()||"Your character";
 $("cardClass").textContent="Level "+state.level+" Fighter"+(state.subclass?" · "+(state.subclass==="champion"?"Champion":"Assassin (homebrew)"):"");
 $("cardHp").textContent=String(d.maxHP);
 $("cardAc").textContent=String(d.ac);
 $("cardMove").textContent=d.speed+" ft";
 $("cardProf").textContent=sign(d.prof);
 $("cardInit").textContent=sign(d.initiative);
 $("cardExtra").textContent=String(d.attacks);
 const root=$("actionButtons");root.replaceChildren();
 for(const w of d.weaponList){
  const b=document.createElement("button");b.type="button";b.className="play-attack";
  const icon=document.createElement("span");icon.className="attack-icon";
  icon.textContent=w.id==="longbow"?"🏹":"⚔";
  const content=document.createElement("span");content.className="attack-content";
  const name=document.createElement("strong");name.textContent=w.label;
  const subtitle=document.createElement("small");
  subtitle.textContent=w.blocked?"Doff shield to use":w.bonus+" to hit · "+w.damageLabel;
  content.append(name,subtitle);
  const arrow=document.createElement("span");arrow.className="attack-go";arrow.textContent="ROLL";
  b.append(icon,content,arrow);
  b.disabled=w.blocked;b.title=w.blocked?"Two hands required: doff shield":w.label+" · roll Attack action";
  b.addEventListener("click",()=>rollWeapon(w.id));root.append(b);
 }
 if(!d.weaponList.length){
  const hint=document.createElement("p");hint.className="empty-actions";
  hint.textContent="Add a weapon from the left to create a one-touch attack button.";root.append(hint);
 }
 const features=$("featureRow");features.replaceChildren();
 const wind=document.createElement("button");wind.type="button";wind.className="feature-button";
 wind.textContent="Second Wind"+(state.secondWindUsed?" · used":" · 1d10+"+state.level);
 wind.disabled=state.secondWindUsed;wind.addEventListener("click",restoreWind);features.append(wind);
 if(state.level>=2){
  const surgeButton=document.createElement("button");surgeButton.type="button";surgeButton.className="feature-button";
  surgeButton.textContent="Action Surge"+(state.surgeUsed?" · used":" · +1 action");
  surgeButton.disabled=state.surgeUsed;surgeButton.addEventListener("click",surge);features.append(surgeButton);
 }
 if(state.subclass==="champion"&&state.level>=3){
  const tag=document.createElement("span");tag.className="trait-tag";tag.textContent="Critical "+d.critMin+"–20";
  features.append(tag);
 }
 $("assassinOptions").hidden=state.subclass!=="assassin"||state.level<3;
 $("foeNotActed").checked=state.foeNotActed;$("foeSurprised").checked=state.foeSurprised;
 renderResult();
}
function initialize(){
 for(let lv=1;lv<=20;lv++){const opt=document.createElement("option");opt.value=lv;opt.textContent=lv;$("levelSelect").append(opt);}
 for(const k of ABILITIES)$("abilityGrid").append(cardScore(k,state.scores[k]));
 document.querySelectorAll(".block-tile").forEach(btn=>{
  btn.addEventListener("click",()=>pick(btn.dataset.kind,btn.dataset.id));
  btn.addEventListener("dragstart",e=>{
   e.dataTransfer.setData("text/plain",btn.dataset.kind+":"+btn.dataset.id);
   e.dataTransfer.effectAllowed="copy";
  });
 });
 document.querySelectorAll("[data-accept]").forEach(zone=>{
  zone.addEventListener("dragover",e=>{
   const parts=e.dataTransfer.types;
   if(parts.includes?.("text/plain")){e.preventDefault();e.dataTransfer.dropEffect="copy";zone.classList.add("drag-over");}
  });
  zone.addEventListener("dragleave",()=>zone.classList.remove("drag-over"));
  zone.addEventListener("drop",e=>{
   e.preventDefault();zone.classList.remove("drag-over");
   const raw=e.dataTransfer.getData("text/plain"),[kind,id]=raw.split(":");
   if(!zone.dataset.accept.split(",").includes(kind))return;
   const button=document.querySelector('[data-kind="'+kind+'"][data-id="'+id+'"]');
   if(button)pick(kind,id);
  });
  zone.addEventListener("click",e=>{
   if(e.target!==zone&&e.target.closest?.(".gear-chip"))return;
   const kind=zone.dataset.accept.split(",")[0];
   if(kind==="class")pick("class","fighter");
   else if(kind==="subclass")pick("subclass","champion");
  });
  zone.addEventListener("keydown",e=>{
   if(e.key==="Enter"||e.key===" "){e.preventDefault();const kind=zone.dataset.accept.split(",")[0];
    if(kind==="class")pick("class","fighter");else if(kind==="subclass")pick("subclass","champion");
   }
  });
 });
 $("clearSubclass").addEventListener("click",()=>{state.subclass=null;state.result=null;render();});
 $("resetGear").addEventListener("click",()=>{state.weapons=["longsword"];state.shield=true;state.armor="chain";state.result=null;render();});
 $("resetScores").addEventListener("click",()=>{state.scores={...START_SCORES};state.result=null;render();});
 $("resetAll").addEventListener("click",()=>{state=fresh();render();});
 $("characterName").addEventListener("input",e=>{state.name=e.target.value; $("cardName").textContent=state.name.trim()||"Your character"; $("overlayActor").textContent=state.name||"Adventurer";});
 $("levelSelect").addEventListener("change",e=>{state.level=clamp(e.target.value,1,20);state.secondWindUsed=false;state.surgeUsed=false;state.currentHP=null;state.result=null;render();});
 $("armorSelect").addEventListener("change",e=>{state.armor=e.target.value;state.result=null;render();});
 $("foeNotActed").addEventListener("change",e=>{state.foeNotActed=e.target.checked;state.result=null;render();});
 $("foeSurprised").addEventListener("change",e=>{state.foeSurprised=e.target.checked;state.result=null;render();});
 $("restButton").addEventListener("click",()=>{state.secondWindUsed=false;state.surgeUsed=false;state.result={type:"notice",name:"Short Rest",note:"Second Wind and Action Surge restored. HP does not automatically reset after a short rest."};render();});
 $("tablePreview").addEventListener("click",()=>{$("tableOverlay").hidden=false;$("closeTable").focus();renderResult();});
 $("closeTable").addEventListener("click",()=>{$("tableOverlay").hidden=true;$("tablePreview").focus();});
 $("tableOverlay").addEventListener("click",e=>{if(e.target===$("tableOverlay"))$("closeTable").click();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("tableOverlay").hidden)$("closeTable").click();});
 render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize);
else initialize();
})(typeof globalThis!=="undefined"?globalThis:this);
