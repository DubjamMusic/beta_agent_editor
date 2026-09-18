import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(new URL('./presence.json', import.meta.url), 'utf8'));
if (raw.figure !== 'collab-scribe') throw new Error('wrong figure');
if (!Array.isArray(raw.actors) || raw.actors.length < 1) throw new Error('no actors');
const seen = new Set();
for (const actor of raw.actors) {
  if (!actor.actorId || !actor.path || !actor.lastSeenIso) throw new Error('actor incomplete');
  if (!actor.lock || !actor.lock.heldBy) throw new Error('lock missing heldBy');
  const key = `${actor.actorId}::${actor.path}`;
  if (seen.has(key)) throw new Error(`duplicate presence ${key}`);
  seen.add(key);
}
console.log('ok collab-scribe presence');
