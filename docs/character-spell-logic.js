/* Rule data and pure spell math. Card data supplies slot levels and bonuses. */
(function (root) {
  "use strict";
  // Common 2014/2024 spell dice. Effects beyond damage/save remain DM-resolved.
  const COMMON = Object.freeze({
    "Fireball": {type:"damage", dice:"8d6", per:1, save:"DEX", half:true},
    "Guiding Bolt": {type:"damage", dice:"4d6", per:1, attack:true},
    "Fire Bolt": {type:"damage", dice:"1d10", cantrip:true, attack:true},
    "Ray of Frost": {type:"damage", dice:"1d8", cantrip:true, attack:true},
    "Sacred Flame": {type:"damage", dice:"1d8", cantrip:true, save:"DEX"},
    "Toll the Dead": {type:"damage", dice:"1d8", cantrip:true, save:"WIS"},
    "Produce Flame": {type:"damage", dice:"1d8", cantrip:true, attack:true},
    "Spirit Guardians": {type:"damage", dice:"3d8", per:1, save:"WIS", half:true}
  });
  const BY_EDITION = Object.freeze({
    "2014": {
      "Healing Word": {type:"heal", dice:"1d4", per:1, targets:1},
      "Cure Wounds": {type:"heal", dice:"1d8", per:1, targets:1},
      "Mass Healing Word": {type:"heal", dice:"1d4", per:1, targets:6}
    },
    "2024": {
      "Healing Word": {type:"heal", dice:"2d4", per:2, targets:1},
      "Cure Wounds": {type:"heal", dice:"2d8", per:2, targets:1},
      "Mass Healing Word": {type:"heal", dice:"2d4", per:1, targets:6}
    }
  });
  function profile(sp, edition) {
    const known = {...(COMMON[sp.name] || {}), ...(BY_EDITION[edition]?.[sp.name] || {})};
    return sp.custom ? {...known, ...sp.custom} : (Object.keys(known).length ? known : null);
  }
  function slotOptions(card, sp) {
    if (sp.level === 0) return [0];
    return Object.keys(card.slots || {}).map(Number)
      .filter(n => Number.isInteger(n) && n >= sp.level && n <= 9)
      .sort((a, b) => a - b);
  }
  function diceSpec(sp, rule, slot, characterLevel, wounded) {
    const match = /^(\d+)d(4|6|8|10|12|20)$/i.exec(String(rule?.dice || ""));
    if (!match) return null; // Never fabricate dice for an unknown spell.
    let count = Number(match[1]), sides = Number(match[2]);
    if (sp.level === 0 || rule.cantrip) {
      const scale = characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3
        : characterLevel >= 5 ? 2 : 1;
      count *= scale;
      if (sp.name === "Toll the Dead" && wounded) sides = 12;
    } else {
      count += Math.max(0, slot - sp.level) * (Number(rule.per) || 0);
    }
    return count > 0 && count <= 40 ? {count, sides} : null;
  }
  function saveAbility(sp, rule) {
    if (rule?.save) return String(rule.save).toUpperCase();
    const found = String(sp.save || "").match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/i);
    return found ? found[1].toUpperCase() : null;
  }
  function needsAttack(sp, rule) {
    return Boolean(rule?.attack || /^\s*\+\d+/.test(String(sp.save || "")));
  }
  root.CharacterSpellLogic = Object.freeze({
    profile, slotOptions, diceSpec, saveAbility, needsAttack
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
