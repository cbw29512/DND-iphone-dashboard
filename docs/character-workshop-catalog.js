/* Factual 2014 PHB player options catalog. Names and rules metadata, not book text. */
(function(root){
"use strict";
const CLASSES=[
 {id:"barbarian",name:"Barbarian",icon:"🪓",die:12,primary:"STR",casting:null,armor:"medium",shield:true,defaultWeapon:"greataxe",archetypeLevel:3,description:"Rage and physical toughness"},
 {id:"bard",name:"Bard",icon:"🎻",die:8,primary:"CHA",casting:"full",armor:"light",shield:false,defaultWeapon:"rapier",archetypeLevel:3,description:"Inspiration and versatile spellcasting"},
 {id:"cleric",name:"Cleric",icon:"☀️",die:8,primary:"WIS",casting:"full",armor:"medium",shield:true,defaultWeapon:"mace",archetypeLevel:1,description:"Divine magic and domain features"},
 {id:"druid",name:"Druid",icon:"🌿",die:8,primary:"WIS",casting:"full",armor:"medium",shield:true,defaultWeapon:"scimitar",archetypeLevel:2,description:"Nature magic and Wild Shape"},
 {id:"fighter",name:"Fighter",icon:"🛡️",die:10,primary:"STR",casting:null,armor:"heavy",shield:true,defaultWeapon:"longsword",archetypeLevel:3,description:"Arms mastery and extra attacks"},
 {id:"monk",name:"Monk",icon:"👊",die:8,primary:"DEX",casting:null,armor:"none",shield:false,defaultWeapon:"quarterstaff",archetypeLevel:3,description:"Martial arts and ki"},
 {id:"paladin",name:"Paladin",icon:"⚜️",die:10,primary:"CHA",casting:"half",armor:"heavy",shield:true,defaultWeapon:"longsword",archetypeLevel:3,description:"Sacred oath and divine smites"},
 {id:"ranger",name:"Ranger",icon:"🏹",die:10,primary:"WIS",casting:"half",armor:"medium",shield:true,defaultWeapon:"longbow",archetypeLevel:3,description:"Wilderness combat and tracking"},
 {id:"rogue",name:"Rogue",icon:"🗡️",die:8,primary:"DEX",casting:null,armor:"light",shield:false,defaultWeapon:"rapier",archetypeLevel:3,description:"Precision strikes and expertise"},
 {id:"sorcerer",name:"Sorcerer",icon:"🔥",die:6,primary:"CHA",casting:"full",armor:"none",shield:false,defaultWeapon:"dagger",archetypeLevel:1,description:"Innate magic and metamagic"},
 {id:"warlock",name:"Warlock",icon:"🌙",die:8,primary:"CHA",casting:"pact",armor:"light",shield:false,defaultWeapon:"dagger",archetypeLevel:1,description:"Pact magic and invocations"},
 {id:"wizard",name:"Wizard",icon:"📖",die:6,primary:"INT",casting:"full",armor:"none",shield:false,defaultWeapon:"quarterstaff",archetypeLevel:2,description:"Arcane study and spellbook"}
];
const SUBCLASSES=[
 ["barbarian","berserker","Path of the Berserker"],
 ["barbarian","totem-warrior","Path of the Totem Warrior"],
 ["bard","lore","College of Lore"],
 ["bard","valor","College of Valor"],
 ["cleric","knowledge","Knowledge Domain"],
 ["cleric","life","Life Domain"],
 ["cleric","light","Light Domain"],
 ["cleric","nature","Nature Domain"],
 ["cleric","tempest","Tempest Domain"],
 ["cleric","trickery","Trickery Domain"],
 ["cleric","war","War Domain"],
 ["druid","land","Circle of the Land"],
 ["druid","moon","Circle of the Moon"],
 ["fighter","champion","Champion"],
 ["fighter","battle-master","Battle Master"],
 ["fighter","eldritch-knight","Eldritch Knight"],
 ["monk","open-hand","Way of the Open Hand"],
 ["monk","shadow","Way of Shadow"],
 ["monk","four-elements","Way of the Four Elements"],
 ["paladin","devotion","Oath of Devotion"],
 ["paladin","ancients","Oath of the Ancients"],
 ["paladin","vengeance","Oath of Vengeance"],
 ["ranger","hunter","Hunter"],
 ["ranger","beast-master","Beast Master"],
 ["rogue","thief","Thief"],
 ["rogue","assassin","Assassin"],
 ["rogue","arcane-trickster","Arcane Trickster"],
 ["sorcerer","draconic","Draconic Bloodline"],
 ["sorcerer","wild-magic","Wild Magic"],
 ["warlock","archfey","The Archfey"],
 ["warlock","fiend","The Fiend"],
 ["warlock","great-old-one","The Great Old One"],
 ["wizard","abjuration","School of Abjuration"],
 ["wizard","conjuration","School of Conjuration"],
 ["wizard","divination","School of Divination"],
 ["wizard","enchantment","School of Enchantment"],
 ["wizard","evocation","School of Evocation"],
 ["wizard","illusion","School of Illusion"],
 ["wizard","necromancy","School of Necromancy"],
 ["wizard","transmutation","School of Transmutation"]
].map(([classId,id,name])=>Object.freeze({classId,id,name}));
const classes=Object.freeze(CLASSES.map(c=>Object.freeze(c)));
const subclasses=Object.freeze(SUBCLASSES);
const byClass=id=>classes.find(c=>c.id===id)||classes.find(c=>c.id==="fighter");
const bySubclass=id=>subclasses.find(s=>s.id===id)||null;
const forClass=id=>subclasses.filter(s=>s.classId===id);
// Limited public rules calculations, not character feature automation.
const FULL_SLOTS=[
 [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],
 [4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],
 [4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],
 [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],
 [4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]
];
const THIRD_SLOTS=[
 [],[],[2],[3],[3],[3],[4,2],[4,2],[4,2],[4,3],
 [4,3],[4,3],[4,3,2],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3],[4,3,3],[4,3,3,1]
];
function spellSlots(classId,subclassId,level){
 const c=byClass(classId),lv=Math.max(1,Math.min(20,Math.floor(Number(level)||1)));
 let raw=[];
 if(c.casting==="full")raw=FULL_SLOTS[lv-1];
 else if(c.casting==="half")raw=lv>=2?FULL_SLOTS[Math.floor(lv/2)-1]:[];
 else if((classId==="fighter"&&subclassId==="eldritch-knight")||(classId==="rogue"&&subclassId==="arcane-trickster"))raw=THIRD_SLOTS[lv-1];
 else if(c.casting==="pact"){
  const slotLevel=lv<=2?1:lv<=4?2:lv<=6?3:lv<=8?4:5;
  const number=lv<2?1:lv<11?2:lv<17?3:4;
  return Object.freeze({[slotLevel]:number});
 }
 return Object.freeze(Object.fromEntries(raw.map((count,index)=>[index+1,count])));
}
root.CharacterWorkshopCatalog=Object.freeze({classes,subclasses,byClass,bySubclass,forClass,spellSlots});
})(typeof globalThis!=="undefined"?globalThis:this);
