"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
try{
 const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
 const files=["character-form-model.js","character-form-fields.js","character-editor.js",
  "character-form.css","character-builder.html"];
 for(const f of files){
  assert.equal(read(f),read("docs/"+f),"GitHub Pages mirror "+f);
  if(f.endsWith(".js"))new vm.Script(read(f),{filename:f});
 }
 const html=read("character-builder.html");
 const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
 assert.ok(inline,"Browser character code exists");
 new vm.Script(inline[1],{filename:"character-builder inline"});
 for(const id of ["play","who","identity","stats","actions","createBtn","editCharacterBtn","saveCharacterBtn",
  "cancelCharacterBtn","editorCard","editPane","portraitImage","portraitInitials",
  "saveSelect","abilitySelect","rollSaveBtn","rollAbilityBtn"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing "+id);
 }
 assert.match(html,/CharacterEditor\.initialize\(/,"Form must be wired to play card");
 assert.ok(!html.includes('id="editor"'),"No detached old editor remains");
 assert.match(read("character-editor.js"),/upload\.id="portraitUpload"/,"Picture upload is created on editor card");
 assert.match(html,/draft=>loadCard\(draft,false\)/,"Unsaved manual drafts must not persist");
 assert.match(html,/CharacterFormModel\.parsedSpeed/,"Movement import must be attempted");
 assert.match(html,/CharacterFormModel\.safePortrait/,"Portrait must be validated");
 assert.match(html,/h\.addEventListener\("click",\(\)=>doAttack\(w,"normal"\)\)/);
 assert.match(html,/name\.addEventListener\("click",\(\)=>cast\(sp,"normal"\)\)/);
 assert.match(html,/spell-button-grid/);
 const context={Date,Math};
 vm.createContext(context);
 vm.runInContext(read("character-form-model.js"),context);
 const model=context.CharacterFormModel;
 const makeValues=(extra={})=>({
  name:"Aldrin",classes:"Wizard",level:7,species:"Human",background:"Sage",
  rules:"2024",hpMax:44,ac:14,speed:30,initiative:2,spellAttack:8,spellDC:16,
  ability:{STR:{score:8},DEX:{score:14},CON:{score:12},INT:{score:18},
   WIS:{score:10},CHA:{score:9}},
  saves:{STR:-1,DEX:2,CON:1,INT:8,WIS:3,CHA:-1},
  slots:{1:4,2:3,3:3,4:1},
  weapons:[{name:"Quarterstaff",category:"melee",formula:"1d6+1",bonus:3}],
  spells:[{name:"Fireball",level:3,prepared:true},
   {name:"Fire Bolt",level:0,prepared:false}],
  ...extra
 });
 const blank=model.blank();
 assert.equal(blank.hp,1);
 assert.equal(blank.weapons.length,0);
 assert.equal(blank.spells.length,0);
 const fresh=model.apply(blank,makeValues({fresh:true}));
 assert.equal(fresh.hp,44,"Creating a character starts with full HP");
 assert.equal(fresh.remaining[3],3);
 assert.equal(fresh.speed,30);
 assert.equal(fresh.ability.INT.mod,4);
 assert.equal(fresh.saves.INT,8);
 assert.equal(fresh.spells[0].level,0,"Cantrips sort first");
 assert.equal(fresh.spells[0].prepared,true,"Cantrips are always available");
 const played={...fresh,hp:19,turn:4,actionUsed:true,bonusUsed:true,
  slotUsed:true,reactionUsed:true,remaining:{1:2,2:1,3:0,4:1},
  notes:"Fight log",log:[{name:"Fireball"}],concentration:"Shield"};
 const edited=model.apply(played,makeValues({
  name:"Aldrin the Wise",hpMax:50,ac:15,slots:{1:5,2:3,3:3,4:1}
 }));
 assert.equal(edited.id,played.id,"Identity persists after renaming");
 assert.equal(edited.hp,19,"No healing by editing max HP");
 assert.equal(edited.remaining[1],3,"Spent first-level slots stay spent on increasing capacity");
 assert.equal(edited.remaining[2],1,"Spent second-level slots stay spent");
 assert.equal(edited.remaining[3],0,"Exhausted slots remain exhausted");
 assert.equal(edited.turn,4);
 assert.equal(edited.actionUsed,true);
 assert.equal(edited.concentration,"Shield");
 assert.equal(edited.notes,"Fight log");
 assert.equal(edited.log.length,1);
 assert.equal(edited.spells.length,2);
 assert.equal(model.parsedSpeed("35 ft."),35);
 assert.equal(model.parsedSpeed("not present"),null);
 assert.equal(model.safePortrait("javascript:alert(1)"),"");
 assert.throws(()=>model.apply(played,makeValues({name:""})),/Character name/);
 console.log("Character form: manual creation, editable PDF schema, no-resource-reset, portrait safety, card button wiring and Pages mirrors passed.");
}catch(error){
 console.error("Character form regression failed:",error);
 process.exitCode=1;
}
