/** Fight-only mutable state. Never modify RAW source cards. */
export function applyMonsterHp(instance,delta) {
 if(instance?.kind!=='monster'||!Number.isFinite(delta)||!Number.isInteger(delta))
  throw Error('Monster HP adjustment must be a whole number');
 const maximum=Number(instance.hpMax);
 if(!Number.isInteger(maximum)||maximum<0)throw Error('Invalid monster maximum HP');
 const current=Number(instance.hpCurrent);
 if(!Number.isFinite(current))throw Error('Invalid monster current HP');
 instance.hpCurrent=Math.max(0,Math.min(maximum,current+delta));
 return instance.hpCurrent;
}
