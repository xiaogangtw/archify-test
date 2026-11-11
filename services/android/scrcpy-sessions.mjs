// One in-flight startup per device. Brief viewer switches reuse the same
// session; callbacks from a retired session cannot close its replacement.
export function createScrcpySessions({ open, metadata, packet, notify, graceMs = 800, retryMs = 1000 }) {
  const entries = new Map();
  let stopped = false;
  function release(entry) {
    for (const event of entry.touches.values()) { try { entry.handle?.send({ ...event, action: 1 }); } catch {} }
    entry.touches.clear();
  }
  function retire(serial, entry) {
    if (entries.get(serial) !== entry) return;
    entry.wanted = false;
    clearTimeout(entry.timer); clearTimeout(entry.retry); release(entry); entry.handle?.close();
    if (!entry.starting) entries.delete(serial);
  }
  function recover(serial, entry) {
    if (entries.get(serial) !== entry || stopped) return;
    entry.handle = undefined; entry.metadata = undefined; release(entry);
    if (!entry.wanted) { retire(serial, entry); return; }
    if (entry.attempts >= 3) { notify(serial, '影片連線無法恢復，請暫停後再試。'); return; }
    notify(serial, '影片連線中斷，正在自動恢復。');
    entry.retry = setTimeout(() => { entry.retry = undefined; void start(serial, entry); }, retryMs * ++entry.attempts);
  }
  async function start(serial, entry) {
    if (entry.starting || entries.get(serial) !== entry || stopped) return;
    entry.starting = true;
    let ended = false;
    try {
      const handle = await open(serial, {
        onMetadata(info) { if (entries.get(serial) === entry) { entry.metadata = info; if (entry.wanted) metadata(serial, info); } },
        onPacket(...args) { if (entries.get(serial) === entry && entry.wanted) packet(serial, ...args); },
        onClose() { ended = true; if (!entry.starting) recover(serial, entry); },
      });
      entry.starting = false;
      if (entries.get(serial) !== entry || stopped) { handle.close(); if (entries.get(serial) === entry) entries.delete(serial); return; }
      if (ended) { handle.close(); recover(serial, entry); return; }
      entry.handle = handle;
      if (!entry.wanted) retire(serial, entry);
    } catch (error) {
      entry.starting = false;
      if (entries.get(serial) !== entry || stopped) return;
      if (!entry.wanted) { retire(serial, entry); return; }
      // Preparation/startup errors retain their actionable message. A new
      // subscription can retry; never emit a retired startup's error.
      if (entry.wanted) notify(serial, error.message);
    }
  }
  return {
    subscribe(serial) {
      if (stopped || !/^emulator-\d+$/.test(serial)) return;
      let entry = entries.get(serial);
      if (!entry) {
        if (entries.size >= 4) return;
        entry = { wanted: true, starting: false, touches: new Map(), attempts: 0 };
        entries.set(serial, entry); void start(serial, entry); return;
      }
      entry.wanted = true; clearTimeout(entry.timer);
      if (entry.metadata) metadata(serial, entry.metadata);
      if (entry.handle) {
        try { entry.handle.send({ type: 'reset' }); } catch { entry.handle.close(); }
      } else if (!entry.starting && !entry.retry) { entry.attempts = 0; void start(serial, entry); }
    },
    unsubscribe(serial) {
      const entry = entries.get(serial); if (!entry) return;
      entry.wanted = false; release(entry); clearTimeout(entry.timer);
      entry.timer = setTimeout(() => retire(serial, entry), graceMs);
    },
    release(serial) { const entry = entries.get(serial); if (entry) release(entry); },
    input(serial, event) {
      const entry = entries.get(serial); if (!entry?.wanted || !entry.handle) return;
      entry.handle.send(event);
      if (event.type === 'touch') { if (event.action === 1) entry.touches.delete(event.pointerId); else entry.touches.set(event.pointerId, event); }
    },
    clear() { for (const [serial, entry] of entries) retire(serial, entry); },
    close() { stopped = true; this.clear(); },
  };
}
