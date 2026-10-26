/* View-only composition for the single-screen, form-driven combat sheet. */
(function(root){
"use strict";
function typeOfWeapon(w){
 if(w?.category==="melee")return "MELEE";
 if(w?.category==="ranged")return "RANGED";
 const name=String(w?.name||"").toLowerCase();
 const notes=String(w?.notes||"").toLowerCase();
 return /bow|crossbow|sling|dart|blowgun|javelin|thrown/.test(name+" "+notes)?"RANGED":"MELEE";
}
function quickActions(parent,weapons,cantrips,weaponFactory,spellFactory){
 const grid=document.createElement("div");grid.className="quick-grid";
 for(const category of ["MELEE","RANGED","CANTRIPS"]){
  const section=document.createElement("section");section.className="quick-section";
  const title=document.createElement("h3");title.textContent=category;
  section.append(title);
  if(category==="CANTRIPS"){
   for(const spell of cantrips)spellFactory(section,spell);
  }else{
   for(const weapon of weapons.filter(w=>typeOfWeapon(w)===category)){
    weaponFactory(section,weapon);
   }
  }
  if(section.children.length===1){
   const empty=document.createElement("p");empty.className="empty";empty.textContent="None listed";
   section.append(empty);
  }
  grid.append(section);
 }
 parent.append(grid);
}
function decorate(character,rootEl){
 const data=character?.result;
 const kind=data?.weapon?"weapon":data?.spell?"spell":null;
 const latest=document.getElementById("latestPanel");
 if(!kind){
  if(latest)latest.hidden=false;
  return false;
 }
 const action=Array.from(rootEl.querySelectorAll("[data-action-name]"))
  .find(element=>element.dataset.actionKind===kind&&element.dataset.actionName===data.name);
 if(latest)latest.hidden=Boolean(action);
 if(!action)return false;
 const cells=data.weapon?
  [["TO HIT",data.weapon.hit],["DAMAGE",data.weapon.damage],["SPECIAL",data.weapon.special]]:
  [[data.spell.hit!==null?"TO HIT":data.spell.save?data.spell.save+" DC":"EFFECT",
    data.spell.hit!==null?data.spell.hit:data.spell.save?data.spell.dc:null],
   [data.spell.kind==="heal"?"HEAL":data.spell.kind==="damage"?"DAMAGE":"EFFECT",data.spell.value],
   ["SLOT",data.spell.slotText]];
 const outcome=document.createElement("div");outcome.className="inline-result";
 outcome.setAttribute("role","status");outcome.setAttribute("aria-live","polite");
 for(const [label,value] of cells){
  const cell=document.createElement("span");cell.className="value";
  const small=document.createElement("small"),strong=document.createElement("strong");
  small.textContent=label;
  strong.textContent=value===null||value===undefined?"—":String(value);
  cell.append(small,strong);outcome.append(cell);
 }
 const note=document.createElement("span");note.className="event-note";
 note.textContent=data.weapon?
  ((data.weapon.mode==="adv"?"ADV":data.weapon.mode==="dis"?"DIS":"NORMAL")+
   (data.weapon.critical?" · CRITICAL":"")):
  ((data.spell.half?"SAVE FOR HALF · ":"")+
   (data.spell.critical?"CRITICAL · ":"")+
   (data.spell.level===0?"CANTRIP · AT WILL":"LEVEL "+data.spell.level));
 outcome.append(note);action.append(outcome);
 return true;
}
root.CharacterCompactCard=Object.freeze({typeOfWeapon,quickActions,decorate});
})(typeof globalThis!=="undefined"?globalThis:this);
