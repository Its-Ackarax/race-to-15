/**
 * Pulls Premier League goal counts for the pool's 31 players and rewrites goals.json.
 * Runs in GitHub Actions. Never runs in a visitor's browser, so nobody can tamper with it.
 *
 * Needs one environment variable: FOOTBALL_DATA_TOKEN (free key from football-data.org).
 */
import { readFile, writeFile } from "node:fs/promises";

const TOKEN    = process.env.FOOTBALL_DATA_TOKEN;
const SEASON   = "2026";                        // football-data labels a season by its start year
const FREEZE   = new Date("2027-01-01T06:00:00Z"); // after this, goals.json is left alone for good
const API      = `https://api.football-data.org/v4/competitions/PL/scorers?season=${SEASON}&limit=100`;

const strip = s => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z ]/g, "").trim();

const fail = msg => { console.error("✗ " + msg); process.exit(1); };

if (!TOKEN) fail("FOOTBALL_DATA_TOKEN is not set. Add it as a repository secret.");

if (new Date() > FREEZE) {
  console.log("Past the 31 December deadline — goals.json is final, leaving it untouched.");
  process.exit(0);
}

const { players } = JSON.parse(await readFile(new URL("../players.json", import.meta.url)));
const { overrides } = JSON.parse(await readFile(new URL("../overrides.json", import.meta.url)));
const previous = JSON.parse(await readFile(new URL("../goals.json", import.meta.url)));

const res = await fetch(API, { headers: { "X-Auth-Token": TOKEN } });
if (!res.ok) fail(`the stats API said ${res.status}. ${res.status === 403 ? "Your free key may not cover this endpoint." : ""}`);

const data = await res.json();
const scorers = data.scorers || [];
if (!scorers.length) fail("the API returned an empty scorer list — refusing to wipe every total.");

// Build a lookup of every name the API gave us.
const scored = new Map();
for (const s of scorers) {
  const goals = s.goals ?? 0;
  for (const key of [s.player?.name, s.player?.firstName && s.player?.lastName ? `${s.player.firstName} ${s.player.lastName}` : null]) {
    if (key) scored.set(strip(key), goals);
  }
}

const goals = {}, changes = [], unmatched = [];
for (const p of players) {
  let found = null;
  for (const alias of [p.full, ...(p.aliases || [])]) {
    if (scored.has(strip(alias))) { found = scored.get(strip(alias)); break; }
  }
  // Not on the scorer list means no goals yet — that's a real answer, not a miss.
  goals[p.id] = found ?? 0;
  if (found === null) unmatched.push(p.name);
  const was = previous.goals?.[p.id] ?? 0;
  if (goals[p.id] !== was) changes.push(`${p.name}: ${was} → ${goals[p.id]}`);
}

// Your manual corrections win.
for (const [id, v] of Object.entries(overrides)) {
  if (id in goals && Number.isInteger(v)) { goals[id] = v; console.log(`override — ${id} set to ${v}`); }
}

// A sanity brake: totals should only ever climb during a season.
const before = Object.values(previous.goals || {}).reduce((a, b) => a + b, 0);
const after  = Object.values(goals).reduce((a, b) => a + b, 0);
if (after < before && !Object.keys(overrides).length) {
  fail(`total goals fell from ${before} to ${after}. That shouldn't happen mid-season, so nothing was written. Check the API by hand.`);
}

await writeFile(new URL("../goals.json", import.meta.url), JSON.stringify({
  updated: new Date().toISOString(),
  source: `football-data.org scorers, season ${SEASON}/${+SEASON + 1}`,
  frozen: false,
  goals
}, null, 2) + "\n");

console.log(`✓ ${scorers.length} scorers read. ${changes.length} change${changes.length === 1 ? "" : "s"}.`);
changes.forEach(c => console.log("  " + c));
if (unmatched.length) console.log(`  (on nought: ${unmatched.join(", ")})`);
