#!/usr/bin/env node
/*
 * nav.js — deterministic check and lookup script (two commands write: snapshot = records locks/·history/, dest --create = creates 00_destination.md. The rest are read-only)
 * Contract → NOTATION_CONVENTIONS: grep -F "anchor:check-execution"
 *
 * Usage:
 *   node .claude/hooks/nav.js check [--c3]   invariant checks (with the values read). --c3 = the C3 list only
 *   node .claude/hooks/nav.js status         current position, 3 lines
 *   node .claude/hooks/nav.js state {#N}     computed result·conclusion·status of an attempt, 4 lines
 *   node .claude/hooks/nav.js brief          session start briefing values
 *   node .claude/hooks/nav.js last {#N}      content of the most recent closed round of an attempt
 *   node .claude/hooks/nav.js onpath {#N}    comparison values of an attempt and the ★ path, 4 lines
 *   node .claude/hooks/nav.js route          session routing values
 *   node .claude/hooks/nav.js dest           00_destination.md: writing status·criteria list·I-21·I-22
 *   node .claude/hooks/nav.js dest --create  00_destination.md: created from the structure template when it does not exist
 *   node .claude/hooks/nav.js recover        invalidation marker comparison values
 *   node .claude/hooks/nav.js snapshot       wrap records the pre-write state of wrap in locks/wrap-snapshot.json + appends the changed full texts of 00·01·02 to history/YYYY-MM.log
 *   node .claude/hooks/nav.js history        history list
 *   node .claude/hooks/nav.js diff {A} [{B}] line-level difference of history A and history B (the current files when omitted)
 *   node .claude/hooks/nav.js anchor {key}    prints the original text of an anchor block of NOTATION_CONVENTIONS
 *
 * Formats (regexes·vocabulary·caps) are read only from format-constants.json (no inline copies).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const gen = require('./gen-format-constants.js');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const P = (...a) => path.join(ROOT, ...a);
const SPEC = 'NOTATION_CONVENTIONS';
const TREE = '01_exploration_tree.md';
const INDEX = '02_knowledge_base.md';
const DEST = '00_destination.md';
const SNAP = 'locks/wrap-snapshot.json';
const CONSTS = '.claude/hooks/format-constants.json';
const HIST = 'history';
const HFILES = [DEST, TREE, INDEX];                                        // files copied into the history

const norm = s => s.replace(/\r\n/g, '\n');
const read = rel => norm(fs.readFileSync(P(rel), 'utf8'));
const tryRead = rel => { try { return read(rel); } catch { return null; } };
const exists = rel => fs.existsSync(P(rel));
const list = dir => { try { return fs.readdirSync(P(dir)); } catch { return []; } };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const today = () => { const d = new Date(); const z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };

// ── format constants (freshness: compared with a regenerated copy) ──
function loadConstants() {
  const committed = tryRead(CONSTS);
  if (committed === null) throw new Error('STALE: ' + CONSTS + ' not found');
  if (norm(gen.serialize(gen.build())) !== committed) throw new Error('STALE: ' + CONSTS + ' differs from the notation conventions');
  const C = JSON.parse(committed);
  const full = s => new RegExp('^' + s + '$');
  C.re = {
    att: full(C.regex.id['Attempt']),
    attBare: full(C.regex.id['Attempt'].replace(/^#/, '')),
    k: full(C.regex.id['Lesson']),
    kAll: new RegExp(C.regex.id['Lesson'], 'g'),
    d: new RegExp(C.regex.id['DestinationCriterion'], 'g'),
    date: new RegExp(C.regex.dateLiteral),
    month: full(C.regex.id['ArchiveMonth']),
    spath: full(esc(C.path['Body'].prefix) + '(' + C.regex.id['Session'] + ')' + esc(C.path['Body'].suffix)),
    near: new RegExp(C.regex.nearReason),
    cand: new RegExp(C.regex.candidate),
    invId: new RegExp(C.regex.invalidationId),
    eff: C.regex.effective.map(s => new RegExp(s)),
    found: new RegExp(C.regex.discovered),
    chkDone: new RegExp(C.regex.checkItem[0]),
    chkNot: new RegExp(C.regex.checkItem[1]),
    dItem: new RegExp(C.regex.destItem),
    lockTarget: new RegExp(C.regex.lockTarget),
    sumHead: new RegExp(C.regex.sumHeader),
    discHead: new RegExp(C.regex.discHeader),
    destFixed: new RegExp(C.dest.fixedLine),
    pause: C.regex.pauseMemo.map(x => new RegExp(x)),
    header: new RegExp(C.regex.sessionHeader),
    closed: full(esc(C.session.label.conclusion) + ' (' + C.vocab['Conclusion'].map(esc).join('|') + ')'),
    lab: Object.fromEntries(Object.entries(C.session.label).map(([k, v]) => [k, new RegExp('^' + esc(v))])),   // session file line labels (generated from the round skeleton)
    effLine: new RegExp('^\\s*' + esc(C.dest.effectiveLabel) + '[ \\t]*(.*)$'),
    effHead: new RegExp('^\\s*' + esc(C.dest.effectiveLabel)),
  };
  C.pauseMark = C.regex.pauseMemo[0].replace(/\$$/, '').split(' — ').pop();   // session-pause memo mark (the last words of the header regex)
  return C;
}

// ── parsers ──
function frontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/); const fm = {};
  if (!m) return fm;
  for (const l of m[1].split('\n')) {
    const mm = l.match(/^([a-z_]+):\s*(.*?)\s*(?:#.*)?$/);
    if (mm) fm[mm[1]] = mm[2].trim();
  }
  return fm;
}
const isH2 = l => /^## /.test(l);
const isSec = (l, name) => l.startsWith('## ' + name);                    // section header = `## {name}` — a line starting with it
const sectionCount = (md, name) => md.split('\n').filter(l => isSec(l, name)).length;
function section(md, name) {
  const out = []; let cap = false;
  for (const l of md.split('\n')) { if (isH2(l)) { cap = isSec(l, name); continue; } if (cap) out.push(l); }
  return out.join('\n');
}
function codeblock(sec) {
  const m = sec.match(/```\n([\s\S]*?)```/);
  return m ? m[1].split('\n').filter(l => l.trim() !== '') : null;
}
function kvOf(lines) {
  const kv = {};
  for (const l of lines || []) { const i = l.indexOf(':'); if (i > 0) kv[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
  return kv;
}
function table(sec) {
  const rows = [];
  for (const l of sec.split('\n')) {
    if (!/^\s*\|/.test(l)) { if (rows.length) break; continue; }
    if (/^\s*\|[\s|:\-]*$/.test(l)) continue;
    rows.push(l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
  }
  const header = rows[0] || [];
  const data = rows.slice(1).filter(r => !r.every(c => c === '—'))            // all cells — = template row (not data)
    .map(r => { const o = { _raw: r.join(' | '), _n: r.length }; header.forEach((h, i) => { o[h] = r[i] === undefined ? '' : r[i]; }); return o; });
  return { header, data };
}

function loadTree(C) {
  const md = tryRead(TREE);
  if (md === null) throw new Error(TREE + ' not found');                          // every command that reads the tree stops with the same wording
  const T = { md, fm: frontmatter(md) };
  T.starCount = sectionCount(md, '★ Current Position'); T.star = codeblock(section(md, '★ Current Position')); T.kv = kvOf(T.star);
  T.bestCount = sectionCount(md, '◎ Best Record'); T.best = codeblock(section(md, '◎ Best Record')); T.bkv = kvOf(T.best);
  T.back = table(section(md, 'Return Log'));
  T.sum = table(section(md, 'Recent Attempts'));
  T.disc = table(section(md, 'Discarded Directions'));
  T.cand = section(md, 'Next Direction Candidates').split('\n').filter(l => /^- /.test(l));   // candidate lines = in that section, all `- `  lines (I-04 checks the format)
  T.nodes = T.kv['Path'] ? T.kv['Path'].split(C.path.separator) : null;
  return T;
}
function loadArchive() {
  const p = consts().path['Archive']; const i = p.prefix.lastIndexOf('/'); const dir = p.prefix.slice(0, i), head = p.prefix.slice(i + 1); const out = [];
  for (const f of list(dir).sort()) {
    if (!f.startsWith(head) || !f.endsWith(p.suffix) || f.length === head.length + p.suffix.length) continue;
    const md = read(dir + '/' + f);
    out.push({ file: dir + '/' + f, month: f.slice(head.length, f.length - p.suffix.length), fm: frontmatter(md), sum: table(section(md, 'Migrated Attempt Summaries')), back: table(section(md, 'Migrated Return Log')) });
  }
  return out;
}
function loadIndex() { const md = tryRead(INDEX); return md === null ? null : table(section(md, 'Lesson List')); }
const kPath = k => { const p = consts().path['Lesson']; return p.prefix + k.slice(1) + p.suffix; };   // k = '#K003' → lesson file path (the derivation comes from the constants)
const kIds = C => { const p = C.path['Lesson']; return list(p.prefix.replace(/\/$/, '')).filter(f => f.endsWith(p.suffix)).map(f => '#' + f.slice(0, f.length - p.suffix.length)).filter(k => C.re.k.test(k)).sort(); };
function kFile(k) {                                                        // k = '#K003'
  const md = tryRead(kPath(k));
  if (md === null) return null;
  const L = consts().kfile.label;
  const f = n => { const m = md.match(new RegExp('^' + esc(n) + ':[ \\t]*(.*)$', 'm')); return m ? m[1].trim() : null; };
  return { related: f(L.related), invalid: f(L.invalid), found: f(L.found), log: table(section(md, 'Revision History')) };
}
function sessions(C) {
  return list('sessions').filter(f => C.re.spath.test(C.path['Body'].prefix + f)).sort().map(f => C.path['Body'].prefix + f);
}
function cycles(C, rel) {
  const lines = read(rel).split('\n'); const out = [];
  lines.forEach((l, i) => {
    const m = l.match(C.re.header);
    if (m) out.push({ n: parseInt(l.slice(3).replace(/^\D+/, ''), 10), attempt: '#' + m[1], cont: !!m[2], start: i });
  });
  out.forEach(c => {
    let e = lines.length;
    for (let i = c.start + 1; i < lines.length; i++) if (isH2(lines[i])) { e = i; break; }
    c.lines = lines.slice(c.start, e);
    c.closed = c.lines.some(l => C.re.closed.test(l));
  });
  return out;
}
const num = a => parseInt(String(a).replace(/^#/, ''), 10);
const isPauseHead = (C, l) => /^#### /.test(l) && l.endsWith(C.pauseMark);   // mark = the last words of the session-pause memo header regex (derived from the constants)
function doItems(c) {                                                     // DO entries = the #### lines between ### DO and ### CHECK [{head, i}]
  const a = c.lines.findIndex(l => /^### DO/.test(l)); const b = c.lines.findIndex(l => /^### CHECK/.test(l)); const out = [];
  if (a < 0) return out;
  for (let i = a + 1; i < (b < 0 ? c.lines.length : b); i++) if (/^#### /.test(c.lines[i])) out.push({ head: c.lines[i], i });
  return out;
}
function pauseMemo(C, c, i) {                                             // i = header line number. The three values when well-formed, otherwise null
  const ls = [c.lines[i], c.lines[i + 1] || '', c.lines[i + 2] || '', c.lines[i + 3] || ''];
  return ls.every((l, k) => C.re.pause[k].test(l)) ? ls.slice(1) : null;
}
const kList = v => v.split(', ');
function chainOf(C, rows, X) {                                            // chain path = the node sequence from X back through branch points to the first node. null when it cannot be built (Contract → NOTATION_CONVENTIONS: grep -F "anchor:check-execution")
  const out = [X]; let cur = X;
  while (cur !== C.path.firstNode) {
    const rs = rows.filter(o => o['#'] === cur); if (rs.length !== 1) return null;
    const b = rs[0]['Branch point']; if (!C.re.att.test(b) || num(b) >= num(cur)) return null;
    out.unshift(b); cur = b;
  }
  return out;
}
function matchNodes(C, T, A, X) {                                         // check node set of the discard check = ★ path nodes ∪ chain path nodes of attempt X. chain = a chain that added nodes outside the path (otherwise null)
  const nodes = T.nodes || []; const ch = X ? chainOf(C, T.sum.data.concat(...A.map(a => a.sum.data)), X) : null;
  return { set: new Set(nodes.concat(ch || [])), chain: ch && ch.some(n => !nodes.includes(n)) ? ch : null };
}
function planUnwritten(C, c) {                                            // PLAN five slots: one has an unfilled value (—) or no value line (Contract → NOTATION_CONVENTIONS: grep -F "anchor:check-execution")
  const U = C.token.unfilled, L = c.lines;
  const one = re => { const l = L.find(x => re.test(x)); return !l || l.replace(re, '').trim() === U || l.replace(re, '').trim() === ''; };
  const many = (head, ok, strip) => { const a = linesAfter(L, head, ok); return !a.length || a.some(l => l.replace(strip, '').trim() === U || l.replace(strip, '').trim() === ''); };
  return one(C.re.lab.goal) || many(C.re.lab.hypothesis, l => /^>/.test(l), /^>/) || many(C.re.lab.criteria, l => /^- \[/.test(l), /^- \[.\]/) || one(C.re.lab.lessons) || one(C.re.lab.discard);
}

// ── computed values: result · status (Contract → NOTATION_CONVENTIONS: grep -F "anchor:status-determination") ──
const UNKNOWN = 'Undetermined';
function allCycles(C) { const out = []; for (const f of sessions(C)) for (const c of cycles(C, f)) { c.file = f; out.push(c); } return out; }
function cycleFacts(C, c) {
  const V = C.vocab, SEP = ' — ';
  const cl = c.lines.find(l => C.re.closed.test(l)); const concl = cl ? cl.replace(C.re.lab.conclusion, '').trim() : null;
  const i = c.lines.findIndex(l => C.re.lab.achieved.test(l)); const items = [];
  if (i >= 0) for (let j = i + 1; j < c.lines.length && /^- \[/.test(c.lines[j]); j++) items.push(c.lines[j]);
  const done = items.filter(l => C.re.chkDone.test(l)).length, not = items.filter(l => C.re.chkNot.test(l)).length;
  const result = (!items.length || done + not !== items.length) ? null : not === 0 ? V['Result'][0] : done === 0 ? V['Result'][1] : V['Result'][2];
  const dl = c.lines.filter(l => C.re.lab.distance.test(l));
  const distRaw = dl.length === 1 ? dl[0].replace(C.re.lab.distance, '').trim() : '(lines ' + dl.length + ')';
  const k = distRaw.indexOf(SEP);
  const dist = dl.length === 1 && k > 0 && V['Distance to destination'].includes(distRaw.slice(0, k)) && distRaw.slice(k + SEP.length).trim() !== '' ? distRaw.slice(0, k) : null;
  return { concl, items, result, dist, distRaw, doN: doItems(c).length };   // DO entries = the #### lines inside the ### DO section (same definition as brief and the DO record hook)
}
function deriveState(C, X, all) {
  const S = C.vocab['Status'], K = C.vocab['Conclusion'], D = C.vocab['Distance to destination'];
  const cs = (all || allCycles(C)).filter(c => c.attempt === X); const open = cs.filter(c => !c.closed), closed = cs.filter(c => c.closed);
  const out = { attempt: X, hasClosed: closed.length > 0, result: null, resultWhy: null, concl: null, where: null, state: null, why: null };
  let f = null;
  if (closed.length) {
    const last = closed[closed.length - 1]; f = cycleFacts(C, last);
    out.where = last.file + ' Round ' + last.n + ''; out.concl = f.concl; out.result = f.result;
    if (f.result === null) out.resultWhy = out.where + ' Success criteria met items ' + f.items.length + ' lines (0 lines, or a line that does not fit the format)';
  }
  const set = v => { out.state = v; return out; }; const unk = w => { out.why = w; return out; };
  if (open.length) return set(!closed.length && cs.reduce((a, c) => a + cycleFacts(C, c).doN, 0) === 0 ? S[0] : S[1]);   // 1 · 2
  if (!cs.length) return X === C.path.firstNode ? set(S[0]) : unk('Attempt ' + X + ' has no round in the session files');                // 3 · 4
  if (f.concl === K[2]) return set(S[5]);                                                                                  // 5
  if (f.result === null) return unk(out.resultWhy);                                                                        // 6
  if (f.result === C.vocab['Result'][0]) return set(S[4]);                                                                   // 7
  if (f.concl === K[1]) return set(S[3]);                                                                                  // 8
  if (f.dist === D[0]) return set(S[1]);                                                                                   // 9
  if (f.dist === D[1] || f.dist === D[2]) return set(S[2]);                                                                // 10
  return unk(out.where + ' Distance to destination = "' + f.distRaw + '"');                                                        // 11
}

// ── test ──
const OK = '✅', BAD = '❌', UNK = '⚠', SKIP = 'skipped';
const r = (v, msg, exp) => ({ v, msg, exp });

// ── 00_destination.md structure (Contract → NOTATION_CONVENTIONS: grep -F "anchor:00-writing-rules") ──
const rtrim = l => l.replace(/[ \t]+$/, '');
const destLines = md => { const a = md.split('\n').map(rtrim); while (a.length && a[0] === '') a.shift(); while (a.length && a[a.length - 1] === '') a.pop(); return a; };
function destParse(C, md) {                                               // fixed line list · value lines per section (## line) · value lines above the first ## · criterion items
  const lines = destLines(md); const fixed = [], h2 = [], sec = {}, stray = [], items = []; let cur = null, sub = null;
  lines.forEach((l, i) => {
    if (C.re.destFixed.test(l)) fixed.push(l);
    if (/^## /.test(l)) { cur = l; sub = null; h2.push(l); sec[l] = []; return; }
    if (/^### /.test(l)) { sub = l; return; }
    if (C.re.destFixed.test(l) || l === '') return;
    if (cur === null) { stray.push(l); return; }
    sec[cur].push(l);
    const m = l.match(C.re.dItem);
    if (m) { const e = (lines[i + 1] || '').match(C.re.effLine); items.push({ id: m[2], box: m[1], text: m[3], sub, eff: e ? e[1].trim() : null }); }
  });
  return { lines, fixed, h2, sec, stray, items };
}
function destI21(C) {
  const md = tryRead(DEST); if (md === null) return r(BAD, DEST + ' not found', 'a file written per the structure template');
  const T = destParse(C, C.dest.template.join('\n')), F = destParse(C, md); const bad = [];
  const n = Math.max(T.fixed.length, F.fixed.length);
  for (let i = 0; i < n; i++) if (T.fixed[i] !== F.fixed[i]) { bad.push('fixed line ' + (i + 1) + ' = "' + (F.fixed[i] === undefined ? '(None)' : F.fixed[i]) + '" (expected: "' + (T.fixed[i] === undefined ? '(None)' : T.fixed[i]) + '")'); break; }
  const ph = C.dest.template.filter(l => !C.re.destFixed.test(l) && l.includes('{'));
  F.lines.filter(l => ph.includes(l)).forEach(l => bad.push('placeholder line left "' + l.trim() + '"'));
  F.stray.forEach(l => bad.push('value line above the first ## line "' + l + '"'));
  const [goal, crit, cons, out, log] = T.h2; const S = h => F.sec[h] || [];
  if (S(goal).length !== 1) bad.push(goal + ' value line ' + S(goal).length + ' (expected: 1)');
  const cl = S(crit);
  cl.forEach((l, i) => { const it = /^- \[/.test(l), ef = C.re.effHead.test(l); if (!it && !ef) bad.push(crit + ' value line "' + l.trim() + '" (expected: an item line or an In effect line)'); if (ef && !(i > 0 && /^- \[/.test(cl[i - 1]))) bad.push(crit + ' In effect line without an item line'); });
  if (!cl.some(l => /^- \[/.test(l))) bad.push(crit + ' items 0 (expected: 1 or more)');
  F.items.filter(it => it.sub === null).forEach(it => bad.push(it.id + ' is not below a ### line'));
  for (const h of [cons, out]) { if (!S(h).length) bad.push(h + ' value lines 0 (expected: 1 or more)'); S(h).filter(l => !/^- .+/.test(l)).forEach(l => bad.push(h + ' value line "' + l + '" (expected: "- " at the start)')); }
  S(log).filter(l => !/^\|.*\|$/.test(l)).forEach(l => bad.push(log + ' value line outside the table "' + l + '"'));
  const rows = table(section(destLines(md).join('\n'), log.replace(/^## /, ''))).data; const empty = v => v === undefined || v === '' || v === C.token.unfilled;
  if (!rows.length) bad.push(log + ' data rows 0 (expected: 1 or more)');
  rows.forEach((o, i) => { for (const k of ['Change', 'Reason for change']) if (empty(o[k])) bad.push('change history row ' + (i + 1) + ' ' + k + ' blank'); });
  return bad.length ? r(BAD, bad.slice(0, 3).join(' ; ') + (bad.length > 3 ? ' and ' + (bad.length - 3) + ' more' : ''))
    : r(OK, DEST + ' fixed line ' + F.fixed.length + ' match / placeholders 0 / D# ' + F.items.length + ' / change history ' + rows.length + ' rows');
}
function destRecorded(C) {                                                // {D#: {text, n}} — the wording in the full text where that number first appeared in the history, and the history number
  const first = {};
  for (const e of histEntries().filter(x => x.file === DEST)) for (const it of destParse(C, e.text).items) if (!(it.id in first)) first[it.id] = { text: it.text, n: e.n };
  return first;
}
function destI22(C) {
  const first = destRecorded(C); const ids = Object.keys(first).sort((a, b) => num(a.slice(1)) - num(b.slice(1)));
  if (!ids.length) return r(SKIP, 'no D# recorded in the history');
  const cur = {}; destParse(C, tryRead(DEST) || '').items.forEach(it => { if (!(it.id in cur)) cur[it.id] = it.text; });
  const bad = [];
  for (const id of ids) {
    if (!(id in cur)) bad.push(id + ' item line missing (history ' + pad(first[id].n) + ' wording: "' + first[id].text + '")');
    else if (cur[id] !== first[id].text) bad.push(id + ' wording = "' + cur[id] + '" (History ' + pad(first[id].n) + ' wording: "' + first[id].text + '")');
  }
  return bad.length ? r(BAD, bad.slice(0, 3).join(' ; ') + (bad.length > 3 ? ' and ' + (bad.length - 3) + ' more' : ''), 'same as the wording first recorded in the history')
    : r(OK, 'recorded D# ' + ids.length + ' all present / wording = wording first recorded in the history');
}

function buildChecks(C, T, A, S) {
  const nodes = T.nodes;
  const starReady = T.starCount === 1 && nodes && T.kv['Attempt #'] !== undefined && T.kv['Attempt #'] !== '';
  const cap = C.struct['I-03'];
  const isK = v => v === C.token.none || (kList(v).every(k => C.re.k.test(k)) && kList(v).join() === [...new Set(kList(v))].sort().join());
  const allSum = () => T.sum.data.concat(...A.map(a => a.sum.data));

  return {
    'I-01': () => T.starCount !== 1 ? r(BAD, '★ sections ' + T.starCount + '', '1')
      : (T.star || []).length !== C.struct['I-01'].line ? r(BAD, '★ sections 1 / ' + (T.star || []).length + ' lines', C.struct['I-01'].line + ' lines')
      : r(OK, '★ sections 1 / ' + T.star.length + ' lines'),
    'I-02': () => T.bestCount !== 1 ? r(BAD, '◎ sections ' + T.bestCount + '', '1')
      : (T.best || []).length !== C.struct['I-02'].line ? r(BAD, '◎ sections 1 / ' + (T.best || []).length + ' lines', C.struct['I-02'].line + ' lines')
      : r(OK, '◎ sections 1 / ' + T.best.length + ' lines'),
    'I-03': () => {
      const n = { 'Return Log': T.back.data.length, 'Recent Attempts': T.sum.data.length, 'Next Direction Candidates': T.cand.length };
      const msg = 'return ' + n['Return Log'] + ' / attempt summaries ' + n['Recent Attempts'] + ' / candidates ' + n['Next Direction Candidates'];
      return Object.keys(cap).every(k => n[k] <= cap[k]) ? r(OK, msg) : r(BAD, msg, 'each ' + Object.values(cap).join('·') + ' or below');
    },
    'I-04': () => {
      const bad = []; const chk = (where, val, ok, exp) => { if (!ok) bad.push(where + ' = "' + val + '" (expected: ' + exp + ')'); };
      const fm = T.fm, kv = T.kv; const U = C.token.unfilled, NONE = C.token.none;
      const asc = a => a.every((x, i) => i === 0 || num(a[i - 1]) < num(x));
      const isAttList = v => { const a = String(v).split(', '); return a.every(x => C.re.att.test(x)) && asc(a); };
      const isAttempts = v => v === '[]' || (/^\[.+\]$/.test(v || '') && (a => a.every(x => C.re.attBare.test(x)) && asc(a))(v.slice(1, -1).split(', ')));
      const sumRow = (w, o) => {
        chk(w + ' #', o['#'], C.re.att.test(o['#']), '#N');
        chk(w + ' Branch point', o['Branch point'], C.re.att.test(o['Branch point']) || (o['Branch point'] === U && o['#'] === C.path.firstNode), '#N');
        chk(w + ' Lesson', o['Lesson'], isK(o['Lesson']), '#K### ascending list or ' + NONE);
        chk(w + ' Body', o['Body'], C.re.spath.test(o['Body']), 'session path');
      };
      const backRow = (w, o) => {
        chk(w + ' Blocked at', o['Blocked at'], C.re.att.test(o['Blocked at']), '#N');
        chk(w + ' Return point', o['Return point'], C.re.att.test(o['Return point']), '#N');
        chk(w + ' Invalidated lessons', o['Invalidated lessons'], isK(o['Invalidated lessons']), '#K### ascending list or ' + NONE);
        chk(w + ' Body', o['Body'], C.re.spath.test(o['Body']), 'session path');
      };
      // 01_exploration_tree.md
      chk('best_attempt', fm.best_attempt, fm.best_attempt === NONE || C.re.attBare.test(fm.best_attempt || ''), 'integer or ' + NONE);
      chk('archived_through', fm.archived_through, fm.archived_through === NONE || C.re.month.test(fm.archived_through || ''), 'YYYY-MM or ' + NONE);
      const PLACE = C.init.date; const fresh = fm.last_updated === PLACE; const sp0 = C.init.path;   // initial values before first wrap (Contract → NOTATION_CONVENTIONS: grep -F "anchor:notation-grammar")
      chk('last_updated', fm.last_updated, fresh || C.re.date.test(fm.last_updated || ''), 'Date');
      chk('★ Attempt #', kv['Attempt #'], C.re.att.test(kv['Attempt #'] || ''), '#N');
      (nodes || ['']).forEach(n => chk('★ path nodes', n, C.re.att.test(n), '#N'));
      chk('★ Started', kv['Started'], fresh ? kv['Started'] === PLACE : C.re.date.test(kv['Started'] || ''), fresh ? 'Initial values before first wrap ' + PLACE : 'Date');
      chk('★ Body', kv['Body'], fresh ? kv['Body'] === sp0 : C.re.spath.test(kv['Body'] || ''), fresh ? 'Initial values before first wrap ' + sp0 : 'session path');
      const near = T.bkv['Closest attempt'];
      chk('◎ Closest attempt', near, near === U || C.re.att.test(near || ''), '#N or ' + U);
      const cells = (w, t) => t.data.forEach((o, i) => chk(w + ' row ' + (i + 1) + ' cell count', o._n, o._n === t.header.length, t.header.length + ' cells (| is not used in a cell value)'));
      cells('Return Log', T.back); cells('Attempt summary', T.sum); cells('Discarded Directions', T.disc);
      const head = (w, t, re) => { const l = '| ' + t.header.join(' | ') + ' |'; chk(w + ' header row', l, re.test(l), 'header regex of the conventions ' + re.source); };
      head('Attempt summary', T.sum, C.re.sumHead); head('Discarded Directions', T.disc, C.re.discHead);
      T.back.data.forEach((o, i) => backRow('Return Log row ' + (i + 1) + '', o));
      T.sum.data.forEach((o, i) => sumRow('Attempt summary row ' + (i + 1) + '', o));
      T.cand.forEach((l, i) => chk('candidate line ' + (i + 1), l, C.re.cand.test(l), '- **A.** {direction} — Branch point: #N — Basis: {basis} (bullet A·B·C)'));
      T.disc.data.forEach((o, i) => {
        chk('Discarded Directions row ' + (i + 1) + ' #', o['#'], o['#'] === U || C.re.att.test(o['#']), '#N or ' + U);
        chk('Discarded Directions row ' + (i + 1) + ' Branch point', o['Branch point'], C.re.att.test(o['Branch point']), '#N');
        chk('Discarded Directions row ' + (i + 1) + ' Date', o['Date'], C.re.date.test(o['Date']), 'Date');
      });
      // 00_destination.md
      const cnt = { d: 0, k: 0, s: 0, a: 0 };
      const dmd = tryRead(DEST);
      if (dmd !== null) {                                                   // I-21 checks file existence
        const dl = section(dmd, 'Success Criteria').split('\n'); const ids = []; let prev = 0, ordered = true;
        dl.forEach((l, i) => {
          if (/^### /.test(l)) { prev = 0; return; }
          if (!/^- \[/.test(l)) return;
          cnt.d++; const m = l.match(C.re.dItem);
          chk(DEST + ' Success Criteria ' + 'item ' + cnt.d, l, !!m, '- [ ] **D#** — {Criterion}');
          if (m) { const k = num(m[2].slice(1)); ids.push(k); if (k <= prev) ordered = false; prev = k; }
          const e = (dl[i + 1] || '').match(C.re.effLine); const who = m ? m[2] : 'item ' + cnt.d;
          chk(DEST + ' ' + who + ' In effect', e ? e[1].trim() : '(not on the line directly below)', !!e && C.re.eff.some(x => x.test(e[1].trim())), 'Valid or Discarded — YYYY-MM-DD, {reason}');
        });
        const sortedIds = ids.slice().sort((a, b) => a - b);
        chk(DEST + ' Success Criteria number set', sortedIds.map(k => 'D' + k).join(', '), ids.length === cnt.d && sortedIds.every((k, i) => k === i + 1), cnt.d ? 'D1~D' + cnt.d + ' no duplicates or gaps' : 'no items');
        chk(DEST + ' Success Criteria number order', ids.map(k => 'D' + k).join(', '), ordered, '### sections: ascending inside each');
        table(section(dmd, 'Destination Change History')).data.forEach((o, i) => chk(DEST + ' change history row ' + (i + 1) + ' Date', o['Date'], C.re.date.test(o['Date'] || ''), 'Date'));
      }
      // 02_knowledge_base.md
      const idx = loadIndex();
      if (idx) { cells(INDEX + ' Lesson List', idx); idx.data.forEach((o, i) => chk(INDEX + ' Lesson List row ' + (i + 1) + ' #', o['#'], C.re.k.test(o['#'] || ''), '#K###')); }
      // knowledge/K###.md
      for (const k of kIds(C)) {
        cnt.k++; const kf = kFile(k); const w = kPath(k);
        chk(w + ' Discovered', kf.found, kf.found !== null && C.re.found.test(kf.found), '#N (YYYY-MM-DD)');
        chk(w + ' Related attempts', kf.related, kf.related !== null && isAttList(kf.related), '#N ascending list');
        const v = kf.invalid === null ? '' : kf.invalid; const i = v.indexOf(' — ');
        chk(w + ' Invalidation', kf.invalid, v === NONE || (i > 0 && C.re.invId.test(v.slice(0, i)) && v.slice(i + 3).trim() !== ''), NONE + ' or YYYY-MM-DD — {reason}');
        kf.log.data.forEach((o, j) => chk(w + ' Revision History row ' + (j + 1) + ' Date', o['Date'], C.re.date.test(o['Date'] || ''), 'Date'));
      }
      // sessions/YYYY-MM-DD.md
      for (const f of sessions(C)) {
        cnt.s++;
        const sd = f.match(C.re.spath)[1]; chk(f + ' file date', sd, sd <= today(), 'Today(' + today() + ') or below');
        const ns = cycles(C, f).map(c => c.n); chk(f + ' round number order', ns.join(', '), ns.every((x, i) => i === 0 || ns[i - 1] < x), 'growing from top to bottom (no equal numbers)');
        read(f).split('\n').forEach((l, i) => { if (isH2(l)) chk(f + ' line ' + (i + 1) + ' round header', l, C.re.header.test(l), '## Round N · Attempt #N, optionally followed by " continued"'); });
        for (const c of cycles(C, f)) {
          const ls = c.lines.filter(l => C.re.lab.lessons.test(l)); const v = ls.length === 1 ? ls[0].replace(C.re.lab.lessons, '').trim() : '(lines ' + ls.length + ')';
          chk(f + ' Round ' + c.n + ' Lessons consulted', v, ls.length === 1 && (isK(v) || (!c.closed && v === U)), '#K### ascending list or ' + NONE + (c.closed ? '' : ' (open rounds: ' + U + ' allowed)'));
          c.lines.forEach((l, i) => { if (isPauseHead(C, l)) chk(f + ' Round ' + c.n + ' session-pause memo', l, pauseMemo(C, c, i) !== null, '#### YYYY-MM-DD HH:MM — Session paused + directly below the three lines Did: / Remaining: / Next first action:'); });
          if (!c.closed) continue;
          const cf = cycleFacts(C, c);
          chk(f + ' Round ' + c.n + ' Success criteria met', cf.items.length ? (cf.items.find(l => !C.re.chkDone.test(l) && !C.re.chkNot.test(l)) || '') : '(0 item lines)', cf.result !== null, '- [x] {condition}: O — {reason} or - [ ] {condition}: X — {reason}, 1 or more lines');
          const pn = linesAfter(c.lines, C.re.lab.criteria, l => /^- \[/.test(l)).length;
          chk(f + ' Round ' + c.n + ' Success criteria line count', 'CHECK ' + cf.items.length + ' lines / PLAN ' + pn + ' lines', cf.items.length === pn, 'CHECK number of Success criteria met item lines = number of PLAN Success criteria item lines');
          chk(f + ' Round ' + c.n + ' Distance to destination', cf.distRaw, cf.dist !== null, C.vocab['Distance to destination'].join('/') + ' — {Reason}');
        }
      }
      // archive/tree_YYYY-MM.md
      for (const ar of A) {
        cnt.a++; cells(ar.file + ' Migrated Attempt Summaries', ar.sum); cells(ar.file + ' Migrated Return Log', ar.back);
        chk(ar.file + ' attempts', ar.fm.attempts, isAttempts(ar.fm.attempts), '[] or [N, N] ascending');
        chk(ar.file + ' last_updated', ar.fm.last_updated, C.re.date.test(ar.fm.last_updated || ''), 'Date');
        ar.sum.data.forEach((o, i) => sumRow(ar.file + ' Migrated Attempt Summaries row ' + (i + 1) + '', o));
        ar.back.data.forEach((o, i) => backRow(ar.file + ' Migrated Return Log row ' + (i + 1) + '', o));
      }
      return bad.length ? r(BAD, bad.slice(0, 3).join(' ; ') + (bad.length > 3 ? ' and ' + (bad.length - 3) + ' more' : ''))
        : r(OK, 'formats match — 01 / 00 D# ' + cnt.d + ' / 02 ' + (idx ? idx.data.length : 0) + ' rows / lesson files ' + cnt.k + ' / session files ' + cnt.s + ' / archive files ' + cnt.a + '');
    },
    'I-05': () => {
      const bad = []; const chk = (where, val, set) => { if (!C.vocab[set].includes(val)) bad.push(where + ' = "' + val + '" (expected: ' + C.vocab[set].join('/') + ')'); };
      chk('★ Status', T.kv['Status'], 'Status');
      T.sum.data.forEach((o, i) => { chk('Attempt summary row ' + (i + 1) + ' Result', o['Result'], 'Result'); chk('Attempt summary row ' + (i + 1) + ' Conclusion', o['Conclusion'], 'Conclusion'); });
      const idx = loadIndex(); if (idx) idx.data.forEach((o, i) => chk('Lesson List row ' + (i + 1) + ' Validity', o['Validity'], 'Validity'));
      A.forEach(a => a.sum.data.forEach((o, i) => { chk(a.file + ' Migrated Attempt Summaries row ' + (i + 1) + ' Result', o['Result'], 'Result'); chk(a.file + ' Migrated Attempt Summaries row ' + (i + 1) + ' Conclusion', o['Conclusion'], 'Conclusion'); }));
      for (const c of allCycles(C)) {                                       // sessions: per round `Conclusion: {word | —}` exactly 1 line
        const ls = c.lines.filter(l => C.re.lab.conclusion.test(l)); const v = ls.length === 1 ? ls[0].replace(C.re.lab.conclusion, '').trim() : '(lines ' + ls.length + ')';
        if (!(ls.length === 1 && ls[0] === C.session.label.conclusion + ' ' + v && (v === C.token.unfilled || C.vocab['Conclusion'].includes(v)))) bad.push(c.file + ' Round ' + c.n + ' Conclusion = "' + v + '" (expected: ' + C.vocab['Conclusion'].join('/') + ' or ' + C.token.unfilled + ')');
      }
      return bad.length ? r(BAD, bad.slice(0, 3).join(' ; ')) : r(OK, 'Status "' + T.kv['Status'] + '" / Result {' + T.sum.data.map(o => o['Result']).join(', ') + '} / Conclusion {' + T.sum.data.map(o => o['Conclusion']).join(', ') + '}');
    },
    'I-06': () => {
      const bad = []; let n = 0; const empty = v => v === undefined || v === '' || v === C.token.unfilled;
      const loc = { 'Return Log': T.back, 'Discarded Directions': T.disc };
      for (const name of C.list.proseCols) {
        const f = C.fields.find(x => x.name === name);
        if (f.loc === '◎ Best Record') { if (T.bkv['Closest attempt'] !== C.token.unfilled) { n++; if (empty(T.bkv[name])) bad.push('◎ ' + name); } continue; }
        loc[f.loc].data.forEach((o, i) => { n++; if (empty(o[name])) bad.push(f.loc + ' row ' + (i + 1) + ' ' + name); });
      }
      return bad.length ? r(BAD, 'blank: ' + bad.join(' ; ')) : r(OK, 'no-compression prose columns ' + n + ' cells all filled');
    },
    'I-07': () => !starReady ? r(UNK, '★ section·Path·Attempt #: a field is not settled')
      : (nodes[0] === C.path.firstNode && nodes[nodes.length - 1] === T.kv['Attempt #']) ? r(OK, 'Path "' + T.kv['Path'] + '" / ★ Attempt # = ' + T.kv['Attempt #'])
      : r(BAD, 'Path "' + T.kv['Path'] + '" / ★ Attempt # = ' + T.kv['Attempt #'], 'first node ' + C.path.firstNode + ', end node = ★ Attempt #'),
    'I-08': () => {
      if (!starReady) return r(UNK, '★ section·Path·Attempt #: a field is not settled');
      if (nodes.length === 1) return r(SKIP, 'single-node path');
      const rows = allSum().filter(o => o['#'] === T.kv['Attempt #']);
      if (rows.length !== 1) return r(UNK, 'current attempt ' + T.kv['Attempt #'] + ' row count ' + rows.length + ' (tree+archive)');
      return rows[0]['Branch point'] === nodes[nodes.length - 2] ? r(OK, 'path end-1 = ' + nodes[nodes.length - 2] + ' / ' + T.kv['Attempt #'] + ' row Branch point = ' + rows[0]['Branch point'])
        : r(BAD, 'path end-1 = ' + nodes[nodes.length - 2] + ' / ' + T.kv['Attempt #'] + ' row Branch point = ' + rows[0]['Branch point'], 'the two values equal');
    },
    'I-09': () => {
      const bad = [], unk = []; let n = 0;
      for (const [name, t] of [['Attempt summary', T.sum], ['Discarded Directions', T.disc]]) t.data.forEach((o, i) => {
        const h = o['#'], b = o['Branch point'];
        if (h === C.token.unfilled || b === C.token.unfilled) return;
        if (!C.re.att.test(h) || !C.re.att.test(b)) { unk.push(name + ' row ' + (i + 1) + ' # "' + h + '" Branch point "' + b + '"'); return; }
        n++; if (num(b) > num(h)) bad.push(name + ' row ' + (i + 1) + ' Branch point ' + b + ' > # ' + h);
      });
      return bad.length ? r(BAD, bad.join(' ; '), 'Branch point ≤ #') : unk.length ? r(UNK, 'cannot compare: ' + unk.join(' ; ')) : r(OK, 'compared ' + n + ' rows, all Branch point ≤ #');
    },
    'I-10': () => {
      const refs = new Set();
      T.sum.data.forEach(o => (o['Lesson'].match(C.re.kAll) || []).forEach(k => refs.add(k)));
      T.back.data.forEach(o => (o['Invalidated lessons'].match(C.re.kAll) || []).forEach(k => refs.add(k)));
      if (!refs.size) return r(SKIP, 'no lesson reference');
      const idx = loadIndex(); const bad = [];
      for (const k of [...refs].sort()) {
        if (!exists(kPath(k))) bad.push(k + ' body file missing');
        if (!idx || !idx.data.some(o => o['#'] === k)) bad.push(k + ' index row missing');
      }
      return bad.length ? r(BAD, bad.join(' ; ')) : r(OK, [...refs].sort().join(', ') + ' → body exists, index row present');
    },
    'I-11': () => {
      const rows = allSum(); const bad = []; let n = 0;
      const files = kIds(C);
      for (const o of rows) for (const k of (o['Lesson'].match(C.re.kAll) || [])) {
        n++; const kf = kFile(k);
        if (!kf || !kf.related || !kList(kf.related).includes(o['#'])) bad.push('tree ' + o['#'] + ' row Lesson ' + k + ' ↛ body Related attempts "' + (kf ? kf.related : 'file missing') + '"');
      }
      for (const k of files) {
        const kf = kFile(k); if (!kf || !kf.related) continue;
        for (const a of kList(kf.related)) {
          const row = rows.find(o => o['#'] === a); if (!row) continue;
          n++; if (!(row['Lesson'].match(C.re.kAll) || []).includes(k)) bad.push('Body ' + k + ' Related attempts ' + a + ' ↛ tree ' + a + ' row Lesson "' + row['Lesson'] + '"');
        }
      }
      return !n ? r(SKIP, 'no lesson–attempt pair') : bad.length ? r(BAD, bad.join(' ; ')) : r(OK, 'lesson–attempt pairs ' + n + ' agree both ways');
    },
    'I-12': () => {
      const ps = T.fm.last_updated === C.init.date ? [] : [['★ Body', T.kv['Body']]];
      T.sum.data.forEach((o, i) => ps.push(['Attempt summary row ' + (i + 1) + '', o['Body']]));
      T.back.data.forEach((o, i) => ps.push(['Return Log row ' + (i + 1) + '', o['Body']]));
      const bad = ps.filter(([, p]) => !C.re.spath.test(p || '') || !exists(p)).map(([w, p]) => w + ' "' + p + '"');
      if (!ps.length) return r(SKIP, 'before first wrap — no body path');
      return bad.length ? r(BAD, 'derivation mismatch or file missing: ' + bad.join(' ; ')) : r(OK, [...new Set(ps.map(x => x[1]))].join(', ') + ' exist, derivation matches');
    },
    'I-13': () => {
      const v = T.bkv['Why closest'];
      if (v === undefined || v === C.token.unfilled) return r(SKIP, '◎ unfilled');
      const i = v.indexOf(' — '); const left = i < 0 ? v : v.slice(0, i); const right = i < 0 ? '' : v.slice(i + 3).trim();
      if (!C.re.near.test(left) || !right) return r(BAD, 'Why closest = "' + v + '"', '{D# met span} — {prose}');
      const have = new Set(destParse(C, tryRead(DEST) || '').items.map(it => it.id)); const miss = [...new Set(left.match(C.re.d) || [])].filter(d => !have.has(d));   // exists = in a Success Criteria item line: the D#
      return miss.length ? r(BAD, miss.join(', ') + ' item line is not in ' + DEST + ' (missing)') : r(OK, '"' + left + '" / all cited D# exist');
    },
    'I-14': () => {
      if (!S) return r(SKIP, 'no snapshot');
      const fresh = T.back.data.filter(o => !S.back.includes(o._raw));
      if (!fresh.length) return r(SKIP, 'no return in this cycle');
      const last = T.back.data[T.back.data.length - 1];
      if (!(nodes || []).includes(last['Return point'])) return r(BAD, 'Return point ' + last['Return point'] + ' ∉ Path "' + T.kv['Path'] + '"');
      return T.kv['Attempt #'] === last['Return point'] ? r(OK, 'Return point ' + last['Return point'] + ' ∈ Path "' + T.kv['Path'] + '" / ★ Attempt # = ' + T.kv['Attempt #'])
        : r(BAD, 'Return point ' + last['Return point'] + ' / ★ Attempt # = ' + T.kv['Attempt #'], 'the two values equal');
    },
    'I-15': () => {
      const o1 = openCycles(C)[0]; const M = matchNodes(C, T, A, o1 ? o1.attempt : null);
      const rows = T.disc.data.filter(o => M.set.has(o['Branch point']));
      if (!rows.length) return r(SKIP, 'no discarded row with Branch point ∈ Path');
      const ss = sessions(C); if (!ss.length) return r(BAD, 'discarded rows ' + rows.length + ' / no session file', 'Discard check line');
      const cs = cycles(C, ss[ss.length - 1]); const last = cs[cs.length - 1];
      if (last && !last.closed && planUnwritten(C, last)) return r(SKIP, ss[ss.length - 1] + ' Round ' + last.n + ' = PLAN Unwritten open round');
      const line = last ? last.lines.find(l => C.re.lab.discard.test(l)) : undefined;
      const val = line ? line.replace(C.re.lab.discard, '').trim() : '';
      return (val && val !== C.token.unfilled && val !== C.token.none) ? r(OK, 'Branch point ∈ Path discarded rows ' + rows.length + ' / ' + ss[ss.length - 1] + ' Discard check recorded')
        : r(BAD, 'Branch point ∈ Path discarded rows ' + rows.length + ' / ' + ss[ss.length - 1] + ' Discard check = "' + val + '"', 'a basis for the check');
    },
    'I-16': () => {
      const aSum = [].concat(...A.map(a => a.sum.data)), aBack = [].concat(...A.map(a => a.back.data));
      const key = x => x.split(' | ')[0];                                   // attempt summary rows are matched by # value (a row whose result·conclusion·lesson wrap edited is not a missing row)
      const rmSum = S ? S.sum.filter(x => !T.sum.data.some(o => o['#'] === key(x))) : [], rmBack = S ? S.back.filter(x => !T.back.data.some(o => o._raw === x)) : [];
      const removed = rmSum.concat(rmBack);
      if (!aSum.length && !aBack.length && !removed.length) return r(SKIP, 'no migrated rows');
      const bad = [];
      T.sum.data.filter(o => aSum.some(x => x['#'] === o['#'])).forEach(o => bad.push('Attempt ' + o['#'] + ' is in both the tree and an archive'));
      T.back.data.filter(o => aBack.some(x => x._raw === o._raw)).forEach(o => bad.push('return row "' + o._raw + '"  is on both sides'));
      rmSum.filter(x => !aSum.some(o => o['#'] === key(x))).concat(rmBack.filter(x => !aBack.some(o => o._raw === x))).forEach(x => bad.push('a row missing from the tree is not in an archive: "' + x + '"'));
      return bad.length ? r(BAD, bad.join(' ; ')) : r(OK, 'Archive ' + (aSum.length + aBack.length) + ' rows / moved this time ' + removed.length + ' rows / duplicates·losses 0');
    },
    'I-17': () => {
      const months = A.filter(a => a.sum.data.length || a.back.data.length).map(a => a.month).sort();
      const exp = months.length ? months[months.length - 1] : C.token.none;
      if (!months.length && T.fm.archived_through === C.token.none) return r(SKIP, 'no migrated rows');
      return T.fm.archived_through === exp ? r(OK, 'archived_through = ' + exp) : r(BAD, 'archived_through = ' + T.fm.archived_through, exp);
    },
    'I-18': () => {
      const bad = []; let n = 0;
      for (const a of A) for (const o of a.sum.data.concat(a.back.data)) {
        n++; const m = (o['Body'] || '').match(C.re.spath);
        if (!m || m[1].slice(0, 7) !== a.month) bad.push(a.file + ' row Body "' + o['Body'] + '"');
      }
      return !n ? r(SKIP, 'no migrated rows') : bad.length ? r(BAD, 'month mismatch: ' + bad.join(' ; ')) : r(OK, 'migrated ' + n + ' rows: Body month = file month');
    },
    'I-19': () => {
      const idx = loadIndex(); const rows = idx ? idx.data : []; const files = kIds(C);
      if (!rows.length && !files.length) return r(SKIP, 'no lesson index row · no lesson file');
      const bad = [];
      files.filter(k => !rows.some(o => o['#'] === k)).forEach(k => bad.push(k + ' body file exists but index row missing'));
      for (const o of rows) {
        const kf = kFile(o['#']); const body = !!kf && kf.invalid !== null && kf.invalid !== C.token.none;
        if (!kf) bad.push(o['#'] + ' body file missing'); else if ((o['Validity'] === C.vocab['Validity'][1]) !== body) bad.push(o['#'] + ' index "' + o['Validity'] + '" / body Invalidation "' + kf.invalid + '"');
      }
      return bad.length ? r(BAD, bad.join(' ; ')) : r(OK, 'index ' + rows.length + ' rows: Validity ⟺ body Invalidation agree / lesson files ' + files.length + ' = index # set');
    },
    'I-20': () => {
      const all = allCycles(C); const bad = [], unk = []; const X = T.kv['Attempt #'];
      if (!C.re.att.test(X || '')) unk.push('★ Attempt # = "' + X + '"');
      else { const d = deriveState(C, X, all); if (d.state === null) unk.push('★ status cannot be computed — ' + d.why); else if (T.kv['Status'] !== d.state) bad.push('★ Status = "' + T.kv['Status'] + '" (computed: ' + d.state + ')'); }
      T.sum.data.forEach((o, i) => {
        const w = 'Attempt summary row ' + (i + 1) + ' ' + o['#'];
        if (!C.re.att.test(o['#'])) { unk.push(w + ' # format mismatch'); return; }
        const d = deriveState(C, o['#'], all);
        if (!d.hasClosed) { bad.push(w + ' no closed round in the session files'); return; }
        if (d.result === null) unk.push(w + ' result cannot be computed — ' + d.resultWhy); else if (o['Result'] !== d.result) bad.push(w + ' Result = "' + o['Result'] + '" (computed: ' + d.result + ')');
        if (o['Conclusion'] !== d.concl) bad.push(w + ' Conclusion = "' + o['Conclusion'] + '" (' + d.where + ' Conclusion: ' + d.concl + ')');
        if (d.concl === C.vocab['Conclusion'][2] && !T.disc.data.some(x => x['#'] === o['#'])) bad.push(w + ' Conclusion is Discarded but Discarded Directions lacks ' + o['#'] + ' row');
      });
      const CANCELED = C.vocab['Status'][5]; let nd = 0;                      // an attempt with a number in the Discarded Directions table must still be in the discarded status
      T.disc.data.forEach((o, i) => {
        if (!C.re.att.test(o['#'])) return;                                 // # = — (a candidate discarded without running) is not an attempt
        nd++; const w = 'Discarded Directions row ' + (i + 1) + ' ' + o['#']; const d = deriveState(C, o['#'], all);
        if (d.state === null) unk.push(w + ' status cannot be computed — ' + d.why); else if (d.state !== CANCELED) bad.push(w + ' computed status = "' + d.state + '" (expected: ' + CANCELED + ')');
        const sr = allSum().filter(x => x['#'] === o['#']);                 // when the branch point differs, that row drops out of the discard check candidates
        if (sr.length === 1 && sr[0]['Branch point'] !== o['Branch point']) bad.push(w + ' Branch point = "' + o['Branch point'] + '" (attempt summary row Branch point: ' + sr[0]['Branch point'] + ')');
      });
      return bad.length ? r(BAD, bad.slice(0, 3).join(' ; ') + (bad.length > 3 ? ' and ' + (bad.length - 3) + ' more' : ''))
        : unk.length ? r(UNK, unk.join(' ; ')) : r(OK, '★ Status "' + T.kv['Status'] + '" = computed / Attempt summary ' + T.sum.data.length + ' rows Result·Conclusion = computed / discarded attempts ' + nd + ' status = ' + CANCELED);
    },
    'I-21': () => destI21(C),
    'I-22': () => destI22(C),
    'I-23': () => { const o = openCycles(C); return o.length <= 1 ? r(OK, 'open rounds ' + o.length + '' + (o.length ? ' (' + o[0].file + ' Round ' + o[0].n + ' · Attempt ' + o[0].attempt + ')' : ''))
      : r(BAD, 'open rounds ' + o.length + ': ' + o.map(c => c.file + ' Round ' + c.n + '').join(' ; '), '1 or fewer'); },
  };
}

function runCheck(ids) {
  const C = loadConstants(); const T = loadTree(C);
  if (!T) throw new Error(TREE + ' not found');
  const A = loadArchive(); let S = null;
  try { S = JSON.parse(read(SNAP)); } catch { S = null; }
  const checks = buildChecks(C, T, A, S); const res = [];
  const have = Object.keys(checks).sort();                                 // the check function list must equal the invariant list of the conventions (so an item on one side only does not drop out silently)
  if (have.join() !== C.check.all.join()) throw new Error('invariant list mismatch — tables of the conventions: ' + C.check.all.join(', ') + ' / nav.js: ' + have.join(', '));
  for (const id of ids) { let x; try { x = checks[id](); } catch (e) { x = r(BAD, 'error during check: ' + e.message, 'the check runs to the end'); } res.push(Object.assign({ id }, x)); }   // a check that ended in an exception is written as a violation and put in the IsolationSet (left as ⚠ it would pass the whole check)
  const alerts = [];
  const nl = T.md.split('\n').length; const W = C.alert; if (nl > W.treeLines) alerts.push(TREE + ' ' + nl + ' lines (threshold ' + W.treeLines + ') — time to archive');
  if (T.nodes && T.nodes.length > W.pathNodes) alerts.push('path nodes ' + T.nodes.length + ' (threshold ' + W.pathNodes + ') — the path is getting long');
  const idx = loadIndex(); if (idx && idx.data.length > W.lessons) alerts.push('Lesson List ' + idx.data.length + ' rows (threshold ' + W.lessons + ')');
  return { res, alerts };
}
function formatCheck({ res, alerts }, c3) {
  const out = ['[Invariant check' + (c3 ? ' · C3' : '') + ']  ' + today() + '  /  checked by: nav.js'];
  for (const x of res) out.push(' ' + x.id + '  ' + x.v + '  ' + x.msg + (x.exp !== undefined ? '\n           expected: ' + x.exp : ''));
  const n = v => res.filter(x => x.v === v).length; const q = res.filter(x => x.v === BAD || (c3 && x.v === UNK)).map(x => x.id);
  out.push('Result: pass ' + n(OK) + ' / violation ' + n(BAD) + ' / undetermined ' + n(UNK) + ' / skipped ' + n(SKIP));
  out.push('IsolationSet: ' + (q.length ? q.join(', ') : 'None'));
  for (const a of alerts) out.push('[Notice] ' + a);
  return out.join('\n');
}

// ── lookups ──
const openCycles = C => allCycles(C).filter(c => !c.closed).reverse();     // all session files · newer file and higher round first
function currentState(C, T) {                                             // target attempt = with an open round, the attempt of the first OpenRound line of route (searched across all session files); otherwise the ★ attempt
  const open = openCycles(C);
  const X = open.length ? open[0].attempt : T.kv['Attempt #']; const d = deriveState(C, X);
  return (d.state !== null ? d.state : UNKNOWN + ' — ' + d.why) + ' (Attempt ' + X + (open.length ? ' · open Round ' + open[0].n + '' : '') + ')';
}
function cmdState(X) {
  const C = loadConstants();
  if (!C.re.att.test(X || '')) throw new Error('state argument "' + X + '"  is not in attempt number format (#N)');
  const d = deriveState(C, X);
  return ['Attempt: ' + X,
    'Result: ' + (!d.hasClosed ? C.token.none : d.result !== null ? d.result : UNKNOWN + ' — ' + d.resultWhy),
    'Conclusion: ' + (!d.hasClosed ? C.token.none : d.concl),
    'Status: ' + (d.state !== null ? d.state : UNKNOWN + ' — ' + d.why)].join('\n');
}
function cmdStatus() {
  const C = loadConstants(); const T = loadTree(C);
  return ['[Current position] Attempt ' + T.kv['Attempt #'] + ' — ' + T.kv['Direction'], '[Status] ' + currentState(C, T), '[Do-not-retry directions] ' + T.disc.data.length + ' — ' + TREE + ' Discarded Directions table'].join('\n');
}
const linesAfter = (L, re, ok) => { const i = L.findIndex(l => re.test(l)); const a = []; if (i >= 0) for (let j = i + 1; j < L.length && ok(L[j]); j++) a.push(L[j]); return a; };
function cycleBody(C, c) {                                                // goal·hypothesis·success criteria·DO header list copied character for character from the round block
  const L = c.lines; const out = [];
  const goal = L.find(l => C.re.lab.goal.test(l)); out.push('  Goal: ' + (goal ? goal.replace(C.re.lab.goal, '').trim() : C.token.none));
  out.push('  Hypothesis:'); linesAfter(L, C.re.lab.hypothesis, l => /^>/.test(l)).forEach(l => out.push('    ' + l));
  out.push('  Success Criteria:'); linesAfter(L, C.re.lab.criteria, l => /^- \[/.test(l)).forEach(l => out.push('    ' + l));
  const dos = doItems(c); out.push('  DO: ' + dos.length + ''); dos.forEach(d => out.push('    ' + d.head));
  return out;
}
function cmdLast(X) {                                                     // the most recent closed round of attempt X (the same round the status computation reads)
  const C = loadConstants();
  if (!C.re.att.test(X || '')) throw new Error('last argument "' + X + '"  is not in attempt number format (#N)');
  const closed = allCycles(C).filter(c => c.attempt === X && c.closed);
  if (!closed.length) return '[Last round] ' + C.token.none;
  const c = closed[closed.length - 1]; const f = cycleFacts(C, c); const L = c.lines;
  const out = ['[Last round] Round ' + c.n + ' · Attempt ' + c.attempt + ' · ' + c.file].concat(cycleBody(C, c));
  out.push('  Success criteria met:'); f.items.forEach(l => out.push('    ' + l));
  out.push('  Distance to destination: ' + f.distRaw);
  out.push('  Conclusion: ' + f.concl);
  out.push('  Reason:'); linesAfter(L, C.re.lab.reason, l => /^>/.test(l)).forEach(l => out.push('    ' + l));
  return out.join('\n');
}
function cmdOnpath(X) {                                                   // comparison values of attempt X and the ★ path (Contract → NOTATION_CONVENTIONS: grep -F "anchor:check-execution")
  const C = loadConstants();
  if (!C.re.att.test(X || '')) throw new Error('onpath argument "' + X + '"  is not in attempt number format (#N)');
  const T = loadTree(C); if (!T) throw new Error(TREE + ' not found');
  if (!T.nodes || !T.nodes.every(n => C.re.att.test(n))) throw new Error('★ Path "' + T.kv['Path'] + '"  cannot be read as nodes');
  const all = T.sum.data.concat(...loadArchive().map(a => a.sum.data)); const rows = all.filter(o => o['#'] === X);
  if (rows.length > 1) throw new Error('Attempt ' + X + ' row count ' + rows.length + ' (tree+archive)');
  const ch = chainOf(C, all, X);
  return ['Path: ' + T.kv['Path'], 'EndNode: ' + T.nodes[T.nodes.length - 1], 'Contains: ' + (T.nodes.includes(X) ? 'Yes' : 'No'), 'RowBranchPoint: ' + (rows.length ? rows[0]['Branch point'] : C.token.none),
    'ChainPath: ' + (ch ? ch.join(C.path.separator) : C.token.none)].join('\n');
}
function cmdBrief(file, n) {
  const C = loadConstants(); const T = loadTree(C); const out = [];
  out.push('[Path] ' + T.kv['Path']);
  out.push('[Current position] Attempt ' + T.kv['Attempt #'] + ' — ' + T.kv['Direction'] + ' / Status: ' + currentState(C, T));
  const dest = (tryRead(DEST) || '').split('\n'); const ds = [];
  dest.forEach((l, i) => { const m = l.match(C.re.dItem); if (m) ds.push(m[2] + ' [' + m[1] + '] ' + m[3] + ' / ' + (dest[i + 1] || '').trim()); });
  out.push('[Destination criterion] ' + ds.length + ''); ds.forEach(d => out.push('  - ' + d));
  const near = T.bkv['Closest attempt'];
  out.push('[Best Record] ' + (near === undefined || near === '' || near === C.token.unfilled ? C.token.none : near + ' | ' + T.bkv['Why closest'] + ' | What blocked it: ' + T.bkv['What blocked it']));
  const oc = file === undefined ? openCycles(C)[0] : openCycles(C).find(c => c.file === file && String(c.n) === String(n));
  if (file !== undefined && !oc) throw new Error('brief argument "' + file + ' ' + n + '"  matches no open round');
  const M = matchNodes(C, T, loadArchive(), oc ? oc.attempt : null);
  const rows = T.disc.data.filter(o => M.set.has(o['Branch point']));
  out.push('[Discard check candidates] ' + rows.length + ' (Branch point ∈ Path' + (M.chain ? ' ∪ Attempt ' + oc.attempt + ' ChainPath ' + M.chain.join(C.path.separator) : '') + ')');
  rows.forEach(o => out.push('  - ' + o['#'] + ' | Branch point ' + o['Branch point'] + ' | ' + o['Direction'] + ' | Discard reason: ' + o['Discard reason'] + ' | Retry condition: ' + o['Retry condition']));
  const idx = loadIndex(); const live = idx ? idx.data.filter(o => o['Validity'] === C.vocab['Validity'][0]) : [];
  out.push('[Valid lessons] ' + live.length + ''); live.forEach(o => out.push('  - ' + o['#'] + ' | ' + o['Summary'] + ' | ' + o['Applies when']));
  out.push('[Next Direction Candidates] ' + T.cand.length + ''); T.cand.forEach(l => out.push('  ' + l));
  if (!oc) { out.push('[Open cycle] ' + C.token.none); out.push('[Resume point] ' + C.token.none); return out.join('\n'); }
  out.push('[Open cycle] Round ' + oc.n + ' · Attempt ' + oc.attempt + ' · ' + oc.file);
  cycleBody(C, oc).forEach(l => out.push(l)); const dos = doItems(oc);
  out.push('  PLAN: ' + (planUnwritten(C, oc) ? 'Unwritten' : 'Written'));
  const last = dos[dos.length - 1]; const memo = last && isPauseHead(C, last.head) ? pauseMemo(C, oc, last.i) : null;
  out.push('[Resume point] ' + (memo ? memo.join(' | ') : C.token.none));
  return out.join('\n');
}
function cmdRoute() {
  const C = loadConstants(); const T = loadTree(C); const A = loadArchive(); const ss = sessions(C); const out = [];
  const latest = ss.length ? ss[ss.length - 1] : null; const cs = latest ? cycles(C, latest) : [];
  const todayFile = C.path['Body'].prefix + today() + C.path['Body'].suffix;
  const open = openCycles(C);
  const treeAtt = new Set(); const add = v => { if (C.re.att.test(v || '')) treeAtt.add(v); };
  (T.nodes || []).forEach(add); T.sum.data.forEach(o => add(o['#'])); T.disc.data.forEach(o => add(o['#']));
  const every = new Set(treeAtt); A.forEach(a => a.sum.data.forEach(o => { if (C.re.att.test(o['#'] || '')) every.add(o['#']); }));   // a # with a broken format is not counted (I-04 catches it)
  ss.forEach(f => cycles(C, f).forEach(c => every.add(c.attempt)));
  const sorted = s => [...s].sort((a, b) => num(a) - num(b));
  out.push('Today: ' + today());
  { const d = new Date(); const z = n => String(n).padStart(2, '0'); out.push('Now: ' + z(d.getHours()) + ':' + z(d.getMinutes())); }
  out.push('LatestSessionPath: ' + (latest || C.token.none));
  out.push('TodayFileExists: ' + (latest === todayFile ? 'Yes' : 'No'));
  out.push('RoundSet: ' + (cs.length ? cs.map(c => c.n).join(', ') : C.token.none));
  out.push('OpenRoundCount: ' + open.length);
  open.forEach(c => out.push('OpenRound: Round ' + c.n + ' · Attempt ' + c.attempt + (c.cont ? ' continued' : '') + ' · ' + c.file));
  out.push('NextRound: ' + (latest === todayFile ? Math.max(...cs.map(c => c.n), 0) + 1 : 1));
  const dropped = new Set(T.disc.data.map(o => o['#']));                    // an attempt with a # in the Discarded Directions table = not resumed
  const contSet = new Set(); const addC = v => { if (C.re.att.test(v || '')) contSet.add(v); };   // set for the list (separate from treeAtt): path nodes + attempt summaries of the tree·archives
  (T.nodes || []).forEach(addC); T.sum.data.forEach(o => addC(o['#'])); A.forEach(a => a.sum.data.forEach(o => addC(o['#'])));
  const all = allCycles(C);
  const cont = sorted(contSet).filter(a => a !== C.path.firstNode && !dropped.has(a))    // #0 = the state before the first attempt → not an attempt to resume
    .map(a => { const d = deriveState(C, a, all); return a + ' (' + (d.state !== null ? d.state : UNKNOWN) + ')'; });
  out.push('ResumableAttempts: ' + (cont.length ? cont.join(', ') : C.token.none));
  out.push('NextAttemptNumber: #' + (every.size ? Math.max(...[...every].map(num)) + 1 : 1));
  return out.join('\n');
}
function cmdDestCreate() {
  const C = loadConstants();
  if (exists(DEST)) throw new Error(DEST + ' already exists — not created');
  fs.writeFileSync(P(DEST), C.dest.template.join('\n') + '\n');
  return 'Destination file created: ' + DEST + ' (structure template ' + C.dest.template.length + ' lines)';
}
function cmdDest() {
  const C = loadConstants(); const md = tryRead(DEST); const out = ['Today: ' + today()];
  const line = (id, x) => ' ' + id + '  ' + x.v + '  ' + x.msg + (x.exp !== undefined ? '\n           expected: ' + x.exp : '');
  const a = destI21(C), b = destI22(C); const F = destParse(C, md || ''); const rec = destRecorded(C);
  out.push('DestinationFile: ' + (md === null ? C.token.none : 'Present'));
  const pristine = md === null || destLines(md).join('\n') === C.dest.template.join('\n');
  out.push('DestinationStatus: ' + (pristine ? 'Unwritten' : a.v === OK && b.v !== BAD ? 'Written' : 'FormatViolation'));
  const goal = F.sec[destParse(C, C.dest.template.join('\n')).h2[0]] || [];
  out.push('Final Goal: ' + (!pristine && goal.length === 1 ? goal[0] : C.token.none));
  if (!pristine) F.items.forEach(it => out.push('Criterion: ' + [it.id, '[' + it.box + ']', C.dest.kinds.find(k => (it.sub || '').startsWith('### ' + k)) || C.token.none, it.eff === null ? C.token.none : it.eff, it.id in rec ? 'Recorded' : 'Unrecorded', it.text].join(' | ')));
  const ns = pristine ? [] : F.items.map(it => num(it.id.slice(1)));
  out.push('NextCriterionNumber: D' + (ns.length ? Math.max(...ns) + 1 : 1));
  out.push(line('I-21', a)); out.push(line('I-22', b));
  return out.join('\n');
}
function cmdRecover() {
  const C = loadConstants(); const T = loadTree(C); const out = [];
  const locks = list('locks').filter(f => /\.lock$/.test(f)).sort();
  const stray = locks.filter(f => f !== 'invalidation.lock');               // there is one invalidation marker file. A .lock with another name is not read and stops the run (the only file start deletes is invalidation.lock)
  if (stray.length) throw new Error('locks/' + stray.join(', locks/') + ' — the only invalidation marker name is locks/invalidation.lock');
  if (!locks.length) return 'Marker: ' + C.token.none;
  const idx = loadIndex(); const pending = [];
  for (const f of locks) {
    const lines = read('locks/' + f).split('\n').map(l => l.trim()).filter(Boolean);
    const SL = C.lock.sessionLabel; const sess = (lines.find(l => l.startsWith(SL)) || SL).slice(SL.length).trim();
    const odd = lines.filter(l => !l.startsWith(SL) && l !== C.lock.targetLabel && !C.re.lockTarget.test(l));   // a line that fits none of the three formats is not skipped; the run stops (skipping it would drop that target from Incomplete)
    if (odd.length) throw new Error('locks/' + f + ' — lines that do not fit the format ' + odd.length + ': "' + odd[0] + '" (allowed: ' + SL + ' lines · ' + C.lock.targetLabel + ' line · target line)');
    out.push('Marker: locks/' + f); out.push('Session: ' + sess);
    const last = T.back.data[T.back.data.length - 1];
    for (const l of lines) {
      if (!C.re.lockTarget.test(l)) continue; const cut = l.indexOf(' — '); const m = [l, l.slice(0, cut), l.slice(cut + 3)];
      const k = m[1]; const row = idx ? idx.data.find(o => o['#'] === k) : null; const kf = kFile(k);
      const a = !!row && row['Validity'] === C.vocab['Validity'][1];
      const b = !!kf && kf.invalid !== null && kf.invalid !== C.token.none;
      const c = !!last && (last['Invalidated lessons'].match(C.re.kAll) || []).includes(k);
      out.push('Target: ' + k + ' — ' + m[2] + ' | IndexInvalid=' + a + ' BodyInvalidation=' + b + ' TreeInvalidated=' + c);
      if (!(a && b && c)) pending.push(k);
    }
  }
  out.push('Incomplete: ' + (pending.length ? pending.join(', ') : C.token.none));
  return out.join('\n');
}
function cmdSnapshot() {
  const C = loadConstants(); const T = loadTree(C);
  fs.mkdirSync(P('locks'), { recursive: true });
  fs.writeFileSync(P(SNAP), JSON.stringify({ date: today(), sum: T.sum.data.map(o => o._raw), back: T.back.data.map(o => o._raw) }, null, 2) + '\n');
  return 'Snapshot recorded: ' + SNAP + ' (Attempt summary ' + T.sum.data.length + ' rows / Return Log ' + T.back.data.length + ' rows)\n' + writeHistory();
}
// ── history: appends 00·01·02 as of right before wrap to 1 file per month (history/YYYY-MM.log) (checks that read it = I-22 · dest) ──
// entry = header line `@@ History NNNN | YYYY-MM-DD | {file} | {n} lines` + the n lines directly below (the full text of that file). Only files that differ from their previous history entry are written.
const raw = rel => { try { return fs.readFileSync(P(rel), 'utf8'); } catch { return null; } };
let CC = null; const consts = () => CC || (CC = loadConstants());
function histEntries() {                                                  // [{n, date, file, text}] ascending numbers
  const out = [];
  const K = consts(); const day = K.regex.dateLiteral.replace(/^\^/, '').replace(/\$$/, '');
  const HEAD = new RegExp('^@@ History ([0-9]{4,}) \\| (' + day + ') \\| (.+) \\| ([0-9]+) lines$'); const LOG = new RegExp('^' + K.regex.id['ArchiveMonth'] + '\\.log$');
  for (const f of list(HIST).filter(x => LOG.test(x)).sort()) {
    const lines = read(HIST + '/' + f).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(HEAD); if (!m) continue;
      const k = parseInt(m[4], 10); out.push({ n: parseInt(m[1], 10), date: m[2], file: m[3], text: lines.slice(i + 1, i + 1 + k).join('\n') }); i += k;
    }
  }
  return out.sort((x, y) => x.n - y.n);
}
const histAt = (es, n, f) => { const e = es.filter(x => x.file === f && x.n <= n).pop(); return e ? e.text : null; };   // n: full text of file f as of history entry n
const pad = n => String(n).padStart(4, '0');
function writeHistory() {
  const es = histEntries(); const last = es.length ? es[es.length - 1].n : 0;
  const changed = HFILES.map(f => ({ f, t: raw(f) })).filter(x => x.t !== null).map(x => ({ f: x.f, t: norm(x.t) })).filter(x => histAt(es, last, x.f) !== x.t);
  if (!changed.length) return 'History: no change (latest ' + pad(last) + ')';
  const n = last + 1, d = today(), rel = HIST + '/' + d.slice(0, 7) + '.log';
  fs.mkdirSync(P(HIST), { recursive: true });
  fs.appendFileSync(P(rel), changed.map(x => '@@ History ' + pad(n) + ' | ' + d + ' | ' + x.f + ' | ' + x.t.split('\n').length + ' lines\n' + x.t + '\n').join(''));
  return 'History recorded: ' + pad(n) + ' (' + rel + ' · changed files ' + changed.length + ')';
}
function cmdHistory() {
  const es = histEntries(); if (!es.length) return 'History: ' + consts().token.none;
  const ns = [...new Set(es.map(e => e.n))];
  return ns.map(n => { const g = es.filter(e => e.n === n); return pad(n) + ' | ' + g[0].date + ' | ' + g.map(e => e.file).join(', '); }).join('\n');
}
function cmdDiff(a, b) {
  const es = histEntries();
  const pick = v => { if (!/^[0-9]+$/.test(v || '')) throw new Error('diff argument "' + v + '"  is not a history number (digits)'); const n = parseInt(v, 10); const e = es.find(x => x.n === n); if (!e) throw new Error('History ' + v + ' not found'); return e; };
  const A = pick(a); const B = b === undefined ? null : pick(b);
  const out = ['[Compare] History ' + pad(A.n) + ' (' + A.date + ') → ' + (B ? 'History ' + pad(B.n) + ' (' + B.date + ')' : 'current files')];
  for (const f of HFILES) {
    const x = (histAt(es, A.n, f) || '').split('\n'), y = ((B ? histAt(es, B.n, f) : norm(raw(f) || '')) || '').split('\n');
    const minus = x.filter(l => !y.includes(l)), plus = y.filter(l => !x.includes(l));
    out.push(f + ': ' + (minus.length || plus.length ? '-' + minus.length + ' / +' + plus.length : 'no change'));
    minus.forEach(l => out.push('- ' + l)); plus.forEach(l => out.push('+ ' + l));
  }
  return out.join('\n');
}
function cmdAnchor(key) {
  const lines = read(SPEC).split('\n');
  const o = lines.reduce((a, l, i) => l === '<!-- anchor:' + key + ' -->' ? a.concat(i) : a, []);
  const c = lines.reduce((a, l, i) => l === '<!-- anchor-end:' + key + ' -->' ? a.concat(i) : a, []);
  if (o.length !== 1 || c.length !== 1 || o[0] > c[0]) throw new Error('anchor "' + key + '" resolution failed (open ' + o.length + ' / close ' + c.length + ')');
  return lines.slice(o[0] + 1, c[0]).join('\n');
}

const openCycleList = () => openCycles(loadConstants()).map(c => ({ file: c.file, n: c.n, attempt: c.attempt }));   // DO record hook uses this (target round = first item)
const hookTools = () => loadConstants().hook;
module.exports = { runCheck, formatCheck, BAD, UNK, openCycleList, hookTools, get ALL() { return consts().check.all; }, get C3() { return consts().check.c3; } };   // the lists come from the constants (invariant tables · check-execution table of the conventions)

if (require.main === module) {
  const [cmd, arg, arg2] = process.argv.slice(2);
  try {
    let out;
    const USAGE = 'check [--c3] | status | state {#N} | brief [{path} {round}] | last {#N} | onpath {#N} | route | dest [--create] | recover | snapshot | history | diff {A} [{B}] | anchor {key}';
    const only = (...ok) => { if (arg !== undefined && !ok.includes(arg)) throw new Error(cmd + ' argument "' + arg + '" is unknown — Usage: ' + USAGE); };   // an unknown option is not run as the default behavior
    if (cmd === 'check') { only('--c3'); out = formatCheck(runCheck(arg === '--c3' ? consts().check.c3 : consts().check.all), arg === '--c3'); }
    else if (cmd === 'status') out = cmdStatus();
    else if (cmd === 'state') out = cmdState(arg);
    else if (cmd === 'brief') out = cmdBrief(arg, arg2);
    else if (cmd === 'last') out = cmdLast(arg);
    else if (cmd === 'onpath') out = cmdOnpath(arg);
    else if (cmd === 'route') out = cmdRoute();
    else if (cmd === 'dest') { only('--create'); out = arg === '--create' ? cmdDestCreate() : cmdDest(); }
    else if (cmd === 'recover') out = cmdRecover();
    else if (cmd === 'snapshot') out = cmdSnapshot();
    else if (cmd === 'history') out = cmdHistory();
    else if (cmd === 'diff') out = cmdDiff(arg, arg2);
    else if (cmd === 'anchor' && arg) out = cmdAnchor(arg);
    else throw new Error((cmd === 'anchor' ? 'anchor argument missing' : 'unknown command "' + cmd + '"') + ' — Usage: ' + USAGE);   // commands stop only on a [nav.js error] line
    process.stdout.write(out + '\n');
  } catch (e) { process.stdout.write('[nav.js error] ' + e.message + '\n'); process.exit(1); }
}
