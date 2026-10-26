"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
try{
 const read=f=>fs.readFileSync(path.resolve(__dirname,"..",f),"utf8");
 for(const f of ["character-builder.html","character-form-fields.js","character-form.css",
 "character-editor.js","character-form-model.js","character-compact-card.js"])
  assert.equal(read(f),read("docs/"+f),"Root/docs mirror: "+f);
 const html=read("character-builder.html");
 assert.ok(!html.includes('id="editor"'),"There must be no second editor screen");
 assert.ok(html.includes('id="play"')&&html.includes('id="actions"'));
 assert.ok(html.includes('id="stats" class="stats portrait-stats"'));
 assert.ok(html.includes('id="saveCharacterBtn"'));
 assert.match(html,/function loadCard\(c,saveToStorage=true\)/);
 assert.match(html,/if\(saveToStorage\)persist\(\)/);
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.className="";this.textContent="";
   this.value="";this.type="";this.checked=false;this.events={};this.parent=null;}
  get options(){return this.children.filter(x=>x.tag==="option");}
  add(child){this.append(child);}
  append(...children){for(const c of children){this.children.push(c);c.parent=this;}}
  prepend(child){this.children.unshift(child);child.parent=this;}
  replaceChildren(...children){this.children=[];this.append(...children);}
  insertBefore(child,reference){const i=this.children.indexOf(reference);
   assert.ok(i>=0,"Reference must be an actual child");
   this.children.splice(i,0,child);child.parent=this;}
  addEventListener(type,callback){this.events[type]=callback;}
  setAttribute(name,value){this[name]=value;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
 }
 const ids=Object.fromEntries(["who","identity","stats","actions"].map(id=>[id,new Node("div")]));
 const document={createElement:tag=>new Node(tag),getElementById:id=>ids[id]||null};
 const context={console,Date,Math,document};
 vm.createContext(context);
 for(const f of ["character-spell-logic.js","character-compact-card.js",
  "character-form-model.js","character-form-fields.js"])
   vm.runInContext(read(f),context,{filename:f});
 const card=context.CharacterFormModel.blank();
 Object.assign(card,{name:"Kael",classes:"Warlock 6",hpMax:42,hp:20,ac:15,speed:30,
 slots:{1:4,2:3,3:2},remaining:{1:1,2:2,3:0},
 weapons:[
  {name:"Mace",category:"melee",formula:"1d6+1",damage:"1d6+1 Bludgeoning",bonus:5},
  {name:"Crossbow",category:"ranged",formula:"1d8+2",damage:"1d8+2 Piercing",bonus:5}
 ],
 spells:[
  {name:"Eldritch Blast",level:0,prepared:true},
  {name:"Magic Missile",level:1,prepared:true},
  {name:"Fireball",level:3,prepared:true}
 ],
 skills:{...card.skills,Perception:6}
 });
 const before=Object.fromEntries(Object.entries(ids).map(([k,v])=>[k,v]));
 const editor=context.CharacterFormFields.build(card);
 for(const [k,v]of Object.entries(before))assert.equal(ids[k],v,"Same DOM node for "+k);
 assert.equal(ids.who.children.length,1,"Name input lives in play's name element");
 assert.equal(ids.identity.children.length,1,"Class input lives in play's identity element");
 assert.equal(ids.stats.children.length,6,"Editable values occupy the six existing portrait tiles");
 assert.equal(ids.actions.children[0].textContent,"ATTACKS & AT-WILL CANTRIPS");
 const quick=ids.actions.children[1];
 assert.equal(quick.className,"quick-grid");
 assert.deepEqual(Array.from(quick.children,x=>x.children[0].textContent),
 ["MELEE","RANGED","CANTRIPS"]);
 const buttons=ids.actions.children.filter(x=>x.className==="spell-button-grid");
 assert.equal(buttons.length,3,"Spell levels still occupy their existing card grid");
 const values=editor.collect();
 assert.deepEqual(Array.from(values.weapons,x=>x.name),["Mace","Crossbow"]);
 assert.deepEqual(Array.from(values.spells,x=>x.name),["Eldritch Blast","Magic Missile","Fireball"]);
 assert.equal(values.weapons[0].damage,"1d6+1 Bludgeoning");
 assert.equal(values.slots[1],"4");
 assert.equal(values.skills.Perception,"6");
 ids.stats.children[0].children[0].children[1].value="55";
 ids.who.children[0].children[1].value="Kael Voss";
 const edited=context.CharacterFormModel.apply(card,editor.collect());
 assert.equal(edited.name,"Kael Voss");
 assert.equal(edited.hpMax,55);assert.equal(edited.hp,20);
 assert.equal(edited.remaining[1],1);
 assert.equal(edited.remaining[3],0);
 assert.equal(edited.skills.Perception,6);
 assert.equal(edited.weapons[1].category,"ranged");
 assert.equal(edited.spells.length,3);
 console.log("Single-DOM character edit: same card name, stats, action grids, spell slots and resources passed.");
}catch(error){console.error("Single-DOM editor regression failed:",error);process.exitCode=1;}
