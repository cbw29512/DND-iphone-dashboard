/** Windows DM controller. State flows from the API, never localStorage. */
import { api, liveUpdates } from './api.js';
import { cards, card } from './catalog.js';
import { $, button, node, notify } from './dom.js';
import { mediaEditor, selectedMedia } from './editor-media.js';
import { combatEditor } from './editor-combat.js';
import { diceEditor, sceneEditor } from './editor-simple.js';
import { renderPublic } from './public-view.js';

let selected = 'gallery';
let dmState = null;
let previewMode = false;
let lastRevision = -1;
let stopStream;

async function refresh(force = false) {
  try {
    const [dm, player] = await Promise.all([api('/dm/state'), api('/display/state')]);
    dmState = dm;
    const changed = lastRevision !== dm.settings.revision;
    lastRevision = dm.settings.revision;
    if (force || changed) renderDashboard();
    if (previewMode) await showPreview();
    else renderPublic($('#phone-preview'), player, true);
    $('#live-status').textContent = previewMode ? 'PREVIEW' : player.card ? 'SHARING' : 'STANDBY';
    $('#live-status').classList.toggle('live', Boolean(player.card) && !previewMode);
    $('#preview-caption').textContent = previewMode ? `${card(selected).title} · Private preview (not shared)` : player.card ? `${card(player.card)?.title ?? 'Card'} · Live` : 'Nothing shared yet';
  } catch (error) {
    if (error.status === 401) showLogin();
    else notify('Synchronization failed: ' + error.message, true);
  }
}

function renderDashboard() {
  const list = $('#card-list'); list.replaceChildren();
  for (const item of cards) {
    const choice = node('button', { cls: `card-choice${item.id === selected ? ' active' : ''}`, attrs: { type: 'button', 'aria-pressed': item.id === selected } }, [
      node('span', { cls: 'card-icon', text: item.icon }),
      node('span', {}, [node('strong', { text: item.title }), node('small', { text: item.subtitle })])]);
    choice.addEventListener('click', () => { selected = item.id; renderDashboard(); if (previewMode) showPreview().catch(console.error); });
    list.append(choice);
  }
  $('#editor-title').textContent = card(selected)?.title ?? 'Flex Card';
  $('#editor-kicker').textContent = card(selected)?.kicker ?? 'CURRENT CARD';
  const live = dmState.settings.active_card === selected;
  $('#share').textContent = live ? '✓ On Player Screen' : '↗ Share to Screen';
  $('#preview-button').textContent = previewMode ? '◉ Back to Live' : '◉ Preview';
  const content = $('#editor-content');
  if (selected === 'gallery' || selected === 'map') mediaEditor(content, dmState, selected, refresh);
  else if (selected === 'initiative') combatEditor(content, dmState, refresh);
  else if (selected === 'scene') sceneEditor(content, dmState, refresh);
  else if (selected === 'dice') diceEditor(content, dmState, refresh);
}

function connect() {
  stopStream?.();
  stopStream = liveUpdates(() => refresh(), isLive => {
    $('#connection').classList.toggle('live', isLive);
    $('#connection').lastChild.textContent = isLive ? ' Live connection' : ' Reconnecting';
  });
}

function showLogin() {
  stopStream?.(); stopStream = null;
  $('#app').hidden = true;
  $('#login').hidden = false;
}

async function authenticated() {
  try {
    await api('/dm/state');
    $('#login').hidden = true;
    $('#app').hidden = false;
    await refresh(true);
    connect();
  } catch (error) {
    if (error.status === 401) showLogin();
    else { showLogin(); $('#login-error').textContent = error.message; }
  }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#login-error').textContent = '';
  try {
    await api('/auth/login', { method: 'POST', data: { passphrase: $('#passphrase').value } });
    $('#passphrase').value = '';
    await authenticated();
  } catch (error) { $('#login-error').textContent = error.message; }
});


async function showPreview() {
  const asset = selectedMedia();
  const query = new URLSearchParams({ card: selected });
  if (asset && dmState.media.some(x => x.id === asset && x.category === selected)) query.set('asset_id', asset);
  const safe = await api(`/dm/preview?${query}`);
  renderPublic($('#phone-preview'), safe, true);
}

$('#preview-button').addEventListener('click', async () => {
  previewMode = !previewMode;
  await refresh(true);
});

$('#share').addEventListener('click', async () => {
  try {
    await api('/share', { method: 'POST', data: { card: selected } });
    const asset = selectedMedia();
    if (asset && (selected === 'gallery' || selected === 'map') && dmState.media.some(x => x.id === asset && x.category === selected))
      await api('/selection', { method: 'POST', data: { asset_id: asset } });
    previewMode = false;
    notify(`${card(selected).title} shared to screen`);
    await refresh(true);
  } catch (error) { notify(error.message, true); }
});
$('#clear').addEventListener('click', async () => {
  try { await api('/share', { method: 'POST', data: { card: null } }); await refresh(true); notify('Player display cleared'); }
  catch (error) { notify(error.message, true); }
});
$('#logout').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); showLogin(); }
  catch (error) { notify(error.message, true); }
});
$('#pair-button').addEventListener('click', () => {
  $('#pair-code').textContent = '······';
  const url = `${location.origin}/display`;
  $('#pair-url').textContent = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'On iPhone, replace localhost with your laptop Wi-Fi IPv4 address: http://LAPTOP-IP:8000/display' : url;
  $('#pair-dialog').showModal();
});
$('#close-dialog').addEventListener('click', () => $('#pair-dialog').close());
$('#generate-pair').addEventListener('click', async () => {
  try { const result = await api('/pair/create', { method: 'POST' }); $('#pair-code').textContent = result.code; }
  catch (error) { notify(error.message, true); }
});
$('#revoke-pair').addEventListener('click', async () => {
  if (!confirm('Disconnect every paired player device?')) return;
  try { await api('/pair/revoke', { method: 'POST' }); notify('Paired devices disconnected'); $('#pair-dialog').close(); }
  catch (error) { notify(error.message, true); }
});

authenticated().catch(error => { console.error('Unable to initialize dashboard', error); showLogin(); });
