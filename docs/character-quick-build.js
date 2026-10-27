/* Quick Build: paste a short character outline; preserve the existing rules engine. */
(function(root){
"use strict";
const SAMPLE=[
 "Kael Voss",
 "Class: Warlock",
 "HP 44  AC 15  Move 30",
 "Mace of Disruption | +5 | 1d6+2",
 "Crossbow | +4 | 1d8+2",
 "Cantrips: Light, Fire Bolt",
 "Slots: 5/4/3/3",
 "Level 1: Magic Missile, Alarm",
 "Level 2: Alter Self",
 "Level 3: Fireball",
 "Level 4: Ice Storm"
].join("\n");
const MAX_LENGTH=8000;
const clean=s=>String(s??"").replace(/^[\s<\[(]+|[\s>\])]+$/g,"").trim();
const clipped=(s,n=90)=>clean(s).slice(0,n);
function parse(text){
 if(typeof text!=="string"||text.length>MAX_LENGTH)throw Error("Keep your outline under 8,000 characters.");
 const out={name:"",classes:"Adventurer",level:1,hpMax:null,ac:null,speed:null,
  initiative:0,spellDC:10,spellAttack:0,
  weapons:[],spells:[],slots:{},warnings:[]};
 let pending="weapons";
 const addNames=(items,level)=>{
  const names=items.split(/[,;]/).map(x=>clipped(x,100)).filter(Boolean);
  for(const name of names){
   if(level===0||level>0)out.spells.push({name,level,prepared:true,source:"quick-builder"});
   else out.weapons.push(parseWeapon(name));
  }
 };
 const parseWeapon=raw=>{
  const pieces=raw.split(/\s*\|\s*/);
  const name=clipped(pieces[0]);
  const bonusPart=pieces.slice(1).find(p=>/^[+-]\d{1,2}$/.test(p.trim()));
  const dicePart=pieces.slice(1).find(p=>/^\d{1,2}d(?:4|6|8|10|12|20)(?:[+-]\d{1,2})?$/i.test(p.trim().replace(/\s/g,"")));
  const category=/bow|crossbow|sling|blowgun|firearm|ranged/i.test(name)?"ranged":"melee";
  return {name,category,bonus:bonusPart?Number(bonusPart):0,
   formula:dicePart?dicePart.replace(/\s/g,""):"",
   damage:dicePart?dicePart.replace(/\s/g,""):"",
   needsSetup:!bonusPart||!dicePart};
 };
 const stat=(line,label)=>new RegExp("\\b"+label+"\\s*[:=]?\\s*([+\\-]?\\d{1,4})\\b","i").exec(line)?.[1];
 const lines=text.replace(/\r/g,"").split("\n").map(l=>l.trim()).filter(Boolean);
 for(let line of lines){
  if(/^#|^\/\//.test(line))continue;
  line=clean(line.replace(/^[•*]\s*/,""));
  if(!line)continue;
  const classMatch=/^(?:class|classes)\s*[:=]\s*(.+)$/i.exec(line);
  if(classMatch){out.classes=clipped(classMatch[1],100);continue;}
  const nameMatch=/^(?:name|character)\s*[:=]\s*(.+)$/i.exec(line);
  if(nameMatch){out.name=clipped(nameMatch[1]);continue;}
  const levelMatch=/^(?:character\s+level|level)\s*[:=]\s*(\d{1,2})$/i.exec(line);
  if(levelMatch){out.level=Math.max(1,Math.min(20,Number(levelMatch[1])));continue;}
  const slotsMatch=/^(?:spell\s*slots?|slots?|spells)\s*[:=]?\s*(\d{1,2}(?:\s*\/\s*\d{1,2}){0,8})$/i.exec(line);
  if(slotsMatch){
   slotsMatch[1].split("/").forEach((v,i)=>{const n=Math.min(20,Number(v.trim()));if(n)out.slots[i+1]=n;});
   continue;
  }
  const cantrips=/^(?:cantrips?|at\s*will)\s*[:=]\s*(.*)$/i.exec(line);
  if(cantrips){pending="cantrips";addNames(cantrips[1],0);continue;}
  const spellLevel=/^(?:spell\s*)?(?:level\s*|lvl\s*|l\s*)?([1-9])\s*[:.)\-]\s*(.*)$/i.exec(line);
  if(spellLevel){pending=Number(spellLevel[1]);addNames(spellLevel[2],pending);continue;}
  if(/^(?:weapons?|attacks?|melee|ranged)\s*:?\s*$/i.test(line)){pending="weapons";continue;}
  if(/^cantrips?\s*$/i.test(line)){pending="cantrips";continue;}
  if(/^(?:spells?|spell\s+list)\s*:?\s*$/i.test(line)){continue;}
  const hp=stat(line,"(?:HP|health|hit\\s*points?)");
  const ac=stat(line,"(?:AC|armor\\s*class)");
  const speed=stat(line,"(?:movement|move|speed)");
  const dc=stat(line,"(?:spell\\s*DC)");
  const atk=stat(line,"(?:spell\\s*attack)");
  const init=stat(line,"(?:initiative|init)");
  if(hp!==undefined||ac!==undefined||speed!==undefined||dc!==undefined||atk!==undefined||init!==undefined){
   if(hp!==undefined)out.hpMax=Math.max(1,Math.min(9999,Number(hp)));
   if(ac!==undefined)out.ac=Math.max(0,Math.min(50,Number(ac)));
   if(speed!==undefined)out.speed=Math.max(0,Math.min(500,Number(speed)));
   if(dc!==undefined)out.spellDC=Number(dc);
   if(atk!==undefined)out.spellAttack=Number(atk);
   if(init!==undefined)out.initiative=Number(init);
   continue;
  }
  const labelledWeapon=/^(?:weapon|attack|melee|ranged)\s*[:=]\s*(.+)$/i.exec(line);
  if(labelledWeapon){pending="weapons";out.weapons.push(parseWeapon(labelledWeapon[1]));continue;}
  if(!out.name){out.name=clipped(line);continue;}
  if(pending==="weapons"){
   for(const one of line.split(/\s*;\s*/)){if(one.trim())out.weapons.push(parseWeapon(one));}
  }else addNames(line,pending==="cantrips"?0:pending);
 }
 if(!out.name)throw Error("Start with your character's name.");
 if(out.weapons.length>24||out.spells.length>150)throw Error("This outline exceeds the card's action limit.");
 for(const sp of out.spells){
  if(sp.level>0&&!out.slots[sp.level])out.warnings.push("Set level "+sp.level+" spell slots to cast "+sp.name+".");
 }
 const incomplete=out.weapons.filter(w=>w.needsSetup).length;
 if(incomplete)out.warnings.unshift(incomplete+" weapon"+(incomplete>1?"s need":" needs")+" an attack bonus and/or damage dice for complete rolls. Add them on the editable card.");
 return out;
}
function build(text){
 const data=parse(text),blank=CharacterFormModel.blank();
 const values={
  name:data.name,classes:data.classes,level:data.level,rules:"unspecified",
  hpMax:data.hpMax??blank.hpMax,ac:data.ac??blank.ac,
  speed:data.speed,initiative:data.initiative,spellDC:data.spellDC,spellAttack:data.spellAttack,
  portrait:"",species:"",background:"",ability:blank.ability,saves:blank.saves,skills:blank.skills,
  weapons:data.weapons,spells:data.spells,slots:data.slots,fresh:true
 };
 return {card:CharacterFormModel.apply(blank,values),warnings:data.warnings};
}
function initialize(openEditor){
 const $=id=>document.getElementById(id),input=$("quickText"),status=$("quickStatus");
 function summarize(){
  if(!input.value.trim()){status.textContent="Paste a character outline or choose Use Example.";return;}
  try{
   const p=parse(input.value);
   status.textContent=p.name+" · "+p.weapons.length+" weapons · "+
    p.spells.filter(s=>s.level===0).length+" cantrips · "+
    p.spells.filter(s=>s.level>0).length+" spells. "+
    (p.warnings.length?p.warnings[0]:"Ready to create.");
  }catch(e){status.textContent=e.message;}
 }
 input.addEventListener("input",summarize);
 $("quickExample").addEventListener("click",()=>{input.value=SAMPLE;summarize();});
 $("quickBuild").addEventListener("click",()=>{
  try{
   const {card,warnings}=build(input.value);
   openEditor(card);
   $("cardEditMessage").textContent=warnings.length?
    warnings[0]+" Save & Play when ready.":"Your card is built. Edit either card section, then Save & Play.";
   $("quickBuilder").open=false;
  }catch(e){status.textContent=e.message;}
 });
 $("quickImport").addEventListener("click",()=>{
  $("importPanel").open=true;
  $("importPanel").scrollIntoView({behavior:"smooth",block:"start"});
 });
 summarize();
}
root.QuickCharacterBuilder=Object.freeze({parse,build,initialize,SAMPLE});
})(typeof globalThis!=="undefined"?globalThis:this);
