/** Minimal DOM helpers. All user-provided values are inserted as text, never HTML. */
export const $ = selector => document.querySelector(selector);

export function node(tag, { text = null, cls = '', attrs = {} } = {}, children = []) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== null) element.textContent = String(text);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  for (const child of children) if (child) element.append(child);
  return element;
}

export function button(text, onClick, cls = 'outline') {
  const element = node('button', { text, cls, attrs: { type: 'button' } });
  element.addEventListener('click', async () => {
    try { element.disabled = true; await onClick(); }
    catch (error) { console.error('Card action failed', error); notify(error.message, true); }
    finally { element.disabled = false; }
  });
  return element;
}

let noticeTimeout;
export function notify(message, error = false) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = error ? '#592e36' : '#33443f';
  toast.hidden = false;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { toast.hidden = true; }, 4500);
}

export function empty(message) { return node('p', { text: message, cls: 'empty-inline' }); }
