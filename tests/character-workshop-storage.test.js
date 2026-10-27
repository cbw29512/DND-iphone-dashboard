"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
try{
 const dir=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(dir,p),"utf8");
 for(const p of ["character-workshop-storage.js","character-workshop.js","workshop.html"])
  assert.equal(read(p),read("docs/"+p),"Root/docs mirrored "+p);
 const ctx={console,Math,Date};vm.createContext(ctx);
 for(const p of ["character-workshop-catalog.js","character-workshop-features.js","character-workshop-storage.js","character-workshop.js"])
  new vm.Script(read(p),{filename:p}).runInContext(ctx);
 const catalog=ctx.CharacterWorkshopCatalog,engine=ctx.CharacterWorkshopEngine,store=ctx.CharacterWorkshopStorage;
 const fake={items:new Map(),getItem(k){return this.items.get(k)||null;},setItem(k,v){this.items.set(k,v);}};
 const baseline=engine.fresh();
 assert.equal(store.load(fake,baseline,catalog).name,"Kael Voss");
 const changed={...baseline,name:"My Wizard",classId:"wizard",subclass:"evocation",level:9,
  scores:{...baseline.scores,INT:20,CON:16},armor:"none",shield:false,
  weapons:["quarterstaff","dagger"],featureSpent:{ki:4,rage:3},secondWindUsed:true,rageActive:true,
  result:{type:"weapon",name:"Past roll",rows:[{attack:20}]}};
 assert.equal(store.save(fake,changed,baseline,catalog).saved,true);
 const recovered=store.load(fake,baseline,catalog);
 assert.equal(recovered.name,"My Wizard");
 assert.equal(recovered.classId,"wizard");
 assert.equal(recovered.subclass,"evocation");
 assert.equal(recovered.level,9);
 assert.equal(recovered.scores.INT,20);
 assert.equal(recovered.scores.CON,16);
 assert.equal(recovered.shield,false);
 assert.equal(recovered.armor,"none");
 assert.equal(recovered.weapons.join(", "),"quarterstaff, dagger");
 assert.equal(recovered.featureSpent.ki,4);
 assert.equal(recovered.rageActive,true);
 assert.equal(recovered.result,null,"Stale dice results not restored");
 assert.equal(engine.derive(recovered).spellDC,17);
 const malicious=store.normalize({
  name:"<script>alert(1)</script>"+"Z".repeat(300),
  classId:"evil",subclass:"injected",level:999,
  scores:{STR:999,DEX:-20,CON:"not a number",INT:1,WIS:30,CHA:12,__proto__:{level:200}},
  weapons:["greataxe","hack","greataxe",2,"dagger"],armor:"imaginary",shield:"true",
  featureSpent:{rage:99999,evil:1000},result:{html:"<img onerror=evil()>"},
  foo:"arbitrary injected",rageActive:"yes"
 },baseline,catalog);
 assert.equal(malicious.name.length,52);
 assert.equal(malicious.classId,"fighter");
 assert.equal(malicious.subclass,null);
 assert.equal(malicious.level,20);
 assert.equal(malicious.scores.STR,30);
 assert.equal(malicious.scores.DEX,1);
 assert.equal(malicious.scores.CON,14);
 assert.equal(malicious.weapons.join(","),"greataxe,dagger");
 assert.equal(malicious.featureSpent.rage,1000);
 assert.equal(malicious.featureSpent.evil,undefined);
 assert.equal(malicious.armor,baseline.armor);
 assert.equal(malicious.shield,baseline.shield);
 assert.equal(malicious.rageActive,false);
 assert.equal(malicious.result,null);
 assert.equal(malicious.foo,undefined);
 fake.items.set(store.KEY,"{broken");
 assert.equal(store.load(fake,baseline,catalog).name,"Kael Voss");
 const blocked={getItem(){throw Error("denied");},setItem(){throw Error("denied");}};
 assert.equal(store.load(blocked,baseline,catalog).classId,"fighter");
 assert.equal(store.save(blocked,changed,baseline,catalog).saved,false);
 assert.equal(store.save(null,changed,baseline,catalog).saved,false);
 const html=read("workshop.html"),js=read("character-workshop.js");
 assert.ok(html.includes('id="saveStatus"'));
 assert.ok(html.includes("character-workshop-storage.js?v=autosave-20261027"));
 assert.ok(js.includes('let state=STORE.load(storage,fresh(),CATALOG)'));
 assert.ok(js.includes('STORE.save(storage,state,fresh(),CATALOG)'));
 console.log("Workshop autosave: state restoration, derived stat recalculation, malformed/unsafe input, storage failure and stale-roll isolation passed.");
}catch(error){console.error("Workshop persistence regression failure",error);process.exitCode=1;}
