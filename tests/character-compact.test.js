"use strict";
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");
try{
 const root=path.resolve(__dirname,"..");
 const read=f=>fs.readFileSync(path.join(root,f),"utf8");
 for(const file of ["character-builder.html","character-card.css","character-compact-card.js"]){
  assert.equal(read(file),read("docs/"+file),"Root/docs mirror: "+file);
 }
 const html=read("character-builder.html"),js=read("character-compact-card.js");
 assert.match(html,/character-card\.css\?v=/);
 assert.match(html,/character-compact-card\.js\?v=/);
 assert.match(html,/CharacterCompactCard\.quickActions\(/);
 assert.match(html,/CharacterCompactCard\.decorate\(/);
 assert.match(html,/id="importPanel"/);
 assert.match(html,/id="latestPanel"/);
 const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
 assert.ok(inline,"Main builder script exists");
 new vm.Script(inline[1],{filename:"builder"});
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.textContent="";this.hidden=false;}
  append(...children){this.children.push(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
  querySelectorAll(selector){
   const matches=[];
   for(const child of this.children){
    if(selector==="[data-action-name]"&&child.dataset.actionName)matches.push(child);
    matches.push(...child.querySelectorAll(selector));
   }
   return matches;
  }
 }
 const latest=new Node("section");
 const context={console,document:{
  createElement:tag=>new Node(tag),getElementById:id=>id==="latestPanel"?latest:null
 }};
 vm.createContext(context);vm.runInContext(js,context);
 const view=context.CharacterCompactCard;
 assert.equal(view.typeOfWeapon({name:"Mace"}),"MELEE");
 assert.equal(view.typeOfWeapon({name:"Longbow"}),"RANGED");
 assert.equal(view.typeOfWeapon({name:"Javelin"}),"RANGED");
 const container=new Node("div");
 function makeWeapon(parent,weapon){
  const item=new Node("article");item.dataset.actionName=weapon.name;
  item.dataset.actionKind="weapon";parent.append(item);
 }
 function makeSpell(parent,spell){
  const item=new Node("article");item.dataset.actionName=spell.name;
  item.dataset.actionKind="spell";parent.append(item);
 }
 view.quickActions(container,[{name:"Mace"},{name:"Longbow"}],
  [{name:"Fire Bolt"}],makeWeapon,makeSpell);
 assert.equal(container.children.length,1,"One compact quick-action grid");
 assert.equal(container.children[0].children.length,3,"Three same-line categories");
 for(const category of container.children[0].children)assert.equal(category.children.length,2);
 const spellRoll={result:{name:"Fire Bolt",spell:{
  hit:17,save:null,dc:null,kind:"damage",value:12,slotText:"AT WILL",level:0
 }}};
 assert.equal(view.decorate(spellRoll,container),true);
 assert.equal(latest.hidden,true,"No duplicate external result panel");
 const spellLine=container.querySelectorAll("[data-action-name]")
  .find(node=>node.dataset.actionName==="Fire Bolt");
 assert.equal(spellLine.children.length,1,"Roll displayed under the button's row");
 assert.equal(spellLine.children[0].children.length,4,"Three results and one status line");
 const weaponRoll={result:{name:"Longbow",weapon:{
  hit:19,damage:7,special:null,mode:"adv",critical:false
 }}};
 assert.equal(view.decorate(weaponRoll,container),true);
 assert.equal(latest.hidden,true);
 assert.equal(view.decorate({result:{name:"READY"}},container),false);
 assert.equal(latest.hidden,false,"Other events stay visible on same sheet");
 console.log("Character card: three-column quick actions, inline outcomes, full-screen assets, mirrors, syntax passed.");
}catch(error){console.error("Character card regression failed:",error);process.exitCode=1;}
