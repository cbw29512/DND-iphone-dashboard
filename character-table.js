/* Read-only action reveal for a shared screen / TV. Never resolves rules or spends resources. */
(function(root){
"use strict";
function cell(parent,label,value){
 const item=document.createElement("div");item.className="table-roll";
 const title=document.createElement("span");title.textContent=label;
 const number=document.createElement("strong");
 const missing=value===null||value===undefined||value==="";
 number.textContent=missing?"—":String(value);
 if(missing)item.classList.add("muted");
 item.append(title,number);parent.append(item);
}
function render(snapshot){
 const $=id=>document.getElementById(id);
 const stage=$("tableStage");if(!stage||!snapshot||typeof snapshot!=="object")return;
 const result=snapshot.result||{},w=result.weapon,sp=result.spell;
 const numeric=x=>typeof x==="number"&&Number.isFinite(x);
 const isHeal=sp?.kind==="heal";
 const kind=w?"weapon":sp?(isHeal?"heal":"spell"):"other";
 stage.classList.remove("action-weapon","action-heal","action-spell","action-animate");
 if(kind!=="other")stage.classList.add("action-"+kind);
 // Force a transition only for updates, not a loop that makes the table unreadable.
 void stage.offsetWidth;
 stage.classList.add("action-animate");
 $("tableActor").textContent=String(snapshot.name||"Character").slice(0,90);
 $("tableRound").textContent="TURN "+(Number.isInteger(snapshot.turn)?snapshot.turn:"—");
 $("tableActionName").textContent=String(result.name||"READY FOR ADVENTURE").slice(0,110);
 $("tableGlyph").textContent=w?"⚔":sp?(isHeal?"✚":"✦"):"◈";
 $("tableActionType").textContent=w?"Weapon attack":sp?(isHeal?"Healing spell":"Spell cast"):"Latest action";
 const numbers=$("tableRolls");numbers.replaceChildren();
 let note="Awaiting the next button press from the player card.";
 if(w){
  cell(numbers,"ATTACK ROLL",w.hit);
  cell(numbers,"DAMAGE ROLLED",w.damage);
  cell(numbers,"EXTRA ROLLED",w.special);
  note="Attack roll is not a confirmed hit. The DM determines whether the attack hits before applying damage.";
 }else if(sp){
  const first=numeric(sp.hit)?["SPELL ATTACK",sp.hit]:
   sp.save?["TARGET SAVE",String(sp.save).slice(0,3)+" DC "+(sp.dc??"—")]:
   ["SPELL",sp.kind==="effect"?"EFFECT":"CAST"];
  cell(numbers,first[0],first[1]);
  cell(numbers,isHeal?"HEAL ROLLED":sp.kind==="damage"?"DAMAGE ROLLED":"EFFECT",sp.value??(sp.kind==="effect"?"See rules":null));
  cell(numbers,"SLOT",sp.slotText);
  note=sp.save?"The target makes a saving throw; the DM applies the spell effect.":
   isHeal?"Healing amount rolled. Apply healing to the appropriate targets.":
   "The DM applies damage and any conditions according to the spell rules.";
 }else{
  cell(numbers,"RESULT",String(result.total||"READY").slice(0,90));
  if(result.name&&result.name!=="READY")
   note="Displayed result comes from the player's character card.";
 }
 $("tableRuleNote").textContent=note;
}
function initializeFullscreen(){
 const b=document.getElementById("tableFullscreen");
 if(!b)return;
 b.addEventListener("click",()=>{
  const stage=document.getElementById("tableStage");
  if(document.fullscreenElement){document.exitFullscreen?.().catch?.(()=>{});}
  else{stage?.requestFullscreen?.().catch?.(()=>{});}
 });
 document.addEventListener("fullscreenchange",()=>{
  b.textContent=document.fullscreenElement?"Exit Fullscreen":"Fullscreen";
 });
}
root.TableActionDisplay=Object.freeze({render,initializeFullscreen});
})(typeof globalThis!=="undefined"?globalThis:this);
