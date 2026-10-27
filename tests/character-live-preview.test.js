"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
try{
 const root=path.resolve(__dirname,".."),read=x=>fs.readFileSync(path.join(root,x),"utf8");
 for(const f of ["character-builder.html","character-card.css","character-form.css",
  "character-editor.js","character-form-fields.js","character-remote.js"])
  assert.equal(read(f),read("docs/"+f),"GitHub Pages mirror: "+f);
 const html=read("character-builder.html");
 assert.match(html,/id="cardWorkspace" class="card-workspace"/);
 assert.match(html,/id="editPane" class="card-editor-pane"/);
 assert.match(html,/id="editorCard" class="card-editor-sheet"/);
 assert.match(html,/id="play" class="hidden"/);
 assert.match(html,/id="phoneActions"/);
 assert.match(html,/id="phoneSpeed"/);
 assert.match(html,/draft=>\{character=draft;renderAll\(\);window\.characterRemote\?\.publish\?\.\(\);\}/);
 assert.match(html,/if\(window\.CharacterEditor\?\.isEditing\?\.\(\)\)/,"Preview changes must not persist as final");
 assert.match(html,/function loadCard\(c,saveToStorage=true\)/);
 assert.match(html,/character-form\.css\?v=twopane-20261026/);
 assert.match(html,/character-card\.css\?v=twopane-20261026/);
 const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
 assert.ok(inline);new vm.Script(inline[1],{filename:"character-builder inline"});
 const editor=read("character-editor.js"),remote=read("character-remote.js");
 new vm.Script(editor,{filename:"editor"});
 new vm.Script(remote,{filename:"phone"});
 assert.match(editor,/cloneNode\(true\)/,"Editor must clone actual card markup");
 assert.match(editor,/target\.replaceChildren\(\)/,"Preview and editor have independent DOM targets");
 assert.match(editor,/showPreview\(candidate\)/,"Changes update right-hand card");
 assert.match(editor,/form=CharacterFormFields\.build\(card,refs\)/);
 assert.match(editor,/form\.collect\(\)/);
 assert.match(editor,/livePreview\(\)/);
 assert.match(editor,/restore\(old\)/,"Cancel rolls back editor session");
 assert.match(remote,/actions:\{melee,ranged,cantrips,spells\}/);
 assert.match(remote,/action\.disabled=true/,"Phone mirror must not pretend to handle remote clicks");
 assert.match(remote,/crypto\.subtle\.verify/,"Phone must authenticate snapshots");
 const model=read("character-form-model.js");
 new vm.Script(model,{filename:"form model"});
 const context={console,Date,Math};vm.createContext(context);vm.runInContext(model,context);
 const c=context.CharacterFormModel.blank();
 const val={name:"Kael",classes:"Warlock",rules:"2014",level:6,hpMax:44,ac:15,
  speed:30,spellDC:15,spellAttack:7,initiative:2,
  ability:c.ability,saves:c.saves,skills:c.skills,slots:{1:4,2:3,3:2},
  weapons:[{name:"Crossbow",category:"ranged",formula:"1d8+2",bonus:5}],
  spells:[{name:"Fireball",level:3,prepared:true}],fresh:true};
 const created=context.CharacterFormModel.apply(c,val);
 assert.equal(created.hp,44);
 const inFight={...created,hp:21,remaining:{1:2,2:1,3:0},turn:4,
  log:[{name:"Fireball"}]};
 const preview=context.CharacterFormModel.apply(inFight,{...val,name:"Kael Voss",fresh:false});
 assert.equal(preview.hp,21);
 assert.equal(preview.remaining[3],0);
 assert.equal(preview.turn,4);
 assert.equal(preview.log.length,1);
 console.log("Live two-pane workbench, same-layout editor clone, phone mirror, signed sync, and resource preservation passed.");
}catch(error){console.error("Two-pane regression failed",error);process.exitCode=1;}
