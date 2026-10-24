/** Public display payload allowlist. Never serialize a complete combatant or attack object. */
export function projectPublicFrame(battleName, round, actor, roll=null) {
  const action=roll && actor && roll.actorId===actor.id
   ? {type:'attack',name:String(roll.attackName||''),total:Number(roll.total),
      damage:Number(roll.damage),damageType:String(roll.damageType||''),
      critical:Boolean(roll.critical),fumble:Boolean(roll.fumble)}
   : null;
  return {battleName:String(battleName||'Battle'),round:Number(round)||1,
    name:actor?.name||null,kind:actor?.kind||null,sourceId:actor?.sourceId||null,
    initiative:actor?.initiative??null,action};
}
