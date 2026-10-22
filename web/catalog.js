/** Registered card kinds; the backend validates this same allowlist. */
export const cards = [
  { id: 'gallery', title: 'Artwork Gallery', subtitle: 'Monsters, NPCs & locations', icon: '♜', kicker: 'VISUAL LIBRARY' },
  { id: 'initiative', title: 'Initiative', subtitle: 'Track every turn', icon: '⚔', kicker: 'COMBAT MANAGER' },
  { id: 'map', title: 'Battle Maps', subtitle: 'Maps & animated scenes', icon: '◈', kicker: 'BATTLEFIELD DISPLAY' },
  { id: 'scene', title: 'Scene Text', subtitle: 'Handouts & descriptions', icon: '☷', kicker: 'STORYTELLER' },
  { id: 'dice', title: 'Dice Display', subtitle: 'Rolls & dramatic reveals', icon: '⬡', kicker: 'THE ROLLING TABLE' }
];
export const card = id => cards.find(item => item.id === id);
