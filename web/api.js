/** Same-origin fetch boundary. Cookies are HttpOnly and never handled in JS. */
export async function api(path, { method = 'GET', data, form } = {}) {
  try {
    const response = await fetch(`/api${path}`, {
      method, credentials: 'same-origin',
      headers: { 'X-Flex-Request': '1', ...(form ? {} : { 'Content-Type': 'application/json' }) },
      body: form ?? (data === undefined ? undefined : JSON.stringify(data)),
      cache: 'no-store'
    });
    let result;
    try { result = await response.json(); }
    catch { result = {}; }
    if (!response.ok) {
      const error = new Error(typeof result.detail === 'string' ? result.detail : `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return result;
  } catch (error) {
    console.error(`API ${method} ${path} failed`, error);
    throw error;
  }
}

/** EventSource reconnects on transient Wi-Fi loss; polling repairs missed pushes. */
export function liveUpdates(onRefresh, onConnection) {
  let stream;
  try {
    stream = new EventSource('/api/events');
    stream.addEventListener('refresh', () => {
      onConnection(true);
      Promise.resolve(onRefresh()).catch(error => console.error('Sync failed', error));
    });
    stream.onerror = () => { onConnection(false); };
  } catch (error) { console.error('Cannot start live updates', error); onConnection(false); }
  const poll = setInterval(() => Promise.resolve(onRefresh()).catch(error => {
    console.error('Background resync failed', error);
    onConnection(false);
  }), 12000);
  const visible = () => { if (!document.hidden) onRefresh().catch(console.error); };
  document.addEventListener('visibilitychange', visible);
  return () => { stream?.close(); clearInterval(poll); document.removeEventListener('visibilitychange', visible); };
}
