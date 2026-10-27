"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
try{
 const dir=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(dir,p),"utf8");
 for(const file of ["character-quick-build.js","character-quick-build.css","character-builder.html"])
  assert.equal(read(file),read("docs/"+file),"GitHub Pages mirror: "+file);
 const html=read("character-builder.html");
 const source=read("character-quick-build.js");
 new vm.Script(source,{filename:"character-quick-build.js"});
 const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
 assert.ok(inline);new vm.Script(inline[1],{filename:"character-builder inline"});
 for(const id of ["quickBuilder","quickText","quickExample","quickBuild","quickImport","quickStatus"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing quick-create UI: "+id);
 }
 assert.match(html,/character-quick-build\.js\?v=quick-build-20261027/);
 assert.match(html,/character-quick-build\.css\?v=quick-build-20261027/);
 assert.match(html,/QuickCharacterBuilder\.initialize\(card=>CharacterEditor\.open\(card,true\)\)/,
  "Quick-created character opens unsaved editable + playable card");
 assert.ok(!html.includes('id="importPanel" open'),"Large PDF importer should be collapsed by default");
 const context={Date,Math};
 vm.createContext(context);
 vm.runInContext(read("character-form-model.js"),context);
 vm.runInContext(source,context);
 const parser=context.QuickCharacterBuilder;
 const outline=parser.parse(parser.SAMPLE);
 assert.equal(outline.name,"Kael Voss");
 assert.equal(outline.classes,"Warlock");
 assert.equal(outline.hpMax,44);
 assert.equal(outline.ac,15);
 assert.equal(outline.speed,30);
 assert.deepEqual(Array.from(outline.weapons,w=>w.name),["Mace of Disruption","Crossbow"]);
 assert.equal(outline.weapons[0].bonus,5);
 assert.equal(outline.weapons[0].formula,"1d6+2");
 assert.equal(outline.weapons[0].category,"melee");
 assert.equal(outline.weapons[1].category,"ranged");
 assert.equal(outline.weapons[1].formula,"1d8+2");
 assert.deepEqual(Array.from(outline.spells,s=>s.name),
  ["Light","Fire Bolt","Magic Missile","Alarm","Alter Self","Fireball","Ice Storm"]);
 assert.deepEqual(Array.from(outline.spells,s=>s.level),[0,0,1,1,2,3,4]);
 for(const [level,n] of [[1,5],[2,4],[3,3],[4,3]])
  assert.equal(outline.slots[level],n,"Spell slots L"+level);
 assert.equal(outline.weapons.filter(w=>w.needsSetup).length,0);
 const built=parser.build(parser.SAMPLE);
 assert.equal(built.card.hp,44);
 assert.equal(built.card.hpMax,44);
 assert.equal(built.card.remaining[3],3);
 assert.equal(built.card.weapons.length,2);
 assert.equal(built.card.spells.length,7);
 assert.equal(built.card.log.length,0);
 assert.ok(/^manual-/.test(built.card.id));
 const userSketch=parser.parse("Mage\nHP 31 AC 13 Movement 30\n<Mace of Disruption>\n<Crossbow>\n<Cantrip: Light>\nSpells 5/4/3/3\n1: Magic Missile, Alarm\n2: Alter Self\n3: Fireball\n4: Ice Storm");
 assert.equal(userSketch.name,"Mage");
 assert.equal(userSketch.weapons.length,2);
 assert.equal(userSketch.spells.length,6);
 assert.equal(userSketch.slots[1],5);
 assert.equal(userSketch.warnings.length,1,"Incomplete weapon metadata flagged, not guessed");
 assert.equal(userSketch.weapons[0].formula,"");
 const alt=parser.parse("Name: Arannis\nClass: Cleric 5\nLevel: 5\nHP: 38\nAC: 18\nMove: 25\nCantrip: Sacred Flame\nL1: Bless, Cure Wounds\nL2: Aid\nSlots: 4/3");
 assert.equal(alt.level,5);
 assert.equal(alt.spells[0].level,0);
 assert.equal(alt.spells[1].level,1);
 assert.equal(alt.slots[2],3);
 assert.equal(alt.speed,25);
 assert.throws(()=>parser.parse(""),/name/i);
 assert.throws(()=>parser.parse("A".repeat(8001)),/8,000/);
 const playing={...built.card,hp:10,remaining:{1:1,2:1,3:0,4:2},turn:5,log:[{name:"Roll"}]};
 const updated=context.CharacterFormModel.apply(playing,{
  ...outline,level:5,ability:playing.ability,saves:playing.saves,skills:playing.skills,rules:"2014",
  fresh:false,portrait:playing.portrait
 });
 assert.equal(updated.hp,10);
 assert.equal(updated.remaining[3],0);
 assert.equal(updated.turn,5);
 assert.equal(updated.log.length,1);
 console.log("Paste-to-build character outline parsing, attack metadata, spell slots, incomplete-data warnings, UI wiring and preservation passed.");
}catch(error){console.error("Quick card builder regression failed:",error);process.exitCode=1;}
