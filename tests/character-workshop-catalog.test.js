"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
try{
 const base=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(base,p),"utf8");
 for(const file of ["character-workshop-catalog.js","character-workshop.js","character-workshop-features.js","character-workshop.css","workshop.html"])
  assert.equal(read(file),read("docs/"+file),"Deployment mirror "+file);
 const catalogSource=read("character-workshop-catalog.js"),engineSource=read("character-workshop.js"),html=read("workshop.html");
 new vm.Script(catalogSource);new vm.Script(engineSource);
 const ctx={console,Math,Date};vm.createContext(ctx);
 new vm.Script(read("character-workshop-features.js"),{filename:"character-workshop-features.js"}).runInContext(ctx);
 vm.runInContext(catalogSource,ctx);vm.runInContext(engineSource,ctx);
 const data=ctx.CharacterWorkshopCatalog,e=ctx.CharacterWorkshopEngine;
 const expected=["barbarian","bard","cleric","druid","fighter","monk","paladin","ranger","rogue","sorcerer","warlock","wizard"];
 assert.deepEqual(Array.from(data.classes,c=>c.id),expected,"Exactly the twelve 2014 PHB base classes");
 assert.equal(data.subclasses.length,40,"All forty 2014 PHB subclasses");
 const per=[2,2,7,2,3,3,3,2,3,2,3,8];
 expected.forEach((c,i)=>assert.equal(data.forClass(c).length,per[i],"PHB subclasses for "+c));
 const ids=new Set(data.subclasses.map(sub=>sub.id));
 assert.equal(ids.size,40,"Unique subclass keys");
 for(const s of data.subclasses)assert.ok(expected.includes(s.classId),"Subclass belongs to one of the twelve");
 const initial=e.fresh(),fresh=e.derive(initial);
 assert.equal(fresh.maxHP,44);assert.equal(fresh.prof,3);assert.equal(fresh.attacks,2);
 const cases=[
  ["barbarian",12,50,null],["bard",8,38,"CHA"],["cleric",8,38,"WIS"],["druid",8,38,"WIS"],
  ["fighter",10,44,null],["monk",8,38,null],["paladin",10,44,"CHA"],["ranger",10,44,"WIS"],
  ["rogue",8,38,null],["sorcerer",6,32,"CHA"],["warlock",8,38,"CHA"],["wizard",6,32,"INT"]
 ];
 for(const [classId,die,hp,stat] of cases){
  const c=data.byClass(classId);
  assert.equal(c.die,die,classId+" Hit Die");
  const d=e.derive({...initial,classId,weapons:[c.defaultWeapon],shield:false,armor:"none"});
  assert.equal(d.maxHP,hp,classId+" HP for five levels with CON 14");
  assert.equal(d.prof,3,classId+" proficiency");
  assert.equal(d.spellStat,stat,classId+" casting ability");
  assert.equal(d.classData.id,classId);
  assert.ok(d.weaponList.length>0,classId+" playable default weapon");
 }
 const spellCases=[
  ["wizard",null,5,{1:4,2:3,3:2}],
  ["cleric","life",1,{1:2}],
  ["bard","lore",5,{1:4,2:3,3:2}],
  ["paladin","devotion",1,{}],
  ["paladin","devotion",5,{1:4,2:2}],
  ["ranger","hunter",3,{1:3}],
  ["fighter","eldritch-knight",3,{1:2}],
  ["rogue","arcane-trickster",7,{1:4,2:2}],
  ["warlock","fiend",5,{3:2}],
  ["warlock","archfey",11,{5:3}]
 ];
 for(const [baseClass,subclass,lv,expectedSlots] of spellCases){
  const slots=data.spellSlots(baseClass,subclass,lv);
  assert.equal(JSON.stringify(slots),JSON.stringify(expectedSlots),baseClass+" "+(subclass||"")+" L"+lv);
 }
 const barbarian=e.derive({...initial,classId:"barbarian",level:5,armor:"scale",shield:false});
 assert.equal(barbarian.speed,40,"Barbarian fast movement");
 const monk=e.derive({...initial,classId:"monk",level:5,armor:"none",shield:false});
 assert.equal(monk.ac,11,"Monk unarmored defense with DEX 12, WIS 10");
 assert.equal(monk.speed,40,"Monk unarmored movement");
 const dragSorcerer=e.derive({...initial,classId:"sorcerer",subclass:"draconic",armor:"none",shield:false});
 assert.equal(dragSorcerer.maxHP,37,"Draconic resilience grants 1 HP/class level");
 assert.equal(dragSorcerer.ac,14,"Draconic resilience natural AC");
 const bardValor=e.derive({...initial,classId:"bard",subclass:"valor",level:6,shield:true,armor:"scale"});
 assert.equal(bardValor.attacks,2,"Valor bard Extra Attack at 6");
 assert.ok(!bardValor.alerts.some(a=>a.includes("lacks shield proficiency")));
 assert.ok(!bardValor.alerts.some(a=>a.includes("lacks proficiency in scale")));
 const fighterChampion=e.derive({...initial,classId:"fighter",subclass:"champion"});
 assert.equal(fighterChampion.critMin,19,"Champion improved critical");
 assert.equal(e.derive({...initial,classId:"fighter",subclass:"champion",level:2}).critMin,20);
 const rogueAssassin=e.derive({...initial,classId:"rogue",subclass:"assassin"});
 assert.equal(rogueAssassin.mode,"RAW","Rogue Assassin is standard RAW");
 assert.equal(rogueAssassin.attacks,1,"Rogue subclass does not grant Fighter extra attacks");
 const fighterAssassin=e.derive({...initial,classId:"fighter",subclass:"assassin"});
 assert.equal(fighterAssassin.mode,"HOMEBREW","Assassin applied to Fighter is homebrew");
 assert.match(fighterAssassin.alerts.join(" "),/DM approval/);
 assert.equal(e.derive({...initial,classId:"fighter",subclass:"arcane-trickster"}).spellStat,null,
  "Cross-class subclass does not secretly add Rogue magic");
 const w=e.derive({...initial,classId:"wizard",weapons:["longsword"],armor:"none",shield:false});
 assert.equal(w.weaponList[0].proficient,false,"Wizard does not automatically have longsword proficiency");
 assert.equal(w.weaponList[0].attack,3,"Do not apply proficiency bonus without proficiency");
 assert.equal(e.derive({...initial,classId:"monk",weapons:["quarterstaff"],armor:"none",shield:false}).weaponList[0].proficient,true);
 let n=0;const weapon=e.seededRoll({...initial,weapons:["greatsword"],shield:false},"greatsword",()=>{n++;return .99;});
 assert.equal(weapon.rows[0].rolls,4,"Greatsword critical doubles its two 2d6 dice");
 assert.equal(weapon.rows[0].damage,27,"4d6 maximum + 3 Strength");
 assert.equal(weapon.rows.length,2,"Fighter 5 Extra Attack retained");
 assert.match(html,/id="classLibrary"/);assert.match(html,/id="subclassLibrary"/);
 assert.match(html,/id="showAllSubclasses"/);assert.match(html,/id="subclassSearch"/);
 assert.ok(html.indexOf("character-workshop-catalog.js")<html.indexOf("character-workshop.js"),
  "Catalog script loads before workshop engine");
 assert.match(engineSource,/function renderSubclassLibrary/);
 assert.match(engineSource,/CATALOG\.subclasses\.filter/);
 assert.match(engineSource,/catalogTile\("class"/);
 assert.match(engineSource,/state\.classId=cls\.id/);
 assert.match(engineSource,/state\.subclass===id\?null:id/);
 console.log("All 12 PHB 2014 classes and 40 subclasses: progression, subclass ownership, homebrew safeguards, spell slots, equipment proficiencies, HP/AC and dice passed.");
}catch(error){console.error("All-class workshop regression failure:",error);process.exitCode=1;}
