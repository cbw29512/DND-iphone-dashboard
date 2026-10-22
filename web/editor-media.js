/** Media Flex Card editor: upload, select and navigate image assets. */
import { api } from './api.js';
import { button, empty, node, notify } from './dom.js';
let preferred = null;

export function mediaEditor(root, state, kind, refresh) {
  const media = state.media.filter(item => item.category === kind);
  root.replaceChildren(node('p', { cls: 'section-caption', text: kind === 'map'
    ? 'Upload maps and location artwork. Animated GIF files retain their motion.'
    : 'Drag monster art, NPC portraits, or locations from your laptop.' }));
  const drop = node('label', { cls: 'dropzone' }, [
    node('div', {}, [node('div', { cls: 'big', text: '↥' }),
      node('strong', { text: 'Drop your artwork here' }), node('span', { text: 'JPG, PNG, WebP, GIF · 12 MB maximum per file' })])]);
  const input = node('input', { attrs: { type: 'file', multiple: '', accept: 'image/jpeg,image/png,image/webp,image/gif', 'aria-label': 'Upload artwork' } });
  input.addEventListener('change', async () => { await upload([...input.files], kind, refresh); });
  drop.addEventListener('dragenter', event => { event.preventDefault(); drop.classList.add('dragging'); });
  drop.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; drop.classList.add('dragging'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', async event => {
    event.preventDefault(); event.stopPropagation(); drop.classList.remove('dragging');
    const files = [...event.dataTransfer.files];
    if (!files.length) { notify('Drop a saved image file, not a browser image link.', true); return; }
    await upload(files, kind, refresh);
  });
  // Never position a native file input across the drop zone: browsers may
  // navigate to a dropped image instead of forwarding its drop event.
  input.classList.add('file-picker');
  drop.append(input); root.append(drop);
  const toolbar = node('div', { cls: 'toolbar' }, [node('strong', { text: 'Art Library' }), node('small', { text: `${media.length} items` })]);
  root.append(toolbar);
  if (!media.length) { root.append(empty('No artwork uploaded yet. Drop an image above to start.')); return; }
  const selected = preferred && media.some(item => item.id === preferred) ? preferred :
    (state.settings.active_card === kind && state.settings.active_asset) || media[0].id;
  preferred = selected;
  const index = media.findIndex(item => item.id === selected);
  const controls = node('div', { cls: 'controls' }, [
    button('← Previous', () => pick(media[Math.max(0, index - 1)], state, kind, refresh)),
    button('Next →', () => pick(media[Math.min(media.length - 1, index + 1)], state, kind, refresh)),
    button('Remove image', async () => { if (confirm('Delete this image from the library?')) { await api(`/media/${selected}`, { method: 'DELETE' }); preferred = null; await refresh(); } }, 'quiet')
  ]);
  root.append(controls);
  const gallery = node('div', { cls: 'gallery-items' });
  for (const item of media) {
    const tile = node('button', { cls: `gallery-item${item.id === selected ? ' active' : ''}`, attrs: { type: 'button', 'aria-label': `Select ${item.name}` } }, [
      node('img', { attrs: { src: `/api/media/${encodeURIComponent(item.id)}`, alt: '' } }),
      node('span', { text: item.name })]);
    tile.addEventListener('click', () => pick(item, state, kind, refresh));
    gallery.append(tile);
  }
  root.append(gallery);
}

async function upload(files, kind, refresh) {
  for (const file of files) {
    try {
      const form = new FormData(); form.append('file', file); form.append('category', kind);
      const result = await api('/media', { method: 'POST', form });
      preferred = result.id;
      notify(`Added ${result.name}`);
    } catch (error) { notify(`${file.name}: ${error.message}`, true); }
  }
  await refresh();
}

async function pick(item, state, kind, refresh) {
  if (!item) return;
  preferred = item.id;
  if (state.settings.active_card === kind) await api('/selection', { method: 'POST', data: { asset_id: item.id } });
  await refresh();
}

export function selectedMedia() { return preferred; }
