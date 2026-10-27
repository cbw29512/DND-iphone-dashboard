"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
try{
 const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
 for(const file of ["character-builder.html","character-remote.js","character-table.js","character-table.css"])
  assert.equal(read(file),read("docs/"+file),"Pages mirror: "+file);
 const html=read("character-builder.html"),remote=read("character-remote.js"),source=read("character-table.js");
 for(const id of ["tableView","tableStage","tableSignal","tableActor","tableActionName","tableActionType",
  "tableRolls","tableRuleNote","tableRound","tableDisplayLink","remoteTableLink","tableFullscreen"]){
  assert.ok(html.includes('id="'+id+'"'),"Missing table display element: "+id);
 }
 assert.ok(html.includes('character-table.css?v=table-stage-20261027'));
 assert.ok(html.includes('character-table.js?v=table-stage-20261027'));
 assert.ok(html.indexOf('character-table.js?v=')<html.indexOf('character-remote.js?v='),
  "Render script loads before signed receiver");
 assert.match(remote,/const table=args\.get\("view"\)==="table"/);
 assert.match(remote,/const viewer=phone\|\|table/);
 assert.match(remote,/pairedUrl\(session,"table"\)/);
 assert.match(remote,/crypto\.subtle\.verify/,"Only signed notifications are accepted");
 assert.match(remote,/if\(viewer\)startPhone\(\);else startController\(\);/);
 assert.match(remote,/if\(table\)\{window\.TableActionDisplay\?\.render\?\.\(snap\);return;\}/);
 assert.match(remote,/if\(viewer\|\|!session\)return/,"Viewers cannot publish");
 assert.match(html,/function doAttack\(w,chosenMode="normal"\)/);
 assert.match(html,/show\(w\.name,hit\+" HIT"/,"Weapon button remains linked to battle results");
 const all={};
 function dom(id){
  return all[id]||=({
   textContent:"",offsetWidth:500,children:[],
   classes:new Set(),events:{},
   classList:{
    add(...items){for(const x of items)all[id].classes.add(x);},
    remove(...items){for(const x of items)all[id].classes.delete(x);}
   },
   replaceChildren(){all[id].children=[];},
   append(...children){all[id].children.push(...children);},
   addEventListener(event,callback){all[id].events[event]=callback;}
  });
 }
 const document={getElementById:dom,createElement:tag=>({
  tag,className:"",textContent:"",children:[],classes:new Set(),
  classList:{add(x){this.classes?.add?.(x);}},
  append(...nodes){this.children.push(...nodes);}
 })};
 const context={document,console,window:{}};
 vm.createContext(context);vm.runInContext(source,context,{filename:"character-table.js"});
 const render=context.TableActionDisplay.render;
 render({name:"Donovan",turn:2,result:{name:"Mace of Disruption",
  weapon:{hit:23,damage:11,special:12,mode:"normal"}}});
 assert.equal(dom("tableActor").textContent,"Donovan");
 assert.equal(dom("tableActionName").textContent,"Mace of Disruption");
 assert.equal(dom("tableActionType").textContent,"Weapon attack");
 assert.equal(dom("tableRound").textContent,"TURN 2");
 assert.equal(dom("tableRolls").children.length,3);
 assert.equal(dom("tableRolls").children[0].children[0].textContent,"ATTACK ROLL");
 assert.equal(dom("tableRolls").children[0].children[1].textContent,"23");
 assert.equal(dom("tableRolls").children[1].children[1].textContent,"11");
 assert.equal(dom("tableRolls").children[2].children[1].textContent,"12");
 assert.match(dom("tableRuleNote").textContent,/not a confirmed hit/);
 render({name:"Donovan",turn:2,result:{name:"Healing Word",
  spell:{kind:"heal",hit:null,save:null,value:12,slotText:"L1 · 2 left"}}});
 assert.equal(dom("tableActionType").textContent,"Healing spell");
 assert.equal(dom("tableRolls").children[1].children[0].textContent,"HEAL ROLLED");
 assert.equal(dom("tableRolls").children[1].children[1].textContent,"12");
 render({name:"Donovan",turn:2,result:{name:"Fireball",
  spell:{kind:"damage",hit:null,save:"DEX",dc:15,value:28,slotText:"L3 · 1 left"}}});
 assert.equal(dom("tableRolls").children[0].children[1].textContent,"DEX DC 15");
 assert.equal(dom("tableRolls").children[1].children[0].textContent,"DAMAGE ROLLED");
 assert.match(dom("tableRuleNote").textContent,/saving throw/);
 render({name:"Donovan",turn:4,result:{name:"INITIATIVE",total:"18 TOTAL"}});
 assert.equal(dom("tableRolls").children.length,1);
 assert.equal(dom("tableRolls").children[0].children[1].textContent,"18 TOTAL");
 render({name:"<bad>",result:{name:"<script>evil()</script>",total:"15"}});
 assert.equal(dom("tableActor").textContent,"<bad>");
 assert.equal(dom("tableActionName").textContent,"<script>evil()</script>");
 console.log("Full-screen table display: buttons, signed receiver, attack/heal/spell/saves output and safe text rendering passed.");
}catch(error){console.error("Table display regression failed:",error);process.exitCode=1;}
