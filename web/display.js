/** iPhone-only route: pair once, then follow live player-safe server state. */
import { api, liveUpdates } from './api.js';
import { $, notify } from './dom.js';
import { renderPublic } from './public-view.js';
let stopStream;
let latestRevision = -1;
let requestSequence = 0;

async function refresh() {
  const requestId = ++requestSequence;
  try {
    const state = await api('/display/state');
    if (requestId < requestSequence || (typeof state.revision === 'number' && state.revision < latestRevision)) return;
    if (typeof state.revision === 'number') latestRevision = state.revision;
    $('#pair-screen').hidden = true;
    renderPublic($('#player-root'), state);
    $('#display-status').textContent = '● Connected';
  } catch (error) {
    if (error.status === 401) {
      stopStream?.(); stopStream = null;
      $('#pair-screen').hidden = false;
      $('#display-status').textContent = 'Not paired';
    } else { $('#display-status').textContent = 'Reconnecting…'; }
  }
}

function connect() {
  if (stopStream) stopStream();
  stopStream = liveUpdates(refresh, active => {
    $('#display-status').textContent = active ? '● Connected' : 'Reconnecting…';
  });
}

$('#pair-form').addEventListener('submit', async event => {
  event.preventDefault();
  $('#pair-error').textContent = '';
  try {
    await api('/pair/redeem', { method: 'POST', data: { code: $('#code').value.trim() } });
    $('#code').value = '';
    await refresh();
    connect();
  } catch (error) { $('#pair-error').textContent = error.message; }
});

refresh().then(() => { if ($('#pair-screen').hidden) connect(); }).catch(console.error);
