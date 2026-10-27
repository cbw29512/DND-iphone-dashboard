/* 2014 PHB class-feature resource engine, isolated from presentation.
   A button spends a feature use, not a DM ruling. Never invent subclass effects. */
(function(root){
"use strict";
const rageUses=level=>level>=20?Infinity:level>=17?6:level>=12?5:level>=6?4:level>=3?3:2;
const rageBonus=level=>level>=16?4:level>=9?3:2;
const bardDie=level=>level>=15?12:level>=10?10:level>=5?8:6;
const channelUses=level=>level>=18?3:level>=6?2:1;
const maxFor=(classId,level,chaModifier,slotCount)=>{
 switch(classId){
 case "barbarian":return [{id:"rage",name:"Rage",max:rageUses(level),recovery:"long",available:level>=1}];
 case "bard":return [{id:"inspiration",name:"Bardic Inspiration",max:Math.max(1,chaModifier),recovery:level>=5?"short":"long",available:level>=1,die:"d"+bardDie(level)}];
 case "cleric":return [{id:"channel",name:"Channel Divinity",max:channelUses(level),recovery:"short",available:level>=2}];
 case "druid":return [{id:"wildshape",name:"Wild Shape",max:2,recovery:"short",available:level>=2}];
 case "monk":return [{id:"ki",name:"Ki",max:level,recovery:"short",available:level>=2}];
 case "paladin":return [{id:"layhands",name:"Lay on Hands",max:5*level,recovery:"long",available:level>=1,points:true},
  {id:"paladinchannel",name:"Channel Divinity",max:1,recovery:"short",available:level>=3}];
 case "sorcerer":return [{id:"sorcery",name:"Sorcery Points",max:level,recovery:"long",available:level>=2}];
 case "warlock":return [{id:"pactslot",name:"Pact Slot",max:slotCount,recovery:"short",available:level>=1}];
 default:return [];
 }
};
function descriptors(state,derived){
 const classId=state.classId,level=Number(state.level);
 const cha=derived.mods.CHA;
 const slotCount=Object.values(derived.slots||{}).reduce((sum,n)=>sum+Number(n),0);
 const spent=state.featureSpent||{};
 return maxFor(classId,level,cha,slotCount).filter(f=>f.available).map(f=>({
  ...f,remaining:f.max===Infinity?Infinity:Math.max(0,f.max-Math.max(0,Number(spent[f.id])||0)),
  active:f.id==="rage"&&!!state.rageActive
 }));
}
function activate(state,derived,id,random=Math.random,options={}){
 const feature=descriptors(state,derived).find(f=>f.id===id);
 if(!feature)return {ok:false,result:{type:"notice",name:"Feature unavailable",note:"Your class and level do not grant that feature."}};
 if(id==="rage"&&state.rageActive){
  state.rageActive=false;
  return {ok:true,result:{type:"feature",name:"Rage ended",note:"Your rage has ended. You can start another if you have a use left."}};
 }
 if(feature.remaining<=0)return {ok:false,result:{type:"notice",name:feature.name,note:"No uses remaining. Recover this feature after a "+(feature.recovery==="short"?"short or long":"long")+" rest."}};
 const requested=id==="layhands"?Math.max(1,Math.min(5,Math.floor(Number(options.points)||5))):1;
 const spentNow=Math.min(feature.remaining,requested);
 state.featureSpent??={};
 state.featureSpent[id]=(Number(state.featureSpent[id])||0)+spentNow;
 let note="",result={type:"feature",name:feature.name};
 if(id==="rage"){
  state.rageActive=true;
  note="Rage active · bonus action · +"+rageBonus(state.level)+" melee Strength damage, resistance to bludgeoning/piercing/slashing. Lasts up to 1 minute; player tracks early-end triggers. Cannot cast or concentrate while raging.";
 }else if(id==="inspiration"){
  note="Give a d"+bardDie(state.level)+" inspiration die to another creature that can hear you within 60 ft. Bonus action; recipient rolls it later. "+(feature.remaining-spentNow)+" uses left.";
 }else if(id==="channel"||id==="paladinchannel"){
  note="Choose a Channel Divinity option you actually have. Its effects and targets require DM resolution. Spell save DC "+(derived.spellDC??"—")+".";
 }else if(id==="wildshape"){
  note="Wild Shape use spent. Choose a legal beast and use its separate statistics; this workshop does not overwrite the character's HP, ability scores, or attacks.";
 }else if(id==="ki"){
  note="1 Ki point spent. Choose and resolve the actual Monk technique manually; no attack or effect was assumed.";
 }else if(id==="layhands"){
  result={type:"heal",name:"Lay on Hands · allocated",heal:spentNow,from:null,to:null};
  note="Allocated "+spentNow+" point"+(spentNow===1?"":"s")+" from your healing pool. Apply up to this much healing to the touched target (or use the pool for a supported cleansing effect). This does not automatically change your own HP.";
 }else if(id==="sorcery"){
  note="1 Sorcery Point spent. Choose a legal Metamagic or Font of Magic option manually; no conversion or spell casting was assumed.";
 }else if(id==="pactslot"){
  note="1 Pact Magic slot reserved at its current level. Select and resolve the actual Warlock spell manually. Remaining "+(feature.remaining-spentNow)+".";
 }
 result.note=note;return {ok:true,result};
}
function rest(state,derived,kind){
 if(kind!=="short"&&kind!=="long")throw Error("Rest must be short or long");
 state.featureSpent??={};
 for(const f of descriptors(state,derived)){
  if(kind==="long"||f.recovery==="short")state.featureSpent[f.id]=0;
 }
 if(kind==="long"||state.classId==="barbarian"&&kind==="short"){
  // Resting normally ends an active rage; ending it never refunds the spent use.
  state.rageActive=false;
 }
 return {type:"notice",name:kind==="short"?"Short Rest":"Long Rest",
  note:kind==="short"?"Short-rest resources recovered. Long-rest-only uses and current HP remain unchanged.":
  "Class resources recovered. This prototype does not automatically refill all health, Hit Dice or spellcasting resources."};
}
function sneakAttack(state,random=Math.random){
 if(state.classId!=="rogue")return {type:"notice",name:"Sneak Attack",note:"Only a Rogue receives this feature from its base class."};
 const n=Math.ceil(state.level/2),rolls=Array.from({length:n},()=>Math.floor(random()*6)+1);
 return {type:"feature",name:"Sneak Attack · conditional",roll:rolls.reduce((a,b)=>a+b,0),
  dice:n+"d6",note:"Extra damage rolled, not automatically applied. Once per turn, only after a qualifying hit with a finesse or ranged weapon and advantage or an eligible enemy of the target nearby (and no disadvantage). Confirm conditions with the DM."};
}
root.CharacterWorkshopFeatures=Object.freeze({rageUses,rageBonus,bardDie,channelUses,descriptors,activate,rest,sneakAttack});
})(typeof globalThis!=="undefined"?globalThis:this);
