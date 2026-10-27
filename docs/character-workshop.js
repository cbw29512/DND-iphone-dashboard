/* Character Forge workshop: isolated, interactive 2014 Fighter demonstration.
   Derived stats are computed from build state; no independent form totals. */
(function(root){
"use strict";
const CATALOG=root.CharacterWorkshopCatalog;
if(!CATALOG)throw Error("Character workshop class catalog failed to load.");
const ABILITIES=["STR","DEX","CON","INT","WIS","CHA"];
const WEAPONS={
 longsword:{label:"Longsword",damage:"1d8",stat:"STR",twoHanded:false,martial:true},
 rapier:{label:"Rapier",damage:"1d8",stat:"FINESSE",twoHanded:false,martial:true},
 longbow:{label:"Longbow",damage:"1d8",stat:"DEX",twoHanded:true,martial:true},
 greataxe:{label:"Greataxe",damage:"1d12",stat:"STR",twoHanded:true,martial:true},
 greatsword:{label:"Greatsword",damage:"2d6",stat:"STR",twoHanded:true,martial:true},
 shortsword:{label:"Shortsword",damage:"1d6",stat:"FINESSE",twoHanded:false,martial:true},
 scimitar:{label:"Scimitar",damage:"1d6",stat:"FINESSE",twoHanded:false,martial:true},
 dagger:{label:"Dagger",damage:"1d4",stat:"FINESSE",twoHanded:false,martial:false},
 quarterstaff:{label:"Quarterstaff",damage:"1d6",stat:"STR",twoHanded:false,martial:false},
 mace:{label:"Mace",damage:"1d6",stat:"STR",twoHanded:false,martial:false},
 handaxe:{label:"Handaxe",damage:"1d6",stat:"STR",twoHanded:false,martial:false},
 shortbow:{label:"Shortbow",damage:"1d6",stat:"DEX",twoHanded:true,martial:false},
 lightcrossbow:{label:"Light crossbow",damage:"1d8",stat:"DEX",twoHanded:true,martial:false}
};
const PROFICIENCIES={
 barbarian:"all",bard:["longsword","rapier","shortsword"],cleric:"simple",
 druid:["scimitar","dagger","quarterstaff","mace"],
 fighter:"all",monk:["shortsword"],paladin:"all",ranger:"all",
 rogue:["longsword","rapier","shortsword"],sorcerer:["dagger","quarterstaff","lightcrossbow"],
 warlock:"simple",wizard:["dagger","quarterstaff","lightcrossbow"]
};
const START_SCORES={STR:16,DEX:12,CON:14,INT:10,WIS:10,CHA:8};
const fresh=()=>({name:"Kael Voss",classId:"fighter",subclass:null,level:5,
 scores:{...START_SCORES},weapons:["longsword"],shield:true,armor:"chain",
 foeNotActed:false,foeSurprised:false,currentHP:null,secondWindUsed:false,surgeUsed:false,result:null});
let state=fresh();
const mod=n=>Math.floor((n-10)/2);
const sign=n=>(n>=0?"+":"")+n;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(n))?Math.trunc(Number(n)):lo));
const defaultArmor=c=>c.armor==="heavy"?"chain":c.armor==="medium"?(c.id==="druid"?"leather":"scale"):c.armor==="light"?"leather":"none";
const proficient=(classId,id)=>{
 const policy=PROFICIENCIES[classId],w=WEAPONS[id];
 return policy==="all"||!!(w&&!w.martial&&policy==="simple")||(Array.isArray(policy)&&(policy.includes(id)||(!w?.martial&&["bard","monk","rogue"].includes(classId))));
};
const spellStat=(c,sub)=>c.casting||(["eldritch-knight","arcane-trickster"].includes(sub)&&["fighter","rogue"].includes(c.id))?
 (sub==="eldritch-knight"||sub==="arcane-trickster"?"INT":c.primary):null;
function derive(s){
 const lv=clamp(s.level,1,20),c=CATALOG.byClass(s.classId),scores=s.scores||START_SCORES;
 const selected=CATALOG.bySubclass(s.subclass),homebrew=!!(selected&&selected.classId!==c.id);
 const activeSubclass=selected&&lv>=c.archetypeLevel?selected:null;
 const mods=Object.fromEntries(ABILITIES.map(k=>[k,mod(clamp(scores[k],1,30))]));
 const prof=Math.min(6,2+Math.floor((lv-1)/4));
 const average=Math.floor(c.die/2)+1;
 const draconicHP=c.id==="sorcerer"&&activeSubclass?.id==="draconic"?lv:0;
 const maxHP=Math.max(1,c.die+mods.CON)+(lv-1)*Math.max(1,average+mods.CON)+draconicHP;
 let baseAC=s.armor==="leather"?11+mods.DEX:s.armor==="scale"?14+Math.min(2,mods.DEX):s.armor==="chain"?16:10+mods.DEX;
 if(s.armor==="none"){
  if(c.id==="barbarian")baseAC=10+mods.DEX+mods.CON;
  if(c.id==="monk"&&!s.shield)baseAC=10+mods.DEX+mods.WIS;
  if(c.id==="sorcerer"&&activeSubclass?.id==="draconic")baseAC=13+mods.DEX;
 }
 const ac=baseAC+(s.shield?2:0);
 let speed=s.armor==="chain"&&scores.STR<13?20:30;
 if(c.id==="barbarian"&&lv>=5&&s.armor!=="chain")speed+=10;
 if(c.id==="monk"&&lv>=2&&s.armor==="none"&&!s.shield)speed+=lv>=18?30:lv>=14?25:lv>=10?20:lv>=6?15:10;
 const attacks=c.id==="fighter"?(lv>=20?4:lv>=11?3:lv>=5?2:1):
 ["barbarian","monk","paladin","ranger"].includes(c.id)&&lv>=5?2:
 c.id==="bard"&&activeSubclass?.id==="valor"&&lv>=6?2:1;
 const critMin=activeSubclass?.id==="champion"?(lv>=15?18:19):20;
 const characterWeapons=(s.weapons||[]).filter(k=>WEAPONS[k]).map(k=>{
  const w=WEAPONS[k],attackMod=w.stat==="FINESSE"?Math.max(mods.STR,mods.DEX):mods[w.stat];
  const profWeapon=proficient(c.id,k)||(c.id==="bard"&&activeSubclass?.id==="valor")||
   (c.id==="cleric"&&activeSubclass&&["tempest","war"].includes(activeSubclass.id));
  return {id:k,label:w.label,damage:w.damage,attack:attackMod+(profWeapon?prof:0),
   modifier:attackMod,bonus:sign(attackMod+(profWeapon?prof:0)),damageLabel:w.damage+sign(attackMod),
   ability:w.stat==="FINESSE"?(mods.DEX>mods.STR?"DEX":"STR"):w.stat,proficient:profWeapon,
   blocked:!!(w.twoHanded&&s.shield)};
 });
 const alerts=[];
 if(homebrew)alerts.push("HOMEBREW: "+selected.name+" belongs to "+CATALOG.byClass(selected.classId).name+", not "+c.name+". DM approval needed; gaining this subclass does not grant levels or base features of its original class.");
 if(selected&&lv<c.archetypeLevel)alerts.push(c.name+" gains its subclass at level "+c.archetypeLevel+"; "+selected.name+" features are inactive until then.");
 if(s.armor==="chain"&&scores.STR<13)alerts.push("Chain mail requires STR 13 to avoid a 10 ft speed penalty (subject to race/feature exceptions).");
 const armorRank={none:0,leather:1,scale:2,chain:3},limit={none:0,light:1,medium:2,heavy:3};
 const subclassHeavy=c.id==="cleric"&&activeSubclass&&["life","nature","tempest","war"].includes(activeSubclass.id);
 const subclassMedium=c.id==="bard"&&activeSubclass?.id==="valor";
 const allowedArmor=subclassHeavy?3:subclassMedium?2:(limit[c.armor]||0);
 if(armorRank[s.armor]>allowedArmor)alerts.push(c.name+" lacks proficiency in "+s.armor+" armor. RAW imposes penalties; that armor is not a recommended default.");
 if(s.shield&&!c.shield&&!(c.id==="bard"&&activeSubclass?.id==="valor"))alerts.push(c.name+" lacks shield proficiency. RAW penalties apply while using it.");
 if(c.id==="monk"&&(s.shield||s.armor!=="none"))alerts.push("Monk Unarmored Defense and Martial Arts require no armor and no shield; these features are not automated with this equipment.");
 if(s.armor==="scale"&&c.id==="druid")alerts.push("Druids normally do not wear metal armor; check equipment materials.");
 if(s.shield&&characterWeapons.some(w=>w.blocked))alerts.push("Two-handed weapons require both hands. Doff the shield first.");
 if(characterWeapons.some(w=>!w.proficient))alerts.push("A nonproficient weapon does not receive the proficiency bonus to its attack roll.");
 if(c.id==="druid"&&s.armor==="scale")alerts.push("Check the armor material: 2014 Druids do not wear metal armor.");
 const casting=spellStat(c,activeSubclass?.id);
 const slots=CATALOG.spellSlots(c.id,activeSubclass?.id,lv);
 const spellDC=casting?8+prof+mods[casting]:null;
 const spellAttack=casting?prof+mods[casting]:null;
 return {prof,maxHP,ac,speed,attacks,mods,critMin,weaponList:characterWeapons,alerts,
  trainedAthletics:mods.STR+prof,initiative:mods.DEX,mode:homebrew?"HOMEBREW":"RAW",
  classData:c,subclassData:selected,subclassActive:!!activeSubclass,
  spellDC,spellAttack,spellStat:casting,slots};
}
function seededRoll(s,weapon,random=Math.random){
 const d=derive(s),w=d.weaponList.find(x=>x.id===weapon);
 if(!w||w.blocked)return {error:w?.blocked?"A two-handed weapon cannot be used while holding a shield. Doff the shield first.":"Add a weapon to your build."};
 const adv=d.subclassActive&&s.subclass==="assassin"&&!!s.foeNotActed;
 const hitIfSurprised=d.subclassActive&&s.subclass==="assassin"&&!!s.foeSurprised;
 const rows=[];
 for(let i=0;i<d.attacks;i++){
  const first=Math.floor(random()*20)+1,second=adv?Math.floor(random()*20)+1:null;
  const natural=adv?Math.max(first,second):first;
  const crit=natural>=d.critMin;
  const match=/^(\d+)d(\d+)$/i.exec(w.damage);
  const sides=Number(match?.[2]||8),rolls=Number(match?.[1]||1)*(crit?2:1);
  const damageDie=Array.from({length:rolls},()=>Math.floor(random()*sides)+1);
  const damage=damageDie.reduce((a,b)=>a+b,0)+w.modifier;
  rows.push({natural,second,attack:natural+w.attack,damage,crit,rolls,damageDie});
 }
 const note=hitIfSurprised?
  "Assassin feature: if the DM confirms a hit against a surprised creature, that hit is critical. This preview does not assume the target was hit.":
  "These are attack rolls and potential damage, not confirmed hits. The DM checks target AC.";
 return {type:"weapon",name:w.label,rows,note,adv,critMin:d.critMin,homebrew:hitIfSurprised};
}
root.CharacterWorkshopEngine=Object.freeze({fresh,derive,seededRoll,mod,sign,clamp,WEAPONS,START_SCORES,proficient,defaultArmor});
if(typeof document==="undefined")return;
const $=id=>document.getElementById(id);
const pick=(kind,id)=>{
 if(kind==="class"){
  const cls=CATALOG.classes.find(c=>c.id===id);
  if(!cls)return;
  if(state.classId!==cls.id){
   state.classId=cls.id;state.subclass=null;
   state.weapons=[cls.defaultWeapon];state.shield=cls.shield&&cls.id!=="ranger";
   state.armor=defaultArmor(cls);state.secondWindUsed=false;state.surgeUsed=false;
   state.currentHP=null;state.foeNotActed=false;state.foeSurprised=false;
  }
 }else if(kind==="subclass"){
  const sub=CATALOG.bySubclass(id);
  if(!sub)return;
  if(!document.getElementById("showAllSubclasses").checked&&sub.classId!==state.classId)return;
  state.subclass=state.subclass===id?null:id;
 }else if(kind==="weapon"){
  if(!WEAPONS[id])return;
  if(state.weapons.includes(id))state.weapons=state.weapons.filter(x=>x!==id);
  else state.weapons.push(id);
 }else if(kind==="shield")state.shield=!state.shield;
 state.result=null;
 renderSubclassLibrary();
 render();
};
function bindTile(button){
 button.dataset.bound="true";
 button.addEventListener("click",()=>pick(button.dataset.kind,button.dataset.id));
 button.addEventListener("dragstart",e=>{
  e.dataTransfer.setData("text/plain",button.dataset.kind+":"+button.dataset.id);
  e.dataTransfer.effectAllowed="copy";
 });
}
function catalogTile(kind,id,icon,name,note){
 const b=document.createElement("button");b.type="button";b.draggable=true;
 b.className="block-tile"+(kind==="subclass"&&CATALOG.bySubclass(id)?.classId!==state.classId?" crossclass":"");
 b.dataset.kind=kind;b.dataset.id=id;
 const glyph=document.createElement("span");glyph.className="tile-icon";glyph.textContent=icon;
 const content=document.createElement("span");
 const title=document.createElement("b");title.textContent=name;
 const desc=document.createElement("small");desc.textContent=note;
 content.append(title,desc);
 const plus=document.createElement("span");plus.className="tile-add";plus.textContent="+";
 b.append(glyph,content,plus);bindTile(b);return b;
}
function buildClassLibrary(){
 const list=$("classLibrary");list.replaceChildren();
 for(const cls of CATALOG.classes)
  list.append(catalogTile("class",cls.id,cls.icon,cls.name,"d"+cls.die+" Hit Die · "+cls.description));
 $("classCount").textContent=CATALOG.classes.length+" classes";
}
function renderSubclassLibrary(){
 const list=$("subclassLibrary");if(!list)return;
 const all=$("showAllSubclasses").checked,term=$("subclassSearch").value.trim().toLowerCase();
 const subs=CATALOG.subclasses.filter(x=>(all||x.classId===state.classId)&&
  (!term||[x.name,CATALOG.byClass(x.classId).name].some(t=>t.toLowerCase().includes(term))));
 list.replaceChildren();
 for(const sub of subs){
  const own=sub.classId===state.classId;
  const c=CATALOG.byClass(sub.classId);
  const note=c.name+" · "+(own?"RAW":"HOMEBREW");
  const tile=catalogTile("subclass",sub.id,c.icon,sub.name,note);
  if(state.subclass===sub.id){tile.classList.add("chosen");tile.setAttribute("aria-pressed","true");}
  list.append(tile);
 }
 $("subclassCount").textContent=all?subs.length+" / "+CATALOG.subclasses.length+" subclasses":subs.length+" for "+CATALOG.byClass(state.classId).name;
 if(!subs.length){const empty=document.createElement("p");empty.className="empty-actions";empty.textContent="No matching subclasses. Clear the search to see options.";list.append(empty);}
}
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
 if(state.classId!=="fighter"){setResult({type:"notice",name:"Second Wind",note:"This is a Fighter feature."});return;}
 if(state.secondWindUsed){setResult({type:"notice",name:"Second Wind",note:"Already used. Take a short or long rest to regain this feature."});return;}
 const d=derive(state),heal=Math.floor(Math.random()*10)+1+d.prof*0+state.level;
 const current=Math.min(d.maxHP,state.currentHP==null?d.maxHP:state.currentHP);
 state.currentHP=Math.min(d.maxHP,current+heal);state.secondWindUsed=true;
 setResult({type:"heal",name:"Second Wind",heal,from:current,to:state.currentHP,note:"Bonus action, once per short/long rest (2014)."});
 render();
}
function surge(){
 if(state.classId!=="fighter"){setResult({type:"notice",name:"Action Surge",note:"This is a Fighter feature."});return;}
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
 const c=d.classData,sub=d.subclassData;
 $("className").textContent=c.name;
 $("classMeta").textContent="2014 "+c.description+" · d"+c.die+" Hit Die";
 $("subclassName").textContent=sub?.name||"Choose an archetype";
 $("subclassMeta").textContent=sub?(CATALOG.byClass(sub.classId).name+" · "+(d.mode==="HOMEBREW"?"Homebrew":"RAW")):
  "Unlocks at "+c.name+" level "+c.archetypeLevel;
 $("classDrop").classList.toggle("selected",true);
 $("subclassDrop").classList.toggle("selected",!!sub);
 $("rulesNotice").className="rules-notice"+(d.alerts.length?" has-warning":"");
 $("rulesNotice").textContent=d.alerts.length?d.alerts.join("  "):
  (c.name+" core stats use 2014 class rules. "+(sub?sub.name+" selected; specialized features need rules setup.":"Choose a subclass from the library."));
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
  const {kind,id}=button.dataset;const sel=kind==="class"?state.classId===id:
   kind==="subclass"?state.subclass===id:kind==="shield"?state.shield:held.includes(id);
  button.classList.toggle("chosen",sel);
  button.setAttribute("aria-pressed",String(sel));
 });
 $("armorSelect").value=state.armor;
 $("cardMode").textContent=d.mode;
 $("cardMode").classList.toggle("homebrew",d.mode==="HOMEBREW");
 $("cardName").textContent=state.name.trim()||"Your character";
 $("cardClass").textContent="Level "+state.level+" "+c.name+(sub?" · "+sub.name+(d.mode==="HOMEBREW"?" (homebrew)":""):"");
 $("cardIcon").textContent=c.icon;
 $("cardRole").textContent=c.description.toUpperCase();
 $("cardHp").textContent=String(d.maxHP);
 $("cardAc").textContent=String(d.ac);
 $("cardMove").textContent=d.speed+" ft";
 $("cardProf").textContent=sign(d.prof);
 $("cardInit").textContent=sign(d.initiative);
 $("cardExtra").textContent=String(d.attacks);
 $("spellStatus").hidden=!d.spellStat;
 $("cardSpellDC").textContent=d.spellDC??"—";
 const slotsEl=$("spellSummary");slotsEl.replaceChildren();slotsEl.hidden=!d.spellStat;
 if(d.spellStat){
  const heading=document.createElement("strong");heading.textContent="SPELLCASTING · "+d.spellStat+" · ATTACK "+sign(d.spellAttack)+" · DC "+d.spellDC;
  const summary=document.createElement("p");summary.textContent=Object.keys(d.slots).length?
   Object.entries(d.slots).map(([level,count])=>"L"+level+": "+count).join("  ·  "):"Spell slots not yet available at this level.";
  const caveat=document.createElement("small");caveat.textContent="Spell selection, casting, and most subclass effects are not automated yet.";
  slotsEl.append(heading,summary,caveat);
 }
 const root=$("actionButtons");root.replaceChildren();
 for(const w of d.weaponList){
  const b=document.createElement("button");b.type="button";b.className="play-attack";
  const icon=document.createElement("span");icon.className="attack-icon";
  icon.textContent=["longbow","shortbow","lightcrossbow"].includes(w.id)?"🏹":w.id==="quarterstaff"?"🪄":"⚔";
  const content=document.createElement("span");content.className="attack-content";
  const name=document.createElement("strong");name.textContent=w.label;
  const subtitle=document.createElement("small");
  subtitle.textContent=w.blocked?"Doff shield to use":w.bonus+" to hit · "+w.damageLabel+(w.proficient?"":" · NOT PROFICIENT");
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
 if(c.id==="fighter"){
  const wind=document.createElement("button");wind.type="button";wind.className="feature-button";
  wind.textContent="Second Wind"+(state.secondWindUsed?" · used":" · 1d10+"+state.level);
  wind.disabled=state.secondWindUsed;wind.addEventListener("click",restoreWind);features.append(wind);
  if(state.level>=2){
   const surgeButton=document.createElement("button");surgeButton.type="button";surgeButton.className="feature-button";
   surgeButton.textContent="Action Surge"+(state.surgeUsed?" · used":" · +1 action");
   surgeButton.disabled=state.surgeUsed;surgeButton.addEventListener("click",surge);features.append(surgeButton);
  }
 }
 if(state.subclass==="champion"&&d.subclassActive){
  const tag=document.createElement("span");tag.className="trait-tag";tag.textContent="Critical "+d.critMin+"–20";
  features.append(tag);
 }else if(sub&&d.subclassActive&&sub.id!=="assassin"){
  const tag=document.createElement("span");tag.className="trait-tag";tag.textContent=sub.name+" · features require setup";
  features.append(tag);
 }
 if(!["fighter"].includes(c.id)){
  const tag=document.createElement("span");tag.className="trait-tag";tag.textContent=c.name+" specialized class features · manual rules";
  features.append(tag);
 }
 $("assassinOptions").hidden=state.subclass!=="assassin"||!d.subclassActive;
 $("foeNotActed").checked=state.foeNotActed;$("foeSurprised").checked=state.foeSurprised;
 renderResult();
}
function initialize(){
 for(let lv=1;lv<=20;lv++){const opt=document.createElement("option");opt.value=lv;opt.textContent=lv;$("levelSelect").append(opt);}
 for(const k of ABILITIES)$("abilityGrid").append(cardScore(k,state.scores[k]));
 buildClassLibrary();
 const equipmentSection=document.querySelector('[data-kind="shield"][data-id="shield"]').closest(".library-group");
 for(const [id,w] of Object.entries(WEAPONS)){
  if(document.querySelector('[data-kind="weapon"][data-id="'+id+'"]'))continue;
  equipmentSection.append(catalogTile("weapon",id,w.twoHanded?"⚔️":"🗡️",w.label,w.damage+" · "+(w.stat==="DEX"?"Dex":w.stat==="STR"?"Str":"Finesse")));
 }
 $("showAllSubclasses").addEventListener("change",renderSubclassLibrary);
 $("subclassSearch").addEventListener("input",renderSubclassLibrary);
 renderSubclassLibrary();
 document.querySelectorAll(".block-tile").forEach(btn=>{
  if(btn.dataset.bound==="true")return;
  btn.dataset.bound="true";

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
   if(kind==="class")$("classLibrary").scrollIntoView({behavior:"smooth",block:"nearest"});
   else if(kind==="subclass")$("subclassLibrary").scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  zone.addEventListener("keydown",e=>{
   if(e.key==="Enter"||e.key===" "){e.preventDefault();const kind=zone.dataset.accept.split(",")[0];
    if(kind==="class")$("classLibrary").scrollIntoView({behavior:"smooth",block:"nearest"});else if(kind==="subclass")$("subclassLibrary").scrollIntoView({behavior:"smooth",block:"nearest"});
   }
  });
 });
 $("clearSubclass").addEventListener("click",()=>{state.subclass=null;state.result=null;render();});
 $("resetGear").addEventListener("click",()=>{const c=CATALOG.byClass(state.classId);state.weapons=[c.defaultWeapon];state.shield=c.shield&&c.id!=="ranger";state.armor=defaultArmor(c);state.result=null;render();});
 $("resetScores").addEventListener("click",()=>{state.scores={...START_SCORES};state.result=null;render();});
 $("resetAll").addEventListener("click",()=>{state=fresh();render();});
 $("characterName").addEventListener("input",e=>{state.name=e.target.value; $("cardName").textContent=state.name.trim()||"Your character"; $("overlayActor").textContent=state.name||"Adventurer";});
 $("levelSelect").addEventListener("change",e=>{state.level=clamp(e.target.value,1,20);state.secondWindUsed=false;state.surgeUsed=false;state.currentHP=null;state.result=null;render();});
 $("armorSelect").addEventListener("change",e=>{state.armor=e.target.value;state.result=null;render();});
 $("foeNotActed").addEventListener("change",e=>{state.foeNotActed=e.target.checked;state.result=null;render();});
 $("foeSurprised").addEventListener("change",e=>{state.foeSurprised=e.target.checked;state.result=null;render();});
 $("restButton").addEventListener("click",()=>{state.secondWindUsed=false;state.surgeUsed=false;state.result={type:"notice",name:"Short Rest",note:state.classId==="fighter"?"Second Wind and Action Surge restored. HP does not automatically reset after a short rest.":"Short rest recorded. Class-specific resources and Hit Dice are not automatically tracked in this prototype."};render();});
 $("tablePreview").addEventListener("click",()=>{$("tableOverlay").hidden=false;$("closeTable").focus();renderResult();});
 $("closeTable").addEventListener("click",()=>{$("tableOverlay").hidden=true;$("tablePreview").focus();});
 $("tableOverlay").addEventListener("click",e=>{if(e.target===$("tableOverlay"))$("closeTable").click();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("tableOverlay").hidden)$("closeTable").click();});
 render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initialize);
else initialize();
})(typeof globalThis!=="undefined"?globalThis:this);
