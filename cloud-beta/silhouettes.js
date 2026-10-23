/** Adapted from D20-ironpit/frontend/figure-portraits.js: fantasy SVG silhouette primitives.
 * Attribution: user-owned Iron Pit repository; separate visual asset from combat rules.
 */
const SHAPES = Object.freeze({
  goblin: '<path d="M28 22 18 10l8 4 10 10 6-12 6 12 10-10 8-4-10 12h-36z"/><circle cx="50" cy="30" r="10"/><path d="M38 84 41 50q9-8 18 0l3 34-8 2-3-20-2 20H46l-2-20-3 20z"/><path d="M64 50c16-12 26-2 20 16l-8 18-5-3 6-16c-8-2-12 2-14 6z"/>',
  player: '<circle cx="50" cy="24" r="11"/><path d="M34 86 38 46q12-10 24 0l4 40-9 2-5-26-2 26H46l-2-26-5 26z"/><path d="m66 46 15-16 4 4-13 20z"/>'
});
export function silhouetteFor(sourceId) {
  const key=sourceId==='srd2014:goblin'?'goblin':'player';
  const frame=document.createElement('span');frame.className='portrait-silhouette';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  // Static, audited SVG primitives only: never insert external/user content.
  svg.innerHTML=SHAPES[key];
  frame.append(svg);return frame;
}
