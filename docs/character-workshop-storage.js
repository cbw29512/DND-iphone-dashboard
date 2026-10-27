/* Safe local-only workshop persistence. No network, credentials or remote writes. */
(function(root){
"use strict";
const KEY="character_workshop_build_v1",VERSION=1;
const CLASSES=new Set(["barbarian","bard","cleric","druid","fighter","monk","paladin","ranger","rogue","sorcerer","warlock","wizard"]);
const WEAPONS=new Set(["longsword","rapier","longbow","greataxe","greatsword","shortsword","scimitar","dagger","quarterstaff","mace","handaxe","shortbow","lightcrossbow"]);
const FEATURES=new Set(["rage","inspiration","channel","wildshape","ki","layhands","paladinchannel","sorcery","pactslot"]);
const ARMORS=new Set(["chain","scale","leather","none"]);
const clamp=(n,min,max,otherwise)=>typeof n==="number"&&Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):otherwise;
function normalize(data,template,catalog){
 const result={...template,scores:{...template.scores},featureSpent:{}};
 if(!data||typeof data!=="object"||Array.isArray(data))return result;
 if(typeof data.name==="string")result.name=data.name.slice(0,52).replace(/[\x00-\x1f]/g," ").trim();
 if(typeof data.classId==="string"&&CLASSES.has(data.classId))result.classId=data.classId;
 if(typeof data.subclass==="string"&&catalog?.bySubclass?.(data.subclass))result.subclass=data.subclass;
 if(data.subclass===null)result.subclass=null;
 result.level=clamp(data.level,1,20,result.level);
 for(const key of Object.keys(template.scores)){
  result.scores[key]=clamp(data.scores?.[key],1,30,template.scores[key]);
 }
 const rawWeapons=Array.isArray(data.weapons)?data.weapons:[];
 result.weapons=[...new Set(rawWeapons.filter(s=>typeof s==="string"&&WEAPONS.has(s)))].slice(0,13);
 if(typeof data.shield==="boolean")result.shield=data.shield;
 if(typeof data.armor==="string"&&ARMORS.has(data.armor))result.armor=data.armor;
 for(const key of ["foeNotActed","foeSurprised","secondWindUsed","surgeUsed","rageActive"])
  result[key]=data[key]===true;
 result.currentHP=clamp(data.currentHP,0,9999,null);
 const spent=data.featureSpent;
 if(spent&&typeof spent==="object"&&!Array.isArray(spent)){
  for(const [key,v] of Object.entries(spent))if(FEATURES.has(key))result.featureSpent[key]=clamp(v,0,1000,0);
 }
 result.result=null;
 return result;
}
function load(storage,template,catalog){
 try{
  const raw=storage?.getItem?.(KEY);
  if(!raw)return {...template,scores:{...template.scores},featureSpent:{}};
  const packet=JSON.parse(raw);
  if(packet.version!==VERSION||!packet.state)return normalize(null,template,catalog);
  return normalize(packet.state,template,catalog);
 }catch(error){return normalize(null,template,catalog);}
}
function save(storage,state,template,catalog){
 try{
  if(!storage||typeof storage.setItem!=="function")throw Error("No local storage");
  const clean=normalize(state,template,catalog);
  storage.setItem(KEY,JSON.stringify({version:VERSION,state:clean}));
  return {saved:true};
 }catch(error){return {saved:false,message:"Local browser storage unavailable. Your changes may not survive a refresh."};}
}
root.CharacterWorkshopStorage=Object.freeze({KEY,normalize,load,save});
})(typeof globalThis!=="undefined"?globalThis:this);
