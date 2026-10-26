"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
try{
 const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
 for(const f of ["character-builder.html","character-form-fields.js","character-form.css",
    "character-editor.js","character-form-model.js","character-compact-card.js"]){
  assert.equal(read(f),read("docs/"+f),"Root/docs mirror: "+f);
 }
 const html=read("character-builder.html");
 assert.match(html,/<div id="editorIdentity"/);
 assert.match(html,/<div id="editorHeroStats" class="stats portrait-stats"/);
 assert.match(html,/id="editorFields"/);
 assert.ok(!html.includes('id="editorHeading"'),"Edit form no longer has a separate page-like heading");
 class Node{
  constructor(tag){
   this.tag=tag;this.children=[];this.className="";this.textContent="";
   this.value="";this.type="";this.checked=false;this.events={};
  }
  get options(){return this.children.filter(x=>x.tag==="option");}
  add(node){this.append(node);}
  append(...nodes){for(const n of nodes){this.children.push(n);n.parent=this;}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  addEventListener(name,callback){this.events[name]=callback;}
  remove(){
   if(!this.parent)return;
   this.parent.children=this.parent.children.filter(c=>c!==this);
  }
 }
 const identity=new Node("div"),hero=new Node("div"),fields=new Node("div");
 const document={
  createElement:tag=>new Node(tag),
  getElementById:id=>({"editorIdentity":identity,"editorHeroStats":hero})[id]||null
 };
 const context={console,Date,Math,document};
 vm.createContext(context);
 for(const file of ["character-spell-logic.js","character-compact-card.js",
   "character-form-model.js","character-form-fields.js"]){
  vm.runInContext(read(file),context,{filename:file});
 }
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
 const editor=context.CharacterFormFields.build(fields,card);
 assert.equal(identity.children.length,2,"Name and class occupy card title area");
 assert.equal(hero.children.length,6,"Six visual stats beneath picture");
 const sections=fields.children.filter(x=>x.tag==="section");
 assert.equal(sections[0].children[0].textContent,"ATTACKS & AT-WILL CANTRIPS");
 assert.equal(sections[1].children[0].textContent,"SPELLS");
 const quick=sections[0].children[1];
 assert.equal(quick.children.length,3,"Melee/ranged/cantrips in the same row");
 assert.deepEqual(Array.from(quick.children,x=>x.children[0].textContent),
  ["MELEE","RANGED","CANTRIPS"]);
 const editorOutput=editor.collect();
 assert.deepEqual(Array.from(editorOutput.weapons,w=>w.name),["Mace","Crossbow"]);
 assert.equal(editorOutput.weapons[0].damage,"1d6+1 Bludgeoning",
  "Editing unrelated fields does not delete imported damage type");
 assert.deepEqual(Array.from(editorOutput.spells,s=>s.name),["Eldritch Blast","Magic Missile","Fireball"]);
 assert.equal(editorOutput.slots[1],"4");
 assert.equal(editorOutput.skills.Perception,"6");
 hero.children[0].children[1].value="55";
 identity.children[0].children[1].value="Kael Voss";
 const edited=context.CharacterFormModel.apply(card,editor.collect());
 assert.equal(edited.hpMax,55);
 assert.equal(edited.hp,20,"Changing character on card does not heal");
 assert.equal(edited.remaining[1],1,"Spent spell slots are not restored");
 assert.equal(edited.remaining[3],0);
 assert.equal(edited.skills.Perception,6);
 assert.equal(edited.weapons[1].category,"ranged");
 assert.equal(edited.spells.length,3);
 console.log("Matching form/play card: identity, portrait stat strip, three action columns, leveled spells, edits and resource preservation passed.");
}catch(error){console.error("Matching form/card regression failed",error);process.exitCode=1;}
