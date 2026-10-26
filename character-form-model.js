/* Character creation/edit model. No combat resources are spent by editor actions. */
(function(root){
"use strict";
const ABILITIES=["STR","DEX","CON","INT","WIS","CHA"];
const SKILLS=["Acrobatics","Animal Handling","Arcana","Athletics","Deception","History",
 "Insight","Intimidation","Investigation","Medicine","Nature","Perception","Performance",
 "Persuasion","Religion","Sleight of Hand","Stealth","Survival"];
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
function blank(){
 const ability={},saves={},skills={};
 for(const a of ABILITIES){ability[a]={score:10,mod:0};saves[a]=0;}
 for(const s of SKILLS)skills[s]=0;
 return {
  id:"manual-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9),
  name:"",classes:"",level:1,rules:"2014",species:"",background:"",
  portrait:"",speed:null,ac:10,hp:1,hpMax:1,initiative:0,
  ability,saves,skills,weapons:[],spells:[],features:[],equipment:[],
  slots:{},remaining:{},spellAttack:0,spellDC:10,life:false,blessedHealer:false,
  turn:1,actionUsed:false,bonusUsed:false,reactionUsed:false,slotUsed:false,
  notes:"",concentration:"",concentrationSlot:0,castChoices:{},
  result:{name:"READY",total:"CHOOSE AN ACTION",detail:"New character card."},log:[]
 };
}
function parsedSpeed(v){
 if(v===null||v===undefined||String(v).trim()==="")return null;
 const speed=Number(String(v).match(/\d+/)?.[0]);
 return Number.isInteger(speed)&&speed>=0&&speed<=500?speed:null;
}
function safePortrait(src){
 return typeof src==="string"&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)
  &&src.length<=450000?src:"";
}
function apply(base,values){
 if(!values||!String(values.name||"").trim())throw Error("Character name is required.");
 const next={...base};
 next.name=String(values.name).trim().slice(0,90);
 next.classes=String(values.classes||"Adventurer").trim().slice(0,100);
 next.species=String(values.species||"").trim().slice(0,90);
 next.background=String(values.background||"").trim().slice(0,90);
 next.rules=["2014","2024","unspecified"].includes(values.rules)?values.rules:"unspecified";
 next.level=clamp(values.level,1,20);
 next.ac=clamp(values.ac,0,50);
 const hpMax=clamp(values.hpMax,1,9999);
 next.hpMax=hpMax;
 next.hp=values.fresh?hpMax:Math.min(hpMax,Math.max(0,Number(base.hp)||0)); // Editing never heals.
 next.speed=parsedSpeed(values.speed);
 next.initiative=clamp(values.initiative,-30,30);
 next.spellAttack=clamp(values.spellAttack,-30,30);
 next.spellDC=clamp(values.spellDC,0,40);
 next.portrait=safePortrait(values.portrait);
 next.ability={...base.ability};next.saves={...base.saves};
 for(const key of ABILITIES){
  const old=base.ability?.[key]||{score:10,mod:0};
  const score=clamp(values.ability?.[key]?.score??old.score,1,30);
  next.ability[key]={...old,score,mod:Math.floor((score-10)/2)};
  next.saves[key]=clamp(values.saves?.[key]??base.saves?.[key]??0,-30,40);
 }
 next.slots={};next.remaining={};
 for(let level=1;level<=9;level++){
  const newMax=clamp(values.slots?.[level]??0,0,20);
  const oldMax=Number(base.slots?.[level]||0);
  const oldRemaining=Number(base.remaining?.[level]??oldMax);
  const spent=Math.max(0,oldMax-oldRemaining);
  if(newMax>0){
   next.slots[level]=newMax;
   next.remaining[level]=Math.max(0,newMax-spent);
  }
 }
 next.weapons=(values.weapons||[]).filter(w=>String(w.name||"").trim()).slice(0,24)
  .map(w=>({...w,name:String(w.name).trim().slice(0,90),
   bonus:clamp(w.bonus,-30,40),formula:String(w.formula||"").trim(),
   damage:String(w.damage||w.formula||"").trim(),category:w.category==="ranged"?"ranged":"melee"}));
 next.spells=(values.spells||[]).filter(sp=>String(sp.name||"").trim()).slice(0,150)
  .map(sp=>({...sp,name:String(sp.name).trim().slice(0,100),
   level:clamp(sp.level,0,9),prepared:Number(sp.level)===0||Boolean(sp.prepared)}))
  .sort((a,b)=>a.level-b.level||a.name.localeCompare(b.name));
 return next;
}
root.CharacterFormModel=Object.freeze({blank,apply,parsedSpeed,safePortrait,ABILITIES,SKILLS});
})(typeof globalThis!=="undefined"?globalThis:this);
