// Pure clock-driven controller: app.js supplies timers, visibility and focus.
export function createPresentation({ intervalMs = 30_000, inactivityMs = 30_000 } = {}) {
  let active = false;
  let tab = 'dunia';
  let nextSwitchAt = 0;
  let resumeAt = 0;
  let paused = false;
  let enteredAt = 0;
  const durations = { dunia: intervalMs, kedudukan: intervalMs };

  return {
    start(now) {
      active = true;
      tab = 'dunia';
      paused = false;
      nextSwitchAt = now + intervalMs;
      enteredAt = now;
      resumeAt = 0;
      return tab;
    },
    stop() { active = false; paused = false; },
    setLeaderboardPages(count) {
      durations.kedudukan = Math.max(intervalMs, Math.max(1, count) * 12_000);
      if (active && tab === 'kedudukan') nextSwitchAt = enteredAt + durations.kedudukan;
    },
    interact(now) {
      if (!active) return;
      paused = true;
      resumeAt = now + inactivityMs;
    },
    select(value, now) {
      if (value !== 'dunia' && value !== 'kedudukan') return;
      tab = value;
      enteredAt = now;
      nextSwitchAt = now + durations[tab];
      this.interact(now);
    },
    tick(now, blocked = false) {
      if (!active) return null;
      if (blocked) { this.interact(now); return null; }
      if (paused) {
        if (now < resumeAt) return null;
        paused = false;
        enteredAt = now;
        nextSwitchAt = now + durations[tab];
        return null;
      }
      if (now < nextSwitchAt) return null;
      tab = tab === 'dunia' ? 'kedudukan' : 'dunia';
      enteredAt = now;
      nextSwitchAt = now + durations[tab];
      return tab;
    },
    snapshot(now) {
      return { active, tab, paused, seconds: Math.max(0, Math.ceil(((paused ? resumeAt : nextSwitchAt) - now) / 1000)) };
    },
  };
}
