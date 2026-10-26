/* Build an editable form without exposing configuration controls on the play card. */
(function(root){
"use strict";
function input(label,value,kind="text",extra={}){
 const wrap=document.createElement("label");wrap.className="edit-field";
 const text=document.createElement("span");text.textContent=label;
 const node=document.createElement(kind==="choice"?"select":"input");
 if(kind!=="choice"){node.type=kind;node.value=String(value??"");}
 else{
  for(const [key,name] of extra.options||[]){
   const opt=document.createElement("option");opt.value=String(key);opt.textContent=name;node.add(opt);
  }
  const desired=String(value??"");
  node.value=Array.from(node.options).some(o=>o.value===desired)?desired:(node.options[0]?.value||"");
 }
 if(extra.min!==undefined)node.min=extra.min;
 if(extra.max!==undefined)node.max=extra.max;
 if(extra.step!==undefined)node.step=extra.step;
 wrap.append(text,node);
 return {wrap,node};
}
function section(root,title){
 const section=document.createElement("section");section.className="edit-section";
 const heading=document.createElement("h3");heading.textContent=title;section.append(heading);
 root.append(section);return section;
}
function addFields(container,specs){
 const nodes={};
 for(const [key,label,value,type,config] of specs){
  const field=input(label,value,type||"text",config||{});
  container.append(field.wrap);nodes[key]=field.node;
 }
 return nodes;
}
function listEditor(container,title,source,fields,addTitle){
 const sectionEl=section(container,title),rows=document.createElement("div");
 rows.className="edit-rows";sectionEl.append(rows);
 const data=[];
 function add(record={}){
  const row=document.createElement("div");row.className="edit-row";
  const values=addFields(row,fields.map(([k,label,type,config])=>[
   k,label,record[k]??"",type,config
  ]));
  const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";
  remove.className="danger";remove.addEventListener("click",()=>{
   row.remove();const at=data.findIndex(d=>d.row===row);if(at!==-1)data.splice(at,1);
  });
  row.append(remove);rows.append(row);data.push({row,values,original:record});
 }
 for(const record of source)add(record);
 const button=document.createElement("button");button.type="button";
 button.textContent=addTitle;button.addEventListener("click",()=>add());
 sectionEl.append(button);
 return ()=>data.map(item=>{
  const values=Object.fromEntries(Object.entries(item.values).map(([k,v])=>[
   k,v.type==="checkbox"?v.checked:v.value
  ]));
  return {...item.original,...values};
 });
}
function build(rootEl,card){
 rootEl.replaceChildren();
 const basics=section(rootEl,"Character information");
 basics.classList.add("edit-grid");
 const stats=addFields(basics,[
  ["name","Name",card.name],
  ["classes","Class",card.classes],
  ["species","Species",card.species],
  ["background","Background",card.background],
  ["level","Level",card.level,"number",{min:1,max:20}],
  ["rules","Edition",card.rules,"choice",{options:[["2014","2014"],["2024","2024"],["unspecified","Not specified"]]}],
  ["hpMax","Maximum HP",card.hpMax,"number",{min:1,max:9999}],
  ["ac","Armor Class",card.ac,"number",{min:0,max:50}],
  ["speed","Walking speed (ft)",card.speed??"","number",{min:0,max:500}],
  ["initiative","Initiative bonus",card.initiative,"number",{min:-30,max:30}],
  ["spellAttack","Spell attack bonus",card.spellAttack,"number",{min:-30,max:30}],
  ["spellDC","Spell save DC",card.spellDC,"number",{min:0,max:40}]
 ]);
 const abilitySection=section(rootEl,"Ability scores and saving throws");
 abilitySection.classList.add("edit-grid");
 const ability={},saves={};
 for(const key of CharacterFormModel.ABILITIES){
  ability[key]=input(key+" score",card.ability?.[key]?.score??10,"number",{min:1,max:30});
  saves[key]=input(key+" save bonus",card.saves?.[key]??0,"number",{min:-30,max:40});
  abilitySection.append(ability[key].wrap,saves[key].wrap);
 }
 const slotSection=section(rootEl,"Spell slots (maximum)");
 slotSection.classList.add("edit-grid");
 const slots={};
 for(let level=1;level<=9;level++){
  slots[level]=input("Level "+level,card.slots?.[level]??0,"number",{min:0,max:20});
  slotSection.append(slots[level].wrap);
 }
 const weapons=listEditor(rootEl,"Weapons",card.weapons||[],[
  ["name","Weapon name","text"],["category","Type","choice",{options:[["melee","Melee"],["ranged","Ranged"]]}],
  ["bonus","Attack bonus","number",{min:-30,max:40}],["formula","Damage dice","text"]
 ],"Add weapon");
 const spellRecords=(card.spells||[]).map(sp=>{
  const roll=CharacterSpellLogic.saveAbility(sp,CharacterSpellLogic.profile(sp,card.rules));
  return {...sp,diceEdit:sp.custom?.dice||"",kindEdit:sp.custom?.type||"damage",
   rollEdit:sp.custom?.attack?"ATTACK":roll||""};
 });
 const spells=listEditor(rootEl,"Spells and cantrips",spellRecords,[
  ["name","Spell name","text"],["level","Level (0 = cantrip)","number",{min:0,max:9}],
  ["prepared","Prepared?","choice",{options:[["true","Yes"],["false","No"]]}],
  ["diceEdit","Damage/heal dice (optional)","text"],
  ["kindEdit","Effect","choice",{options:[["damage","Damage"],["heal","Healing"],["effect","Other"]]}],
  ["rollEdit","Roll","choice",{options:[["","No roll"],["ATTACK","Spell attack"],
   ["STR","STR save"],["DEX","DEX save"],["CON","CON save"],
   ["INT","INT save"],["WIS","WIS save"],["CHA","CHA save"]]}]
 ],"Add spell / cantrip");
 function collect(){
  const values=Object.fromEntries(Object.entries(stats).map(([k,node])=>[k,node.value]));
  values.ability={};values.saves={};values.slots={};
  for(const key of CharacterFormModel.ABILITIES){
   values.ability[key]={score:ability[key].node.value};
   values.saves[key]=saves[key].node.value;
  }
  for(let level=1;level<=9;level++)values.slots[level]=slots[level].node.value;
  values.weapons=weapons().map(w=>({
   ...w,bonus:Number(w.bonus),damage:w.formula,category:w.category
  }));
  values.spells=spells().map(sp=>{
   const next={...sp,level:Number(sp.level),prepared:sp.prepared==="true"||sp.level==="0"};
   const dice=String(sp.diceEdit||"").trim();
   const existing=CharacterSpellLogic.profile(sp,card.rules);
   if(dice&&/^([1-9]|[12]\d|30)d(4|6|8|10|12|20)$/i.test(dice)){
    next.custom={...sp.custom,type:sp.kindEdit==="heal"?"heal":"damage",dice,
     per:Number(sp.custom?.per)||0,targets:Number(sp.custom?.targets)||1,
     attack:sp.rollEdit==="ATTACK"};
   }else if(!sp.custom)delete next.custom;
   if(sp.rollEdit&&sp.rollEdit!=="ATTACK")next.save=sp.rollEdit;
   if(sp.rollEdit==="ATTACK"){next.save="";next.custom={...next.custom,
    type:next.custom?.type||existing?.type||"effect",attack:true};}
   for(const key of ["diceEdit","kindEdit","rollEdit"])delete next[key];
   return next;
  });
  return values;
 }
 return {collect,stats};
}
root.CharacterFormFields=Object.freeze({build});
})(typeof globalThis!=="undefined"?globalThis:this);
