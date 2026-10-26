/* Edit actual playable-card elements. No second card or detached form. */
(function(root){
"use strict";
const $=id=>document.getElementById(id);
const el=(tag,cls="",value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
function field(parent,label,value,kind="text",options){
 const wrap=el("label","card-field"),caption=el("span","",label),c=el(options?"select":"input");
 if(options){
  options.forEach(([value,text])=>{const o=el("option","",text);o.value=String(value);c.add(o);});
  c.value=String(value??"");
 }else{c.type=kind;c.value=String(value??"");}
 wrap.append(caption,c);parent.append(wrap);return c;
}
function button(label,click,cls="card-add"){
 const b=el("button",cls,label);b.type="button";b.addEventListener("click",click);return b;
}
function dynamicList(parent,originals,factory,empty,label){
 const rows=[],add=button("+ "+label,()=>insert(empty()));
 parent.append(add);
 function insert(record){
  const item=factory(record),entry={item,record};rows.push(entry);
  parent.insertBefore(item.element,add);
  item.remove.addEventListener("click",()=>{
   item.element.remove();rows.splice(rows.indexOf(entry),1);
  });
 }
 originals.forEach(insert);
 return ()=>rows.map(({item,record})=>item.read(record)).filter(w=>w.name.trim());
}
function weapon(w){
 const art=el("article","weapon-card card-edit-action");
 const name=field(art,"Weapon",w.name||"");
 const rolls=el("div","weapon-rolls card-edit-rolls");
 const bonus=field(rolls,"HIT",w.bonus??0,"number"),dice=field(rolls,"DAMAGE",w.formula||"");
 const remove=button("×",()=>{},"card-remove");
 art.append(rolls,remove);
 const details=el("details","card-edit-extra"),head=el("summary","","Notes");
 const notes=field(details,"Weapon notes",w.notes||"");
 details.prepend(head);art.append(details);
 return {element:art,remove,read:o=>{
  const formula=dice.value.trim().replace(/\s/g,""),unchanged=formula===String(o.formula||"");
  return {...o,name:name.value.trim(),bonus:Number(bonus.value),formula,
   damage:unchanged?(o.damage||formula):formula,notes:notes.value};
 }};
}
function spell(sp,level,rules){
 const art=el("article","spell-card card-edit-action");
 const name=field(art,level===0?"Cantrip":"Spell",sp.name||"");
 let prep=null;
 if(level>0){
  const lbl=el("label","card-spell-ready"),box=el("input");box.type="checkbox";
  box.checked=sp.prepared!==false;prep=box;lbl.append(box,el("span","","Ready"));art.append(lbl);
 }
 const remove=button("×",()=>{},"card-remove");art.append(remove);
 const more=el("details","card-edit-extra"),profile=CharacterSpellLogic.profile(sp,rules);
 const settings=el("div","card-extra-fields");
 const dice=field(settings,"Dice",sp.custom?.dice||"");
 const effect=field(settings,"Effect",sp.custom?.type||profile?.type||"effect","text",
  [["damage","Damage"],["heal","Healing"],["effect","Other"]]);
 const originalRoll=sp.custom?.attack||CharacterSpellLogic.needsAttack(sp,profile)?"ATTACK":
  CharacterSpellLogic.saveAbility(sp,profile)||"";
 const mode=field(settings,"Roll",originalRoll,"text",
  [["","None"],["ATTACK","Spell attack"],...CharacterFormModel.ABILITIES.map(a=>[a,a+" save"])]);
 more.append(el("summary","","Dice & rules"),settings);art.append(more);
 return {element:art,remove,read:o=>{
  const next={...o,name:name.value.trim(),level,prepared:level===0||prep.checked};
  const formula=dice.value.trim();
  if(formula){
   next.custom={...o.custom,dice:formula,type:effect.value,
    per:Number(o.custom?.per)||0,targets:Number(o.custom?.targets)||1,
    attack:mode.value==="ATTACK"};
  }else if(o.custom?.dice)delete next.custom;
  if(mode.value==="ATTACK"&&!next.custom)next.custom={type:profile?.type||"effect",attack:true};
  if(mode.value==="ATTACK")next.save="";
  else if(mode.value)next.save=mode.value;
  return next;
 }};
}
function section(parent,text){
 parent.append(el("div","section",text));
}
function build(card){
 const who=$("who"),identity=$("identity"),stats=$("stats"),actions=$("actions");
 who.replaceChildren();identity.replaceChildren();stats.replaceChildren();actions.replaceChildren();
 const name=field(who,"Name",card.name),classes=field(identity,"Class",card.classes);
 const statFields={};
 for(const [key,label,value] of [
  ["hpMax","HP",card.hpMax],["ac","AC",card.ac],
  ["speed","MOVE ft",card.speed??""],["initiative","INIT",card.initiative],
  ["level","LEVEL",card.level],["spellDC","SPELL DC",card.spellDC]]){
  const tile=el("div","stat");statFields[key]=field(tile,label,value,"number");stats.append(tile);
 }
 section(actions,"ATTACKS & AT-WILL CANTRIPS");
 const quick=el("div","quick-grid");actions.append(quick);
 const group={};
 for(const category of ["MELEE","RANGED","CANTRIPS"]){
  const col=el("section","quick-section");col.append(el("h3","",category));quick.append(col);
  if(category==="CANTRIPS"){
   group.cantrips=dynamicList(col,card.spells.filter(s=>s.level===0),
    s=>spell(s,0,card.rules),()=>({level:0,prepared:true}),"Cantrip");
  }else{
   const lower=category.toLowerCase();
   group[lower]=dynamicList(col,card.weapons.filter(w=>CharacterCompactCard.typeOfWeapon(w)===category),
    weapon,()=>({category:lower,formula:"",bonus:0}),"Weapon");
  }
 }
 const slotControls={},spellReaders=[];
 const max=Math.min(9,Math.max(3,...Object.keys(card.slots||{}).map(Number),
  ...card.spells.map(s=>Number(s.level)||0)));
 function addLevel(level){
  const label=el("div","section card-edit-level");
  label.append(el("strong","","LEVEL "+level+" SPELLS"));
  slotControls[level]=field(label,"SLOTS",card.slots?.[level]??0,"number");
  actions.append(label);
  const grid=el("div","spell-button-grid");actions.append(grid);
  spellReaders.push(dynamicList(grid,card.spells.filter(s=>s.level===level),
   s=>spell(s,level,card.rules),()=>({level,prepared:true}),"Spell"));
 }
 for(let level=1;level<=max;level++)addLevel(level);
 if(max<9){
  let level=max;
  const add=button("+ Another spell level",()=>{
   if(level>=9)return;addLevel(++level);if(level>=9)add.remove();else actions.append(add);
  });
  actions.append(add);
 }
 const advanced=el("details","card-advanced"),groupEl=el("div","card-advanced-grid");
 advanced.append(el("summary","","More character details"),groupEl);
 const extra={
  species:field(groupEl,"Species",card.species),
  background:field(groupEl,"Background",card.background),
  rules:field(groupEl,"Edition",card.rules,"text",
   [["2014","2014"],["2024","2024"],["unspecified","Unspecified"]]),
  spellAttack:field(groupEl,"Spell attack",card.spellAttack,"number")
 };
 const scores={},saves={},skills={};
 for(const key of CharacterFormModel.ABILITIES){
  scores[key]=field(groupEl,key+" score",card.ability?.[key]?.score??10,"number");
  saves[key]=field(groupEl,key+" save",card.saves?.[key]??0,"number");
 }
 for(const key of CharacterFormModel.SKILLS)
  skills[key]=field(groupEl,key,card.skills?.[key]??0,"number");
 actions.append(advanced);
 return {collect:()=>{
  const values={name:name.value,classes:classes.value};
  for(const [k,c]of Object.entries(statFields))values[k]=c.value;
  for(const [k,c]of Object.entries(extra))values[k]=c.value;
  values.ability={};values.saves={};values.skills={};
  for(const key of CharacterFormModel.ABILITIES){
   values.ability[key]={score:scores[key].value};values.saves[key]=saves[key].value;
  }
  for(const key of CharacterFormModel.SKILLS)values.skills[key]=skills[key].value;
  values.weapons=[...group.melee().map(w=>({...w,category:"melee"})),
   ...group.ranged().map(w=>({...w,category:"ranged"}))];
  values.spells=[...group.cantrips(),...spellReaders.flatMap(f=>f())];
  values.slots={};
  for(let level=1;level<=9;level++)
   values.slots[level]=slotControls[level]?.value??card.slots?.[level]??0;
  return values;
 }};
}
root.CharacterFormFields=Object.freeze({build});
})(typeof globalThis!=="undefined"?globalThis:this);
