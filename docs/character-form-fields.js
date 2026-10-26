/* Edit the character in the same order and shape as its playable card. */
(function(root){
"use strict";
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function field(label,value,type="text",options=[]){
 const wrap=el("label","edit-field"),name=el("span","",label),node=el(type==="choice"?"select":"input");
 if(type==="choice"){
  for(const [value,text] of options){const opt=el("option","",text);opt.value=String(value);node.add(opt);}
  const wanted=String(value??"");
  node.value=Array.from(node.options).some(o=>o.value===wanted)?wanted:node.options[0]?.value||"";
 }else{node.type=type;node.value=String(value??"");}
 wrap.append(name,node);return {wrap,node};
}
function add(parent,key,label,value,type="text",opts=[]){
 const result=field(label,value,type,opts);parent.append(result.wrap);return [key,result.node];
}
function section(parent,title,cls=""){
 const sec=el("section","edit-section "+cls);
 sec.append(el("h3","section",title));parent.append(sec);return sec;
}
function inputs(parent,items){
 const map={};for(const item of items){const [k,node]=add(parent,...item);map[k]=node;}return map;
}
function actionList(parent,title,source,create,render,addLabel){
 const body=el("section","quick-section edit-action-section"),head=el("h3","",title);
 const rows=el("div","edit-action-rows"),button=el("button","edit-add","+ "+addLabel);
 button.type="button";body.append(head,rows,button);parent.append(body);
 const list=[];
 function append(record={}){
  const entry=render(rows,record);list.push(entry);
  entry.remove.addEventListener("click",()=>{entry.row.remove();list.splice(list.indexOf(entry),1);});
 }
 for(const item of source)append(item);
 button.addEventListener("click",()=>append(create()));
 return ()=>list.map(item=>item.read());
}
function weaponRow(root,record){
 const row=el("div","weapon-card edit-action-row edit-weapon");
 const name=field("Weapon",record.name||""),bonus=field("Hit",record.bonus??0,"number");
 const damage=field("Damage",record.formula||"");
 const remove=el("button","edit-remove","×");remove.type="button";remove.title="Remove weapon";
 row.append(name.wrap,bonus.wrap,damage.wrap,remove);root.append(row);
 return {row,remove,read:()=>({
  ...record,name:name.node.value,bonus:bonus.node.value,formula:damage.node.value,
  damage:damage.node.value
 })};
}
function spellRow(root,record,level,rules){
 const row=el("div","spell-card edit-action-row edit-spell");
 const top=el("div","edit-spell-top"),name=field(level===0?"Cantrip":"Spell",record.name||"");
 const remove=el("button","edit-remove","×");remove.type="button";remove.title="Remove spell";
 top.append(name.wrap);
 let prepared=null;
 if(level>0){
  const prep=el("label","edit-prepared"),cb=el("input");cb.type="checkbox";
  cb.checked=record.prepared!==false;prepared=cb;
  prep.append(cb,el("span","","Ready"));top.append(prep);
 }
 top.append(remove);row.append(top);
 const opts=el("details","edit-effect");
 opts.append(el("summary","","Dice, save & effect"));
 const extra=el("div","edit-effect-grid");
 const rule=CharacterSpellLogic.profile(record,rules);
 const attack=CharacterSpellLogic.needsAttack(record,rule);
 const save=CharacterSpellLogic.saveAbility(record,rule);
 const roll=record.custom?.attack||attack?"ATTACK":save||"";
 const settings=inputs(extra,[
  ["dice","Dice (if custom)",record.custom?.dice||""],
  ["type","Result",record.custom?.type||rule?.type||"damage","choice",
   [["damage","Damage"],["heal","Healing"],["effect","Other"]]],
  ["roll","Roll type",roll,"choice",
   [["","Effect only"],["ATTACK","Spell attack"],...CharacterFormModel.ABILITIES.map(a=>[a,a+" save"])]]
 ]);
 opts.append(extra);row.append(opts);root.append(row);
 return {row,remove,read:()=>{
  const next={...record,name:name.node.value,level,prepared:level===0||prepared.checked};
  const dice=settings.dice.value.trim();
  if(dice){
   next.custom={...record.custom,dice,type:settings.type.value,
    per:Number(record.custom?.per)||0,targets:Number(record.custom?.targets)||1,
    attack:settings.roll.value==="ATTACK"};
  }else if(settings.roll.value==="ATTACK"){
   next.custom={type:rule?.type||"damage",attack:true};
  }else delete next.custom;
  next.save=settings.roll.value==="ATTACK"?"":settings.roll.value;
  return next;
 }};
}
function build(rootEl,card){
 rootEl.replaceChildren();
 const identity=document.getElementById("editorIdentity");
 const hero=document.getElementById("editorHeroStats");
 identity.replaceChildren();hero.replaceChildren();
 const basic=inputs(identity,[["name","Name",card.name],["classes","Class",card.classes]]);
 const stats=inputs(hero,[
  ["hpMax","Max HP",card.hpMax,"number"],
  ["ac","AC",card.ac,"number"],
  ["speed","Speed (ft)",card.speed??"","number"],
  ["initiative","Initiative",card.initiative,"number"],
  ["level","Level",card.level,"number"],
  ["spellDC","Spell DC",card.spellDC,"number"]
 ]);
 const actions=section(rootEl,"ATTACKS & AT-WILL CANTRIPS","edit-play-actions");
 const quick=el("div","quick-grid");actions.append(quick);
 const groups={};for(const type of ["melee","ranged"]){
  const weapons=(card.weapons||[]).filter(w=>CharacterCompactCard.typeOfWeapon(w)===type.toUpperCase());
  groups[type]=actionList(quick,type.toUpperCase(),weapons,()=>({category:type}),
   (container,item)=>{
    const entry=weaponRow(container,item);
    const read=entry.read;entry.read=()=>({...read(),category:type});
    return entry;
   },"weapon");
 }
 groups.cantrip=actionList(quick,"CANTRIPS",(card.spells||[]).filter(s=>s.level===0),
  ()=>({name:"",level:0,prepared:true}), (container,item)=>spellRow(container,item,0,card.rules),"cantrip");
 const levels=section(rootEl,"SPELLS","edit-spell-levels");
 const levelGroups=[];
 let highest=Math.max(3,...Object.keys(card.slots||{}).map(Number),
  ...(card.spells||[]).map(sp=>Number(sp.level)||0));
 highest=Math.min(9,highest);
 function addLevel(level){
  const wrap=el("section","edit-level-block"),heading=el("div","edit-level-heading");
  heading.append(el("h3","","LEVEL "+level));
  const slots=field("Slots (max)",card.slots?.[level]??0,"number");
  heading.append(slots.wrap);wrap.append(heading);
  const grid=el("div","spell-button-grid edit-spell-grid");
  wrap.append(grid);levels.append(wrap);
  const readSpells=actionList(grid,"Level "+level,(card.spells||[]).filter(sp=>sp.level===level),
   ()=>({name:"",level,prepared:true}),(container,item)=>spellRow(container,item,level,card.rules),"spell");
  levelGroups.push({level,slots:slots.node,readSpells});
 }
 for(let level=1;level<=highest;level++)addLevel(level);
 const addLevelBtn=el("button","edit-add","+ Add spell level");
 addLevelBtn.type="button";addLevelBtn.disabled=highest===9;
 addLevelBtn.addEventListener("click",()=>{
  if(highest>=9)return;highest++;addLevel(highest);addLevelBtn.disabled=highest===9;
  levels.append(addLevelBtn);
 });
 levels.append(addLevelBtn);
 const advanced=el("details","edit-advanced");
 advanced.append(el("summary","","More character details · abilities, saves & skills"));
 const advancedInner=el("div","edit-advanced-inner edit-grid");
 const info=inputs(advancedInner,[
  ["species","Species",card.species],
  ["background","Background",card.background],
  ["rules","Rules",card.rules,"choice",[["2014","2014"],["2024","2024"],["unspecified","Not specified"]]],
  ["spellAttack","Spell attack bonus",card.spellAttack,"number"]
 ]);
 const ability={},saves={},skills={};
 for(const key of CharacterFormModel.ABILITIES){
  ability[key]=field(key+" score",card.ability?.[key]?.score??10,"number");
  saves[key]=field(key+" save",card.saves?.[key]??0,"number");
  advancedInner.append(ability[key].wrap,saves[key].wrap);
 }
 for(const key of CharacterFormModel.SKILLS){
  skills[key]=field(key,card.skills?.[key]??0,"number");advancedInner.append(skills[key].wrap);
 }
 advanced.append(advancedInner);rootEl.append(advanced);
 function collect(){
  const result={...Object.fromEntries(Object.entries(basic).map(([k,n])=>[k,n.value])),
   ...Object.fromEntries(Object.entries(stats).map(([k,n])=>[k,n.value])),
   ...Object.fromEntries(Object.entries(info).map(([k,n])=>[k,n.value]))};
  result.ability={};result.saves={};result.skills={};
  for(const key of CharacterFormModel.ABILITIES){
   result.ability[key]={score:ability[key].node.value};
   result.saves[key]=saves[key].node.value;
  }
  for(const key of CharacterFormModel.SKILLS)result.skills[key]=skills[key].node.value;
  result.weapons=[...groups.melee(),...groups.ranged()];
  result.slots={};result.spells=groups.cantrip();
  for(const {level,slots,readSpells} of levelGroups){
   result.slots[level]=slots.value;result.spells.push(...readSpells());
  }
  return result;
 }
 return {collect,stats};
}
root.CharacterFormFields=Object.freeze({build});
})(typeof globalThis!=="undefined"?globalThis:this);
