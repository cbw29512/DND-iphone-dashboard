/* One-click spell casting. Mutable resources live on the character card. */
(function(root){
"use strict";
function cast(sp,attackMode="normal"){
 try{
  if(sp.level>0&&!sp.prepared){
   show("NOT PREPARED",sp.name,"Not prepared; no slot spent.");return;
  }
  const key=sp.name+"|"+sp.level;
  const levels=CharacterSpellLogic.slotOptions(character,sp);
  const requested=Number(character.castChoices?.[key]??sp.level);
  const chosen=levels.includes(requested)?requested:(levels[0]??sp.level);
  const ongoing=sp.name==="Spirit Guardians"&&character.concentration===sp.name;
  const free=!ongoing&&sp.freeCastRemaining>0;
  const rule=CharacterSpellLogic.profile(sp,character.rules);
  const spec=rule?CharacterSpellLogic.diceSpec(sp,rule,chosen,character.level,targetWounded):null;
  const spent=ongoing?{level:character.concentrationSlot||sp.level,ongoing:true}:
   free?{level:sp.level,free:true}:useSlot(sp.level,chosen);
  if(!spent)return;
  if(free)sp.freeCastRemaining--;
  if(!ongoing){
   if(/(?:^|\W)(?:1BA|Bonus Action)(?:\W|$)/i.test(sp.time||""))character.bonusUsed=true;
   else if(/(?:^|\W)(?:1R|Reaction)(?:\W|$)/i.test(sp.time||""))character.reactionUsed=true;
   else character.actionUsed=true;
   if(sp.level>0&&!spent.free)character.slotUsed=true;
  }
  const level=spent.level,kind=rule?.type||"effect";
  const save=CharacterSpellLogic.saveAbility(sp,rule);
  const attack=CharacterSpellLogic.needsAttack(sp,rule)?d20(attackMode):null;
  const hit=attack?attack.value+(Number(character.spellAttack)||0):null;
  const critical=Boolean(attack?.value===20);
  const amounts=[];
  let detail=sp.name+": "+(sp.notes||sp.range||sp.duration||"Consult spell rules")+". ";
  if(attack)detail+="Spell attack: "+attack.text+" "+signed(Number(character.spellAttack)||0)+" = "+hit+". ";
  if(spec&&rule){
   const targets=kind==="heal"?Math.min(healTargets,Number(rule.targets)||1):1;
   for(let n=0;n<targets;n++){
    const rolled=dice((critical?spec.count*2:spec.count)+"d"+spec.sides);
    if(!rolled)throw Error("Unrecognized spell dice");
    const life=kind==="heal"&&character.life&&!spent.free?2+level:0;
    const wisdom=kind==="heal"&&(!sp.custom||rule.addAbility)?(character.ability.WIS?.mod||0):0;
    const value=rolled.total+(kind==="heal"?life+wisdom:0);
    amounts.push(value);
    detail+=(targets>1?"Target "+(n+1)+": ":"")+rolled.text+
     (kind==="heal"?" + "+wisdom+" ability + "+life+" Life = "+value:"")+". ";
   }
   if(kind==="heal"){
    const self=healWho==="self",allies=targets-(self?1:0);
    const blessed=character.blessedHealer&&allies>0&&!spent.free?2+level:0;
    if(self||blessed){
     character.hp=Math.min(character.hpMax,character.hp+(self?amounts[0]:0)+blessed);
     detail+="Self HP "+character.hp+"/"+character.hpMax+". ";
    }
    if(blessed)detail+="Blessed Healer +"+blessed+" HP. ";
   }
   if(rule.half&&save)detail+="Successful "+save+" save halves damage (round down). ";
  }else detail+="Dice not configured; consult the source spell. ";
  if((sp.name==="Spirit Guardians"||/Concentration/i.test(sp.duration||""))&&!ongoing){
   character.concentration=sp.name;character.concentrationSlot=level;
  }
  const slotText=sp.level===0?"AT WILL":spent.free?"FREE":ongoing?"ACTIVE":
   "L"+level+" · "+character.remaining[level]+" left";
  detail+=sp.level?(ongoing?"Ongoing concentration: no slot spent. ":
   spent.free?"Free cast used. ":"Level "+level+" slot spent, "+character.remaining[level]+" left. "):
   "Cantrip: no slot spent. ";
  detail+=(sp.save||"")+" "+(sp.duration||"");
  const value=amounts.length?amounts.reduce((a,b)=>a+b,0):null;
  const spell={save,dc:save?character.spellDC:null,hit,kind,value,slotText,
   level,critical,half:Boolean(rule?.half)};
  show(sp.name,kind==="heal"?(value??"—")+" HEAL":kind==="damage"?(value??"—")+" DAMAGE":"EFFECT",detail,{spell});
 }catch(error){
  console.error("Spell resolution failed",error);
  show("SPELL ERROR","NOT RESOLVED","Could not cast "+sp.name+": "+error.message);
 }
}
root.CharacterSpellRuntime=Object.freeze({cast});
})(typeof globalThis!=="undefined"?globalThis:this);
