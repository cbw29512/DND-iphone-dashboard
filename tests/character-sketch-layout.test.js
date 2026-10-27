"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
try{
 const base=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(base,p),"utf8");
 const files=["character-builder.html","character-sketch.css","character-form-fields.js"];
 for(const file of files)assert.equal(read(file),read("docs/"+file),"Pages mirror: "+file);
 const html=read("character-builder.html"),css=read("character-sketch.css");
 const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
 assert.ok(inline);new vm.Script(inline[1],{filename:"character-builder.inline.js"});
 const fields=read("character-form-fields.js");
 new vm.Script(fields);
 const pos=token=>html.indexOf(token);
 assert.ok(pos('id="who"')>0);
 assert.ok(pos('class="portrait-hero"')>pos('id="who"'));
 assert.ok(pos('id="stats" class="stats portrait-stats"')>pos('class="portrait-hero"'));
 assert.ok(pos('id="actions" class="buttons"')>pos('id="stats" class="stats portrait-stats"'));
 assert.ok(pos('Combat tools · HP, saves, rests')>pos('id="actions" class="buttons"'),
  "Rest/damage/skill controls must not precede action buttons");
 assert.ok(pos('Other rolls &amp; features')>pos('id="actions" class="buttons"'));
 assert.ok(pos('id="editPane"')<pos('id="play"'),"Left editor then right play card");
 assert.ok(html.includes('character-sketch.css?v=sketch-20261026'));
 assert.ok(html.includes('["HP",character.hp+"/"+character.hpMax],["AC",character.ac],["MOVE"'));
 assert.ok(html.includes('heading(root,"LEVEL "+previous+" · "'));
 assert.ok(html.includes('className="play-action-options"'));
 assert.ok(html.includes('options.append(details);article.append(options)'));
 assert.ok(!html.includes('heading(root,"Quick checks")'),"No duplicate save buttons under spells");
 assert.ok(fields.includes('["speed","MOVE ft",card.speed??""]'));
 assert.ok(!fields.includes('["initiative","INIT",card.initiative]'),
  "Initiative should be in advanced edit details, not portrait tile");
 assert.match(css,/#actions \.quick-grid\{display:grid;/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/#actions \.quick-section>h3\{display:none\}/);
 assert.match(css,/#actions button\.weapon-name/);
 assert.match(css,/#actions button\.spell-primary/);
 assert.match(css,/#actions \.play-action-options/);
 assert.match(css,/\.phone-portrait/);
 console.log("Original character sketch: name, portrait, exactly HP AC Move, single action buttons, compact spell rows and hidden utilities passed.");
}catch(error){console.error("Original card sketch regression failed",error);process.exitCode=1;}
