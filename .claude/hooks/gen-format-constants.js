#!/usr/bin/env node
/*
 * gen-format-constants.js — format constants generator · stage 11.5 (Path B)
 *
 * Canonical source (single source) = the format anchors of the notation conventions. This script reads those anchor blocks and
 * deterministically derives the regexes, vocabulary and constants used for checks.  Contract → notation conventions: grep -F "anchor:integrity-hook-format-loading"
 *
 * Source anchors (fixed list):
 *   anchor:pk-definition-table · anchor:enum-column-vocab · anchor:column-kind-definitions ·
 *   anchor:composite-why-closest · anchor:01-format-position-path-attempt ·
 *   anchor:01-field-format-table · anchor:date-literal-full-list · anchor:other-files-fk-table ·
 *   anchor:composite-in-effect · anchor:composite-invalidation · anchor:notation-grammar ·
 *   anchor:00-file-structure · anchor:00-writing-rules · anchor:candidate-format ·
 *   anchor:session-file-structure · anchor:do-record-hook-rules · anchor:check-execution ·
 *   anchor:invariant-table-T1 · anchor:invariant-table-T2 · anchor:invariant-table-T3 ·
 *   anchor:marker-grammar · anchor:k-file-structure · anchor:01-format-discarded-directions
 *
 * Usage:
 *   node gen-format-constants.js --emit    → print the regenerated constants to stdout (byte-stable: sorted keys·LF·2-space)
 *   node gen-format-constants.js --write   → hooks/format-constants.json : written there
 *   node gen-format-constants.js --check    → regenerated == committed, byte comparison. Same exit 0 / different exit 1 (for V1)
 */
'use strict';
const fs = require('fs');
const path = require('path');
 
const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const SPEC = path.join(ROOT, 'NOTATION_CONVENTIONS');
const OUT  = path.join(ROOT, '.claude', 'hooks', 'format-constants.json');
 
const SOURCE_ANCHORS = [
  'pk-definition-table','enum-column-vocab','column-kind-definitions','composite-why-closest',
  '01-format-position-path-attempt','01-field-format-table','date-literal-full-list','other-files-fk-table',
  'composite-in-effect','composite-invalidation','notation-grammar',
  '00-file-structure','00-writing-rules','candidate-format',
  'session-file-structure','do-record-hook-rules',
  'check-execution','invariant-table-T1','invariant-table-T2','invariant-table-T3','marker-grammar','k-file-structure','01-format-discarded-directions',
];
 
// Extract an anchor block: <!-- anchor:KEY --> … <!-- anchor-end:KEY -->
function block(spec, key) {
  const re = new RegExp('<!-- anchor:' + key + ' -->([\\s\\S]*?)<!-- anchor-end:' + key + ' -->');
  const m = spec.match(re);
  if (!m) throw new Error('anchor not found: ' + key);
  return m[1];
}
 
// ── Common extraction helpers (table rows · code spans · \| restore) ──
function tableRows(md) {
  const out = [];
  for (const l of md.split('\n')) {
    if (!/^\s*\|/.test(l)) continue;
    if (/^\s*\|[\s|:\-]*$/.test(l)) continue;            // skip the divider
    const cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());
    out.push(cells);
  }
  return out;
}
function codespan(s) { const m = String(s).match(/`([^`]*)`/); return m ? m[1] : null; }
function unesc(s) { return String(s).replace(/\\\|/g, '|'); }
 
function build() {
  const spec = fs.readFileSync(SPEC, 'utf8').replace(/\r\n/g, '\n'); // CRLF→LF: the same constants whatever the line endings of the source (mechanical consistency)
  const src = {};
  for (const k of SOURCE_ANCHORS) src[k] = block(spec, k);
 
  const id = parsePkRegex(src['pk-definition-table']);                  // {Attempt,Lesson,DestinationCriterion,Session,ArchiveMonth}
  const dateLiteral = parseDateLiteral(src['column-kind-definitions']);   // ^[0-9]{4}-[0-9]{2}-[0-9]{2}$
  const run = parseCheckRun(src['check-execution']);                 // {alert, c3}
  const all = parseInvariants([src['invariant-table-T1'], src['invariant-table-T2'], src['invariant-table-T3']]);
  if (!run.c3.every(x => all.includes(x))) throw new Error('build: C3 list has an item not in the invariant tables');
  const lock = parseLock(src['marker-grammar']);                    // {target, sessionLabel, targetLabel}
  const C = {
    check:  { all, c3: run.c3 },                             // invariant list (# column of the three tables) · C3 list (check --c3 row of the check-execution table)
    alert:  run.alert,                                       // [Notice] alert thresholds {treeLines, pathNodes, lessons}
    lock:   { sessionLabel: lock.sessionLabel, targetLabel: lock.targetLabel },             // session line label of the invalidation marker
    kfile:  parseKFile(src['k-file-structure']),                    // line labels of a lesson file {label:{found, related, invalid}}
    _generated: {
      note: 'Generated — do not edit by hand. Canonical source = the format anchors of the notation conventions. Regenerate: node .claude/hooks/gen-format-constants.js --write. Freshness = --check byte comparison',
      source_anchors: SOURCE_ANCHORS,
    },
    regex: {
      id,
      dateLiteral,
      nearReason:  fill(parseIdSpan(src['composite-why-closest']), id, dateLiteral),
      candidate:   fill(parseCandidate(src['candidate-format']), id, dateLiteral), // next direction candidate line
      invalidationId: fill(parseIdSpan(src['composite-invalidation']), id, dateLiteral), // left span of invalidation (1 session PK)
      effective:   parseEffective(src['composite-in-effect']).map(x => fill(x, id, dateLiteral)), // In effect value regexes (passes if any one matches)
      discovered:  parseDiscovered(src['notation-grammar'], id, dateLiteral), // Discovered ^#N (date)$
      sessionHeader: fill(parseSessionHeader(src['other-files-fk-table']), id, dateLiteral), // ^## N round · Attempt #P( continued)?$
      checkItem:   parseCheckItem(src['other-files-fk-table']),      // [met line, not-met line]
      pauseMemo:   parsePauseMemo(src['other-files-fk-table']).map(x => fill(x, id, dateLiteral)), // [header, Did, Remaining, Next first action]
      destItem:    fill(parseLineRegex(src['00-writing-rules'], 'Item line regex'), id, dateLiteral), // destination criterion item line (group 1 = check, 2 = D#, 3 = wording)
      lockTarget:  fill(lock.target, id, dateLiteral),        // target line of the invalidation marker
      sumHeader:   parseTableHeader(src['01-format-position-path-attempt']), // header row of the Recent Attempts table
      discHeader:  parseTableHeader(src['01-format-discarded-directions']),       // header row of the Discarded Directions table
    },
    vocab:  parseVocab(src['enum-column-vocab']),                   // {Result,Conclusion,Status,Validity}
    token:  parseTokens(src['column-kind-definitions']),                  // {none:'None', unfilled:'—'}
    init:   parseInit(src['notation-grammar']),                      // Initial values before first wrap {date, path}
    list:   { proseCols: parseProseCols(src['01-field-format-table']) }, // I-06 no-compression prose columns (D1: no-compression flag of 01-field-format-table)
    fields: parseFields(src['01-field-format-table']),                // I-04·05: {loc,name,kind,pk}[]  (ID column→PK inventory)
    path:   parsePathForms(src['01-format-position-path-attempt'], src['pk-definition-table']), // I-07·12 (deriveRule source=pk-definition-table)
    struct: parseStruct(src['01-format-position-path-attempt']),      // I-01·02·03 (D2: caps too come from the 01 format)
    dest:   parseDest(src['00-file-structure'], src['00-writing-rules']), // I-21: {fixedLine, template[], effectiveLabel}
    session: parseSession(src['session-file-structure']),              // session file line labels {label:{goal,hypothesis,criteria,lessons,discard,achieved,distance,conclusion,reason}}
    hook:   parseDoHook(src['do-record-hook-rules']),                // DO record hook tool names {write[], run[]}
  };
  return C;
}
 
// Fills the {Attempt PK}·{Lesson PK}·{Session PK}·{Date literal} slots of a regex frame with the regexes of pk-definition-table·column-kind-definitions.
// (so that the conventions name only the slot instead of writing the same regex twice)
function fill(s, id, dateLiteral) {
  const body = dateLiteral.replace(/^\^/, '').replace(/\$$/, '');
  return String(s).split('{Attempt PK}').join(id['Attempt']).split('{Lesson PK}').join(id['Lesson']).split('{Session PK}').join(id['Session']).split('{Destination criterion PK}').join(id['DestinationCriterion']).split('{Date literal}').join(body);
}
// `{name}`  line, first `^…$`  code span (the Item line regex of 00-writing-rules)
function parseLineRegex(md, name) {
  const line = md.split('\n').find(l => l.includes(name));
  const v = line ? (line.match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1)).find(x => /^\^.*\$$/.test(x)) : null;
  if (!v) throw new Error('parseLineRegex: ' + name + ' not found');
  return v;
}
// 01 format block → table header row regex (`- Header = `  line, first code span. Each block has 1 such line)
function parseTableHeader(md) {
  const ls = md.split('\n').filter(l => l.startsWith('- Header = '));
  const v = ls.length === 1 ? codespan(ls[0]) : null;
  if (!v || !/^\^\\\|.*\\\|\$$/.test(v)) throw new Error('parseTableHeader: `- Header = `  lines ' + ls.length + ' or regex not found');
  return v;
}
// check-execution → 3 [Notice] alert thresholds (written order = tree line count · path node count · lesson list row count) · C3 list (the `check --c3`  rows)
function parseCheckRun(md) {
  const line = md.split('\n').find(l => l.startsWith('- A `[Notice]` line')) || ''; const nums = []; let m; const re = /`[^`]+` > (\d+)/g;
  while ((m = re.exec(line))) nums.push(Number(m[1]));
  if (nums.length !== 3) throw new Error('parseCheckRun: alert thresholds ' + nums.length + ' (expected 3)');
  let c3 = null;
  for (const c of tableRows(md)) if (codespan(c[0]) === 'check --c3') c3 = c[1].match(/I-[0-9]{2}/g);
  if (!c3) throw new Error('parseCheckRun: check --c3 row items not found');
  return { alert: { treeLines: nums[0], pathNodes: nums[1], lessons: nums[2] }, c3 };
}
// three invariant tables → invariant list (rows whose first cell is I-NN · ascending · stops when a number appears twice)
function parseInvariants(mds) {
  const ids = [];
  for (const md of mds) for (const c of tableRows(md)) if (/^I-[0-9]{2}$/.test(c[0])) ids.push(c[0]);
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('parseInvariants: invariants ' + ids.length + ' rows (0 rows or a repeated number)');
  return ids.sort();
}
// marker-grammar → target line regex · session line label
function parseLock(md) {
  const target = parseLineRegex(md, 'target line regex');
  const line = md.split('\n').find(l => l.includes('exactly two sections')) || '';
  const labels = (line.match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1)).filter(x => x.endsWith(':'));   // written order = session line · target section line
  if (labels.length !== 2) throw new Error('parseLock: section labels ' + labels.length + ' (expected 2)');
  return { target, sessionLabel: labels[0], targetLabel: labels[1] };
}
// k-file-structure → labels of the 3 code block lines (written order = Discovered · Related attempts · Invalidation). Stops when the line count differs
function parseKFile(md) {
  const m = md.match(/```\n([\s\S]*?)```/); const ls = m ? m[1].split('\n').filter(l => l.trim() !== '') : [];
  if (ls.length !== 3 || ls.some(l => l.indexOf(':') <= 0)) throw new Error('parseKFile: code block label lines ' + ls.length + ' (expected 3)');
  const lab = ls.map(l => l.slice(0, l.indexOf(':')));
  return { label: { found: lab[0], related: lab[1], invalid: lab[2] } };
}
// candidate-format → candidate line regex (`Candidate line regex`  line, first code span)
function parseCandidate(md) {
  const line = md.split('\n').find(l => /Candidate line regex/.test(l));
  const v = line ? codespan(line.split('regex')[1]) : null;
  if (!v || !/^\^.*\$$/.test(v)) throw new Error('parseCandidate: Candidate line regex not found');
  return v;
}
// notation-grammar → initial values before first wrap {date: initial value of date slots, path: initial value of the body path}
function parseInit(md) {
  for (const c of tableRows(md)) {
    if (c[0] !== 'Initial values before first wrap') continue;
    const spans = (c[1].match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1));
    const date = spans.find(v => /^[A-Z]{4}-[A-Z]{2}-[A-Z]{2}$/.test(v)); const p = spans.find(v => v.includes('/'));
    if (date && p) return { date, path: p };
  }
  throw new Error('parseInit: Initial values before first wrap not found');
}
// ── Parsers (canonical anchors → constants) ────────────────────────────────────────
// 1) pk-definition-table → ID regex per entity
function parsePkRegex(md) {
  const KEY = {'Attempt':'Attempt','Lesson':'Lesson','Destination criterion':'DestinationCriterion','Session':'Session','Archive month':'ArchiveMonth'};
  const out = {};
  for (const c of tableRows(md)) {
    const ent = c[0].replace(/\*/g, '').trim();
    if (!(ent in KEY)) continue;                            // header row (Entity) excluded automatically
    out[KEY[ent]] = unesc(codespan(c[2]));
  }
  return out;
}
// 2) column-kind-definitions → date literal regex (^…$ exact match)
function parseDateLiteral(md) {
  for (const c of tableRows(md)) {
    if (!/Date literal/.test(c[0])) continue;
    const spans = (c.join(' ').match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1));
    for (const v of spans) if (/^\^.*\$$/.test(v)) return v;
  }
  throw new Error('parseDateLiteral: date literal regex not found');
}
// 3) composite column blocks (why-closest·invalidation) → ID span regex
function parseIdSpan(md) {
  const line = md.split('\n').find(l => /ID span regex/.test(l));
  if (!line) throw new Error('parseIdSpan: ID span regex not found');
  return codespan(line.split('regex:')[1]);
}
// 3c) composite-in-effect → list of value regexes (`^…$`  code spans, all)
function parseEffective(md) {
  const line = md.split('\n').find(l => /Value regex/.test(l));
  const spans = line ? (line.match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1)).filter(v => /^\^.*\$$/.test(v)) : [];
  if (!spans.length) throw new Error('parseEffective: Value regex not found');
  return spans;
}
// 3d) notation-grammar → Discovered test (the {Attempt PK}·{Date literal} of the frame replaced by regexes)
function parseDiscovered(md, id, dateLiteral) {
  const line = md.split('\n').find(l => /Discovered:` test/.test(l));
  const tmpl = line ? codespan(line.split('test:')[1]) : null;
  if (!tmpl || !tmpl.includes('{Attempt PK}') || !tmpl.includes('{Date literal}')) throw new Error('parseDiscovered: Discovered test not found');
  return tmpl.replace('{Attempt PK}', () => id['Attempt']).replace('{Date literal}', () => dateLiteral.replace(/^\^/, '').replace(/\$$/, ''));
}
// 3b) other-files-fk-table → session round header regex (`^## ` — the code span starting with it)
function parseSessionHeader(md) {
  for (const c of tableRows(md)) {
    const spans = (c.join(' ').match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1));
    for (const v of spans) if (v.startsWith('^## ') && v.endsWith('$')) return unesc(v);
  }
  throw new Error('parseSessionHeader: round header regex not found');
}
// 3e) other-files-fk-table → CHECK Success criteria met item line regexes [met, not met] (`^- \[` — the 2 code spans starting with it)
function parseCheckItem(md) {
  for (const c of tableRows(md)) {
    if (!/Success criteria met/.test(c[1] || '')) continue;
    const spans = (c.join(' ').match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1)).filter(v => v.startsWith('^- \\[') && v.endsWith('$'));
    if (spans.length === 2) return spans;
  }
  throw new Error('parseCheckItem: Success criteria met item line regex not found');
}
// 3f) other-files-fk-table → session-pause memo regexes [header, line 1, line 2, line3] (`Session paused`  row: `^…$`  4 code spans · the first is `^#### `)
function parsePauseMemo(md) {
  for (const c of tableRows(md)) {
    if (!/Session paused/.test(c[1] || '')) continue;
    const spans = (c.join(' ').match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1)).filter(v => v.startsWith('^') && v.endsWith('$'));
    if (spans.length === 4 && spans[0].startsWith('^#### ')) return spans;
  }
  throw new Error('parsePauseMemo: session-pause memo regex not found');
}
// 4) enum-column-vocab → fixed vocabulary sets
function parseVocab(md) {
  const out = {};
  for (const l of md.split('\n')) {
    const m = l.match(/^\s*-\s*`([^`]+)`\s*:\s*(.+)$/);
    if (!m) continue;
    out[m[1]] = m[2].split('←')[0].split('/').map(v => v.trim()).filter(Boolean);
  }
  return out;
}
// 5) column-kind-definitions → tokens (None·—)
function parseTokens(md) {
  for (const c of tableRows(md)) {
    if (!/ID column/.test(c[0])) continue;
    const allow = c[1];
    const none = (allow.match(/`(None)`/) || [])[1];
    const unfilled = (allow.match(/`(—)`/) || [])[1];
    if (none && unfilled) return { none, unfilled };
  }
  throw new Error('parseTokens: None/— token not found');
}
// 6) 01-field-format-table → I-06 no-compression prose columns (in the valid example cell, 'no compression' marks the row; its column/field name)
function parseProseCols(md) {
  const out = [];
  for (const c of tableRows(md)) {
    if (c[0] === 'Location') continue;                          // Header
    if (!/no compression/.test(c[4] || '')) continue;
    const name = (codespan(c[1]) || '').replace(/:$/, '');
    if (name) out.push(name);
  }
  return out;
}
// 7) 01-field-format-table → ID column/enum column inventory (for I-04·05) {loc,name,kind,pk}
function parseFields(md) {
  const PK = {'Attempt':'Attempt','Lesson':'Lesson','Month':'ArchiveMonth','Session':'Session','Destination criterion':'DestinationCriterion'};
  const KIND = row => {
    const k = row.replace(/\*/g, '').trim();
    if (/^ID/.test(k)) return 'id';
    if (/^Enum/.test(k)) return 'enum';
    if (/^Composite/.test(k)) return 'composite';
    if (/^Prose/.test(k)) return 'prose';
    return k;
  };
  const out = [];
  for (const c of tableRows(md)) {
    if (c[0] === 'Location') continue;                          // Header
    const name = (codespan(c[1]) || '').replace(/:$/, '');
    if (!name) continue;
    const kind = KIND(c[2]);
    const pkraw = (c[3] || '').replace(/\(.*?\)/g, '').replace(/multiple/g, '').trim();
    const pk = PK[pkraw] || null;
    out.push({ loc: c[0], name, kind, pk });
  }
  return out;
}
// 8) 01 format + pk-definition-table → path forms {firstNode, separator, Body}
function parsePathForms(md01, mdPk) {
  const seg = h => { const i = md01.indexOf('**Format ' + h); const j = md01.indexOf('**Format ', i + 3); return md01.slice(i, j < 0 ? undefined : j); };
  const f2 = seg('2');
  const firstNode = (f2.match(/nodes\[0\]\s*=\s*(#0)/) || [])[1];
  const separator = (() => { const m = f2.match(/separator `([^`]*)`/); return m ? m[1] : null; })();
  // Body (session) path derivation: body location of the Session row of pk-definition-table = sessions/YYYY-MM-DD.md → {prefix, suffix}
  let Body = null, Lesson = null, Archive = null;
  const cut = (c, re) => { const m = (codespan(c[5]) || '').match(re); return m ? { prefix: m[1], suffix: m[2] } : null; };
  for (const c of tableRows(mdPk)) {
    const ent = c[0].replace(/\*/g, '').trim();
    if (ent === 'Session') Body = cut(c, /^(.*\/)YYYY-MM-DD(\.[a-z]+)$/);        // `sessions/YYYY-MM-DD.md`
    if (ent === 'Lesson') Lesson = cut(c, /^(.*\/)K###(\.[a-z]+)$/);              // `knowledge/K###.md` → the lesson PK without # goes in the middle
    if (ent === 'Archive month') Archive = cut(c, /^(.*\/.*)YYYY-MM(\.[a-z]+)$/); // `archive/tree_YYYY-MM.md`
  }
  if (!firstNode || !separator || !Body || !Lesson || !Archive) throw new Error('parsePathForms: failed to extract path forms');
  return { firstNode, separator, Body, Lesson, Archive };
}
// 9) 01 format → structure constants {I-01,I-02,I-03}
function parseStruct(md) {
  const seg = h => { const i = md.indexOf('**Format ' + h); const j = md.indexOf('**Format ', i + 3); return md.slice(i, j < 0 ? undefined : j); };
  const counts = t => ({ section: Number((t.match(/exactly (\d+) section/) || [])[1]), line: Number((t.match(/exactly (\d+) line/) || [])[1]) });
  const f5 = seg('5'); const caps = {};
  let m; const re = /`([^`]+)`\s*≤\s*(\d+)/g;
  while ((m = re.exec(f5))) caps[m[1]] = Number(m[2]);
  return { 'I-01': counts(seg('1')), 'I-02': counts(seg('4')), 'I-03': caps };
}
 
// 10) 00-file-structure + 00-writing-rules → destination file structure {fixedLine: fixed line regex, template: structure template line list (trailing spaces and leading/trailing blank lines removed)}
function parseDest(tmpl, rules) {
  const line = rules.split('\n').find(l => /Fixed line regex:/.test(l));
  const fixedLine = line ? codespan(line.split('regex:')[1]) : null;
  if (!fixedLine) throw new Error('parseDest: Fixed line regex not found');
  const template = tmpl.split('\n').map(l => l.replace(/[ \t]+$/, ''));
  while (template.length && template[0] === '') template.shift();
  while (template.length && template[template.length - 1] === '') template.pop();
  if (!template.some(l => new RegExp(fixedLine).test(l))) throw new Error('parseDest: no fixed line in the structure template');
  // label of the In effect line = in the structure template, the first item line(`- [` start), on the line directly below, up to the first `:`
  const i = template.findIndex(l => l.startsWith('- ['));
  const below = i >= 0 ? (template[i + 1] || '').trim() : '';
  const k = below.indexOf(':');
  if (k <= 0) throw new Error('parseDest: no label line below the first item line');
  const kinds = template.filter(l => l.startsWith('### ')).map(l => l.slice(4).split(' ')[0]);   // criterion kinds = in the Success Criteria section, the `### `  lines, first word (Quantitative · Qualitative)
  if (kinds.length !== 2) throw new Error('parseDest: `### `  lines ' + kinds.length + ' (expected 2)');
  return { fixedLine, template, effectiveLabel: below.slice(0, k + 1), kinds };
}
// 11) session-file-structure → line labels of the round skeleton. Label line = `{label}:` or `{label}: —` as one line (bullet, quote and title lines excluded).
//     Picked by section and order: round header~PLAN 1 / PLAN section 4 / first 2 of the CHECK section / first 2 of the ACT section. Stops when a count differs.
function parseSession(md) {
  const L = md.split('\n');
  const at = s => L.findIndex(l => l === s);
  const h = L.findIndex(l => l.startsWith('## ')), p = at('### PLAN'), d = at('### DO'), c = at('### CHECK'), a = at('### ACT');
  if (!(h >= 0 && h < p && p < d && d < c && c < a)) throw new Error('parseSession: section order of the round skeleton (header·PLAN·DO·CHECK·ACT) does not fit');
  const labels = (from, to) => L.slice(from + 1, to).map(l => l.match(/^([^\s#>|<\-0-9][^:]*:)( —)?$/)).filter(Boolean).map(m => m[1]);
  const need = (name, arr, n) => { if (arr.length !== n) throw new Error('parseSession: ' + name + ' label lines ' + arr.length + ' (expected ' + n + ')'); return arr; };
  const pre = need('Header~PLAN', labels(h, p), 1), plan = need('PLAN', labels(p, d), 4), chk = need('CHECK', labels(c, a), 4), act = need('ACT', labels(a, L.length), 4);
  return { label: { goal: pre[0], hypothesis: plan[0], criteria: plan[1], lessons: plan[2], discard: plan[3], achieved: chk[0], distance: chk[1], conclusion: act[0], reason: act[1] } };
}
// 12) do-record-hook-rules → tool name lists (`- File-writing tools = ` · `- Command-running tools = `  line, all code spans)
function parseDoHook(md) {
  const pick = head => { const line = md.split('\n').find(l => l.startsWith('- ' + head + ' = ')); const v = line ? (line.match(/`([^`]*)`/g) || []).map(s => s.slice(1, -1)) : []; if (!v.length) throw new Error('parseDoHook: ' + head + ' list not found'); return v; };
  return { write: pick('File-writing tools'), run: pick('Command-running tools') };
}
 
// Byte-stable serialization (sorted keys · 2-space · trailing newline). Guarantees identical bytes across regenerations.
function serialize(C) { return JSON.stringify(sortKeys(C), null, 2) + '\n'; }
function sortKeys(x) {
  if (Array.isArray(x)) return x.map(sortKeys);
  if (x && typeof x === 'object')
    return Object.keys(x).sort().reduce((o,k)=>((o[k]=sortKeys(x[k])),o),{});
  return x;
}
 
// ── module + CLI ─────────────────────────────────────────────────────
module.exports = { build, serialize };
if (require.main === module) {
  const mode = process.argv[2];
  const out = serialize(build());
  if (mode === '--emit')  { process.stdout.write(out); }
  else if (mode === '--write') { fs.writeFileSync(OUT, out); }
  else if (mode === '--check') {
    const norm = s => s.replace(/\r\n/g, '\n'); // CRLF is normalized before comparing (any other difference is stale)
    const committed = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    process.exit(norm(out) === norm(committed) ? 0 : 1);
  } else { process.stderr.write('usage: --emit | --write | --check\n'); process.exit(2); }
}
