"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

try{
 const root=path.resolve(__dirname,"..");
 const get=p=>fs.readFileSync(path.join(root,p),"utf8");
 const logic=get("character-spell-logic.js");
 const runtime=get("character-spell-runtime.js");
 const html=get("character-builder.html");
 const remote=get("character-remote.js");
 for(const file of ["character-builder.html","character-remote.js",
                      "character-spell-logic.js","character-spell-runtime.js"]){
  const original=get(file),mirror=get("docs/"+file);
  assert.equal(original,mirror,"GitHub Pages docs mirror: "+file);
 }
 for(const script of [logic,runtime]){
  new vm.Script(script,{filename:"spell module"});
 }
 const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
 assert.ok(inline,"Main browser script exists");
 new vm.Script(inline[1],{filename:"character-builder.inline.js"});
 assert.match(html,/WEAPONS & CANTRIPS/);
 assert.match(html,/groupedSpells\(root,character\.spells\.filter\(x=>x\.level>0/);
 assert.match(html,/Upcast /);
 assert.match(html,/result\.spell/);
 assert.match(remote,/spell=snap\.result\?\.spell/);

 const card=()=>({
  level:6,rules:"2024",spellAttack:7,spellDC:15,hp:40,hpMax:50,
  life:false,blessedHealer:false,ability:{WIS:{mod:4}},
  slots:{1:3,2:2,3:2,4:1},remaining:{1:3,2:2,3:2,4:1},
  castChoices:{},concentration:"",concentrationSlot:0,actionUsed:false,
  bonusUsed:false,reactionUsed:false,slotUsed:false
 });
 let c=card();
 const env={
  console,character:c,healTargets:1,healWho:"others",targetWounded:false,
  d20:()=>({value:12,text:"d20 (12) = 12"}),
  dice:formula=>{
   const m=/^(\d+)d(\d+)$/.exec(formula);
   assert.ok(m,"Supported test dice formula: "+formula);
   return {total:Number(m[1])*3,text:formula+" (fixed 3 per die)"};
  },
  signed:n=>(n>=0?"+":"")+n,
  show:(name,total,detail,extra={})=>{
   env.character.result={name,total,detail,...extra};
  },
  useSlot:(level,selected=level)=>{
   if(!level)return {level:0};
   if(!env.character.remaining[selected]){
    env.show("NO SPELL SLOT","NOT CAST","No level-"+selected+" slot remains");
    return null;
   }
   env.character.remaining[selected]--;
   return {level:selected};
  }
 };
 vm.createContext(env);
 vm.runInContext(logic,env);
 vm.runInContext(runtime,env);
 const rules=env.CharacterSpellLogic;
 const fireball={name:"Fireball",level:3,prepared:true,save:"DEX 15",time:"1A"};
 assert.equal(rules.diceSpec(fireball,rules.profile(fireball,"2024"),3,6,false).count,8);
 assert.equal(rules.diceSpec(fireball,rules.profile(fireball,"2024"),4,6,false).count,9);
 env.CharacterSpellRuntime.cast(fireball);
 assert.equal(c.remaining[3],1,"Base Fireball spends one L3 slot");
 assert.equal(c.remaining[4],1,"Does not silently upcast");
 assert.equal(c.result.spell.save,"DEX");
 assert.equal(c.result.spell.dc,15);
 assert.equal(c.result.spell.value,24,"8d6 summed to one number");
 assert.equal(c.result.spell.half,true);
 assert.match(c.result.detail,/8d6/,"Individual dice stay in log detail");
 c.castChoices["Fireball|3"]=4;
 env.CharacterSpellRuntime.cast(fireball);
 assert.equal(c.remaining[4],0,"Selected L4 slot spent");
 assert.equal(c.result.spell.value,27,"Upcast 9d6 summed");
 env.CharacterSpellRuntime.cast(fireball);
 assert.equal(c.remaining[3],1,"Unavailable upcast never falls back to L3");
 assert.equal(c.result.name,"NO SPELL SLOT");

 const cantrip={name:"Fire Bolt",level:0,prepared:true,time:"1A"};
 env.CharacterSpellRuntime.cast(cantrip);
 assert.equal(c.result.spell.hit,19);
 assert.equal(c.result.spell.value,6,"Level-6 cantrip uses 2 dice");
 assert.equal(c.result.spell.slotText,"AT WILL");
 assert.equal(c.remaining[1],3,"Cantrip never spends slots");
 const word={name:"Healing Word",level:1,prepared:true,time:"1BA"};
 assert.equal(rules.diceSpec(word,rules.profile(word,"2014"),2,6,false).count,2);
 assert.equal(rules.diceSpec(word,rules.profile(word,"2024"),2,6,false).count,4);
 env.CharacterSpellRuntime.cast(word);
 assert.equal(c.remaining[1],2);
 assert.equal(c.result.spell.kind,"heal");
 assert.equal(c.result.spell.value,10,"2d4 plus Wisdom");
 const unprepared={name:"Cure Wounds",level:1,prepared:false};
 env.CharacterSpellRuntime.cast(unprepared);
 assert.equal(c.remaining[1],2,"Unprepared spell cannot consume a slot");
 assert.equal(c.result.name,"NOT PREPARED");
 console.log("Spell cards: syntax, mirrored Pages files, 2014/2024 math, Fireball, upcast, slots, cantrips, healing passed.");
}catch(error){
 console.error("Character spell regression failed:",error);
 process.exitCode=1;
}
