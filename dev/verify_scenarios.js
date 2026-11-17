// Scenario verification: arg 1 = source folder, arg 2 = temporary work folder (made anew)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const [SRC, T] = process.argv.slice(2);
fs.rmSync(T, { recursive: true, force: true });
fs.mkdirSync(T, { recursive: true });
for (const f of ['.claude', '01_exploration_tree.md', '02_knowledge_base.md', 'NOTATION_CONVENTIONS']) fs.cpSync(path.join(SRC, f), path.join(T, f), { recursive: true });
for (const d of ['locks', 'knowledge', 'sessions', 'archive']) fs.mkdirSync(path.join(T, d), { recursive: true });
const P = f => path.join(T, f);
const rd = f => fs.readFileSync(P(f), 'utf8');
const wr = (f, s) => fs.writeFileSync(P(f), s);
const ed = (f, a, b) => { const s = rd(f); if (!s.includes(a)) throw new Error('nothing to edit: ' + a); wr(f, s.replace(a, () => b)); };
const env = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: T });
const nav = (...a) => { try { return cp.execFileSync('node', [P('.claude/hooks/nav.js'), ...a], { cwd: T, env }).toString().trimEnd(); } catch (e) { return (e.stdout || '').toString().trimEnd() + ' [exit ' + e.status + ']'; } };
const hook = () => { wr('locks/integrity-check.pending', ''); const o = cp.execFileSync('node', [P('.claude/hooks/integrity-check.js')], { cwd: T, env }).toString(); return o + ' (MarkerLeft=' + fs.existsSync(P('locks/integrity-check.pending')) + ')'; };
const d = new Date(); const z = n => String(n).padStart(2, '0'); const TODAY = d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
const S = 'sessions/' + TODAY + '.md';
let pass = 0, fail = 0;
const expect = (name, out, ...needles) => { const ok = needles.every(n => n.startsWith('!') ? !out.includes(n.slice(1)) : out.includes(n)); ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '\n----\n' + out + '\n----')); };
const show = (t, o) => console.log('\n## ' + t + '\n' + o);

// 0. no setup — starts as the template was copied (the first wrap writes the date placeholder)
expect('0a recover no marker', nav('recover'), 'Marker: None');
expect('0b route first cycle', nav('route'), 'LatestSessionPath: None', 'TodayFileExists: No', 'OpenRoundCount: 0', 'NextRound: 1', 'ResumableAttempts: None', 'NextAttemptNumber: #1');
expect('0c c3 pass', nav('check', '--c3'), 'IsolationSet: None', 'I-08  skipped');
expect('0d status', nav('status'), '[Current position] Attempt #0 — Before the start', '[Status] To Do (Attempt #0)', '[Do-not-retry directions] 0');
expect('0e template as it is: undetermined 0 · the placeholder row is not data', nav('check'), 'undetermined 0', 'I-03  ✅  return 0 / attempt summaries 0 / candidates 0', 'I-20  ✅', '!Return Log');
// 0-1. /pdca-init initial writing (imitates the writes the command does)
const D0 = '00_destination.md';
expect('0f0 the distribution has no 00_destination.md', String(fs.existsSync(path.join(SRC, D0))) + '/' + String(fs.existsSync(P(D0))), 'false/false');
expect('0f no file = Unwritten · I-21 ❌', nav('dest'), 'DestinationFile: None', 'DestinationStatus: Unwritten', 'Final Goal: None', 'NextCriterionNumber: D1', 'I-21  ❌  00_destination.md not found', 'I-22  skipped', '!Criterion: ');
expect('0f1 with no file the only violation of the full check is I-21 (I-04 does not look at existence)', nav('check'), 'IsolationSet: I-21', 'I-04  ✅');
expect('0f1b even with no file, brief and the commands before snapshot give no error', nav('brief'), '[Destination criterion] 0', '![nav.js error]');
expect('0f1c dest --create makes the file from the structure template', nav('dest', '--create'), 'Destination file created: 00_destination.md (structure template ');
expect('0f1d not made when it already exists', nav('dest', '--create'), '[nav.js error] 00_destination.md already exists', '[exit 1]');
expect('0f2 the file made = the structure template of the conventions (character for character)', rd(D0).replace(/\r\n/g, '\n').trim(), nav('anchor', '00-file-structure').trim());
expect('0f2b right after making = Unwritten · placeholder line left', nav('dest'), 'DestinationFile: Present', 'DestinationStatus: Unwritten', 'I-21  ❌', 'placeholder line left');
expect('0f3 check also gives I-21 ❌ (the start gate blocks first with dest)', nav('check'), 'I-21  ❌', 'I-22  skipped');
ed(D0, '{Final goal in one sentence}', 'Isaac Sim is used to build the factory map as a digital twin');
expect('0g only partly filled = FormatViolation', nav('dest'), 'DestinationStatus: FormatViolation', 'I-21  ❌', 'placeholder line left');
ed(D0, '- [ ] **D1** — {quantitative criterion}\n      In effect: Valid', '- [ ] **D1** — path finding success rate 95% or higher\n      In effect: Valid\n- [ ] **D2** — map error 5cm or less\n      In effect: Valid');
ed(D0, '- [ ] **D2** — {qualitative criterion}\n      In effect: Valid', '- [ ] **D3** — textures are indistinguishable from the real thing\n      In effect: Valid\n- [ ] **D4** — an operator handles it without explanation\n      In effect: Valid');
ed(D0, '- {constraint}', '- RTX 3080 1 unit');
ed(D0, '- {out-of-scope item}', '- perfect physics simulation');
expect('0g2 FormatViolation when there is no change history row', nav('dest'), 'DestinationStatus: FormatViolation', 'data rows 0');
ed(D0, '| — | — | — |', '| ' + TODAY + ' | Initial version | None |');
expect('0h after initial writing = Written', nav('dest'), 'Today: ' + TODAY, 'DestinationStatus: Written', 'Final Goal: Isaac Sim is used to build the factory map as a digital twin',
  'Criterion: D1 | [ ] | Quantitative | Valid | Unrecorded | path finding success rate 95% or higher', 'Criterion: D4 | [ ] | Qualitative | Valid | Unrecorded | an operator handles it without explanation', 'NextCriterionNumber: D5', 'I-21  ✅', 'D# 4 / change history 1 rows', 'I-22  skipped');
show('dest (after initial writing)', nav('dest'));
expect('0i after initial writing · before first wrap: the full check passes (tree initial values allowed)', nav('check'), 'IsolationSet: None', 'violation 0', 'I-12  skipped  before first wrap', 'I-21  ✅', 'I-23  ✅  open rounds 0');
{ const k = rd('01_exploration_tree.md'); ed('01_exploration_tree.md', 'Started: YYYY-MM-DD', 'Started: ' + TODAY);
  expect('0i2 only one of the three initial values changed before first wrap → I-04 ❌', nav('check'), 'I-04  ❌', '★ Started = "' + TODAY + '" (expected: Initial values before first wrap YYYY-MM-DD)'); wr('01_exploration_tree.md', k); }
expect('0i3 brief: no open cycle', nav('brief'), '[Open cycle] None', '[Resume point] None');
show('brief (initial)', nav('brief'));

// 1. start: session file + Round 1
const block = nav('anchor', 'session-file-structure');
const i = block.indexOf('\n## Round 1') + 1;   // '## Round 1' — lines starting with it (mentions inside the comment excluded)
const prefix = block.slice(0, i).replace('YYYY-MM-DD', TODAY);
const skel = n => block.slice(i).replace('## Round 1 · Attempt #N', n);
wr(S, prefix + skel('## Round 1 · Attempt #1') + '\n');
ed(S, 'Cycle goal: —', 'Cycle goal: USD direct import');
ed(S, 'Success criteria (this cycle):\n- [ ] —', 'Success criteria (this cycle):\n- [ ] mesh opens\n- [ ] coordinate system matches');   // CHECK must equal the number of item lines(I-04 ⑥)
ed(S, 'Lessons consulted: —', 'Lessons consulted: None');
ed(S, 'Discard check: —', 'Discard check: None');
expect('1a route open 1', nav('route'), 'TodayFileExists: Yes', 'OpenRoundCount: 1', 'OpenRound: Round 1 · Attempt #1', 'NextRound: 2', 'NextAttemptNumber: #2');
expect('1b open round · DO 0 → To Do', nav('status'), '[Current position] Attempt #0', '[Status] To Do (Attempt #1 · open Round 1)');
expect('1c state open rounds', nav('state', '#1'), 'Attempt: #1', 'Result: None', 'Conclusion: None', 'Status: To Do');
ed(S, '### DO\n', '### DO\n\n#### ' + TODAY + ' 10:00 — ran the import\nImported the USD file as it is.\n');
expect('1d open round · DO 1 → In Progress', nav('status'), '[Status] In Progress (Attempt #1 · open Round 1)');
expect('1e state argument format', nav('state', '1'), '[nav.js error]', '[exit 1]');

// 1-1. /pdca-wrap "end only the session"(pause) → the /pdca-start of the next session continues the same round
{
  expect('1f brief: open cycle block (before the pause memo)', nav('brief'), '[Open cycle] Round 1 · Attempt #1 · ' + S, '  Goal: USD direct import', '  Success Criteria:', '  DO: 1', '— ran the import', '[Resume point] None');
  expect('1f2 route Now = HH:MM', /^Now: [0-9]{2}:[0-9]{2}$/m.test(nav('route')) ? 'formats match' : 'format mismatch', 'formats match');
  ed(S, '\n### CHECK', '#### ' + TODAY + ' 11:30 — Session paused\nDid: up to the USD import\nRemaining: check the coordinate system\nNext first action: check the Z axis direction in the viewport\n\n### CHECK');   // ### DO section end
  expect('1g after the pause: the round stays open · no new round or new attempt number', nav('route'), 'OpenRoundCount: 1', 'OpenRound: Round 1 · Attempt #1 · ' + S, 'NextRound: 2', 'NextAttemptNumber: #2');
  expect('1h the full check passes after the pause (even before first wrap)', nav('check'), 'IsolationSet: None', 'violation 0', 'I-23  ✅  open rounds 1');
  expect('1i brief of the next session: the resume point is the three values of the memo', nav('brief'), '[Open cycle] Round 1 · Attempt #1 · ' + S, '  DO: 2', '— Session paused', '[Resume point] Did: up to the USD import | Remaining: check the coordinate system | Next first action: check the Z axis direction in the viewport');
  expect('1j a pause does not change the status', nav('status'), '[Status] In Progress (Attempt #1 · open Round 1)');
  expect('1j2 a pause does not produce a result or conclusion', nav('state', '#1'), 'Result: None', 'Conclusion: None', 'Status: In Progress');
  expect('1j3 a pause does not change the tree', rd('01_exploration_tree.md'), 'Attempt #: #0', 'last_updated: YYYY-MM-DD');
  const badMemo = (name, a, b) => { const k = rd(S); ed(S, a, b); expect(name, nav('check'), 'I-04  ❌', 'Round 1 session-pause memo'); wr(S, k); };
  badMemo('1k memo label differs → I-04 ❌', 'Remaining: check the coordinate system', 'Left over: check the coordinate system');
  badMemo('1k2 memo line missing → I-04 ❌', 'Next first action: check the Z axis direction in the viewport\n', '');
  badMemo('1k3 memo value blank → I-04 ❌', 'Did: up to the USD import', 'Did:');
  badMemo('1k4 memo time format → I-04 ❌', ' 11:30 — Session paused', ' AM — Session paused');
  badMemo('1k5 blank line between the header and the three lines → I-04 ❌', '— Session paused\nDid', '— Session paused\n\nDid');
  badMemo('1k6 line order swapped → I-04 ❌', 'Did: up to the USD import\nRemaining: check the coordinate system', 'Remaining: check the coordinate system\nDid: up to the USD import');
  { const k = rd(S); ed(S, 'Remaining: check the coordinate system', 'Left over: check the coordinate system'); expect('1k7 a memo with a broken format is not read as the resume point', nav('brief'), '[Resume point] None'); wr(S, k); }
  { const k = rd(S); ed(S, '\n### CHECK', '#### ' + TODAY + ' 13:00 — Z-axis check\nIt was flipped.\n\n### CHECK');
    expect('1l when more DO is written afterwards the last DO is not a memo → no resume point', nav('brief'), '  DO: 3', '[Resume point] None');
    expect('1l2 check passes even when the past memo stays in the middle', nav('check'), 'IsolationSet: None'); wr(S, k); }
  { const k = rd(S); fs.appendFileSync(P(S), '\n---\n\n' + skel('## Round 2 · Attempt #2') + '\n');
    expect('1m open rounds 2 → I-23 ❌', nav('check'), 'I-23  ❌  open rounds 2', 'IsolationSet: I-23');
    expect('1m1 brief arguments: shows the block of the picked open round (a round that is not the first line)', nav('brief', S, '1'), '[Open cycle] Round 1 · Attempt #1 · ' + S, '  DO: 2', '[Resume point] Did: up to the USD import');
    expect('1m1b brief no arguments: the round of the first route line', nav('brief'), '[Open cycle] Round 2 · Attempt #2 · ' + S);
    expect('1m1c brief the arguments point to no open round → error', nav('brief', S, '9'), '[nav.js error] brief argument', '[exit 1]');
    expect('1m2 route shows both (the higher round on top)', nav('route'), 'OpenRoundCount: 2', 'OpenRound: Round 2 · Attempt #2 · ' + S + '\nOpenRound: Round 1 · Attempt #1 · ' + S); wr(S, k); }
  { const OLD = 'sessions/2020-01-01.md'; wr(OLD, prefix.replace(TODAY, '2020-01-01') + skel('## Round 1 · Attempt #5') + '\n');
    expect('1n an open round of an old session file is counted too', nav('route'), 'OpenRoundCount: 2', 'OpenRound: Round 1 · Attempt #5 · sessions/2020-01-01.md');
    expect('1n2 that state is I-23 ❌', nav('check'), 'I-23  ❌  open rounds 2'); fs.unlinkSync(P(OLD)); }
  // leaving the memo in the file, goes on to 2 below (the wrap that ends the cycle) = pause → resume → cycle end
}

// 2. wrap (normal): 1 lesson, 2 candidates
expect('2a snapshot', nav('snapshot'), 'Snapshot recorded', 'History recorded: 0001 (history/' + TODAY.slice(0, 7) + '.log · changed files 3)');
expect('2a1 snapshot again in the same state → the history does not grow', nav('snapshot'), 'History: no change (latest 0001)');
expect('2a1b full text revived from the history = current file', nav('diff', '1'), '00_destination.md: no change', '01_exploration_tree.md: no change', '02_knowledge_base.md: no change');
ed(S, 'Success criteria met:\n- [ ] —', 'Success criteria met:\n- [x] mesh opens: O — confirmed in the viewport\n- [ ] coordinate system matches: X — the Z axis is flipped');
ed(S, 'Distance to destination: —', 'Distance to destination: Closer — even the textures attached');
ed(S, 'Conclusion: —', 'Conclusion: Continue');
expect('2a2 state closed round', nav('state', '#1'), 'Result: Partial', 'Conclusion: Continue', 'Status: In Progress');
expect('2a3 last: the content of the last round of the attempt, character for character', nav('last', '#1'), '[Last round] Round 1 · Attempt #1 · ' + S, '  Goal: USD direct import', '  Hypothesis:', '  Success Criteria:', '  DO: 2', '— ran the import', '— Session paused',
  '  Success criteria met:\n    - [x] mesh opens: O — confirmed in the viewport\n    - [ ] coordinate system matches: X — the Z axis is flipped', '  Distance to destination: Closer — even the textures attached', '  Conclusion: Continue', '  Reason:');
expect('2a4 last: an attempt with no closed round', nav('last', '#9'), '[Last round] None');
expect('2a5 last: argument format', nav('last', '1'), '[nav.js error]', '[exit 1]');
{ const k = rd(S); fs.appendFileSync(P(S), '\n---\n\n' + skel('## Round 2 · Attempt #1 continued') + '\n');
  expect('2a6 last: skips the open round of that attempt and looks at the closed round', nav('last', '#1'), '[Last round] Round 1 · Attempt #1 · ' + S); wr(S, k); }
expect('2a7 start runs last when an existing attempt is picked', fs.readFileSync(path.join(SRC, '.claude/skills/pdca-start/SKILL.md'), 'utf8'), '`node .claude/hooks/nav.js last {P}` and show the output as it is');
wr('knowledge/K001.md', '# K001 — test\n\n```\nDiscovered: #1 (' + TODAY + ')\nRelated attempts: #1\nInvalidation:    None\n```\n\n## Content\n\nContent\n');
ed('02_knowledge_base.md', '| — | — | — | — |', '| #K001 | Valid | summary | situation |');
ed('01_exploration_tree.md', '| — | — | — | — | — | — | — |', '| #1 | #0 | USD direct import | Partial | Continue | #K001 | ' + S + ' |');
ed('01_exploration_tree.md', 'Attempt #: #0\nPath: #0\nDirection: Before the start — destination set, exploring the first direction\nStatus: To Do\nStarted: YYYY-MM-DD\nBody: sessions/YYYY-MM-DD.md', 'Attempt #: #1\nPath: #0 → #1\nDirection: USD direct import\nStatus: In Progress\nStarted: ' + TODAY + '\nBody: ' + S);
ed('01_exploration_tree.md', 'last_updated: YYYY-MM-DD', 'last_updated: ' + TODAY);
ed('01_exploration_tree.md', '## Next Direction Candidates\n', '## Next Direction Candidates\n\n- **A.** coordinate system correction — Branch point: #1 — Basis: textures attach\n- **B.** Blender route — Branch point: #1 — Basis: conversion loss needs checking\n');
expect('2b hook passes', hook(), '[Integrity] ✅ 0 violations', 'MarkerLeft=false');
const c2 = nav('check'); show('check (after a normal wrap)', c2);
expect('2c check pass', c2, 'IsolationSet: None', 'I-08  ✅', 'I-10  ✅', 'I-11  ✅', 'I-12  ✅', 'I-19  ✅', 'I-20  ✅', 'violation 0', 'undetermined 0', 'I-03  ✅  return 0 / attempt summaries 1 / candidates 2');
expect('2c2 status after closing', nav('status'), '[Status] In Progress (Attempt #1)');
expect('2d route close', nav('route'), 'OpenRoundCount: 0', 'NextRound: 2', 'ResumableAttempts: #1 (In Progress)\n');

// 3. violation injected
const keep = rd('01_exploration_tree.md'), keep2 = rd('02_knowledge_base.md');
ed('01_exploration_tree.md', '| Partial | Continue |', '| Partial | Change direction |');
expect('3a I-05 Change direction', nav('check'), 'I-05  ❌', 'Change direction');
expect('3b hook violation', hook(), '[Integrity] ❌ I-05');
wr('01_exploration_tree.md', keep);
ed('02_knowledge_base.md', '| #K001 | Valid | summary | situation |', '| — | — | — | — |');
expect('3c I-10 index row missing', nav('check'), 'I-10  ❌', '#K001 index row missing');
wr('02_knowledge_base.md', keep2);
ed('01_exploration_tree.md', '| #1 | #0 | USD', '| #1 | #3 | USD');
expect('3d I-09·I-08', nav('check', '--c3'), 'I-09  ❌', 'I-08  ❌', 'IsolationSet: I-08, I-09');
wr('01_exploration_tree.md', keep);
ed('01_exploration_tree.md', '| #1 | #0 | USD', '| 1 | #0 | USD');
expect('3e I-04 # a number that does not exist', nav('check'), 'I-04  ❌', 'Attempt summary row 1 # = "1"');
wr('01_exploration_tree.md', keep);
ed('01_exploration_tree.md', 'Started: ' + TODAY, 'Started: yesterday');
expect('3f I-04 Date', nav('check'), 'I-04  ❌', '★ Started = "yesterday"');
wr('01_exploration_tree.md', keep);
ed('knowledge/K001.md', 'Related attempts: #1', 'Related attempts: #9');
expect('3g I-11 two-way', nav('check'), 'I-11  ❌');
ed('knowledge/K001.md', 'Related attempts: #9', 'Related attempts: #1');
ed('knowledge/K001.md', 'Invalidation:    None', 'Invalidation:    ' + TODAY + ' — premise collapsed');
expect('3h I-19', nav('check'), 'I-19  ❌');
ed('knowledge/K001.md', 'Invalidation:    ' + TODAY + ' — premise collapsed', 'Invalidation:    None');
ed('01_exploration_tree.md', 'Path: #0 → #1', 'Path: #0->#1');
expect('3i c3 path broken', nav('check', '--c3'), 'I-07  ❌');
wr('01_exploration_tree.md', keep);
// 3-2. I-04 extension: 00 · 02 · K · sessions
const inj = (name, f, a, b, ...needles) => { const k = rd(f); ed(f, a, b); expect(name, nav('check'), 'I-04  ❌', ...needles); wr(f, k); };
expect('3j I-04 baseline passes', nav('check'), 'I-04  ✅  formats match — 01 / 00 D# 4 / 02 1 rows / lesson files 1 / session files 1 / archive files 0');
inj('3k 00 In effect', '00_destination.md', 'In effect: Valid', 'In effect: maybe Valid', 'D1 In effect = "maybe Valid"');
inj('3l 00 In effect Discarded format', '00_destination.md', 'In effect: Valid', 'In effect: Discarded', 'D1 In effect = "Discarded"');
inj('3m 00 no In effect line', '00_destination.md', '      In effect: Valid\n', '', 'D1 In effect = "(not on the line directly below)"');
inj('3n 00 D# number missing', '00_destination.md', '**D2** —', '**D5** —', 'Success Criteria number set = "D1, D3, D4, D5"');
inj('3n2 00 D# number duplicated', '00_destination.md', '**D2** —', '**D1** —', 'Success Criteria number set = "D1, D1, D3, D4"');
inj('3n3 00 D# order inside a section', '00_destination.md', '- [ ] **D1** — path finding success rate 95% or higher\n      In effect: Valid\n- [ ] **D2** — map error 5cm or less', '- [ ] **D2** — map error 5cm or less\n      In effect: Valid\n- [ ] **D1** — path finding success rate 95% or higher', 'Success Criteria number order = "D2, D1, D3, D4"');
inj('3o 00 change history date', '00_destination.md', '| ' + TODAY + ' | Initial version | None |', '| yesterday | criterion added | requirement change |', 'change history row 1 Date = "yesterday"');
inj('3p 02 index #', '02_knowledge_base.md', '| #K001 |', '| K001 |', 'Lesson List row 1 # = "K001"');
inj('3q K Discovered', 'knowledge/K001.md', 'Discovered: #1 (' + TODAY + ')', 'Discovered: #1 (driver issue)', 'knowledge/K001.md Discovered');
inj('3r K Related attempts', 'knowledge/K001.md', 'Related attempts: #1', 'Related attempts: #1 (first attempt)', 'knowledge/K001.md Related attempts');
inj('3s K Invalidation unfilled', 'knowledge/K001.md', 'Invalidation:    None', 'Invalidation:    —', 'knowledge/K001.md Invalidation = "—"');
inj('3t K revision history date', 'knowledge/K001.md', 'Content\n', 'Content\n\n## Revision History\n\n| Date | What was fixed | Why |\n|---|---|---|\n| last week | value | typo |\n', 'Revision History row 1 Date = "last week"');
inj('3u session Lessons consulted', S, 'Lessons consulted: None', 'Lessons consulted: #K1', 'Round 1 Lessons consulted = "#K1"');
inj('3v session Lessons consulted closed round —', S, 'Lessons consulted: None', 'Lessons consulted: —', 'Round 1 Lessons consulted = "—"');
inj('3w session round header', S, '## Round 1 · Attempt #1', '## Round 1 - Attempt #1', 'round header = "## Round 1 - Attempt #1"');

// 3-3. computed values: result · status test tables and I-20
const st = (name, a, b, ...needles) => { const k = rd(S); ed(S, a, b); expect(name, nav('state', '#1'), ...needles); wr(S, k); };
const ck = (name, f, a, b, ...needles) => { const k = rd(f); ed(f, a, b); expect(name, nav('check'), ...needles); wr(f, k); };
st('3x1 distance Same → Blocked', 'Closer — even the textures attached', 'Same — no change', 'Status: Blocked');
st('3x2 distance Farther → Blocked', 'Closer — even the textures attached', 'Farther — went back', 'Status: Blocked');
st('3x3 conclusion Pivot → On Hold', 'Conclusion: Continue', 'Conclusion: Pivot', 'Conclusion: Pivot', 'Status: On Hold');
st('3x4 conclusion Discarded → Canceled', 'Conclusion: Continue', 'Conclusion: Discarded', 'Status: Canceled');
st('3x5 all [x] → Success · Done', '- [ ] coordinate system matches: X — the Z axis is flipped', '- [x] coordinate system matches: O — it matches', 'Result: Success', 'Status: Done');
st('3x6 all [ ] → Failure', '- [x] mesh opens: O — confirmed in the viewport', '- [ ] mesh opens: X — does not open', 'Result: Failure', 'Status: In Progress');
st('3x7 item format broken → Undetermined', '- [x] mesh opens: O — confirmed in the viewport', '- [x] mesh opens', 'Result: Undetermined', 'Status: Undetermined');
st('3x8 [x] but marked X → Undetermined', '- [x] mesh opens: O — confirmed in the viewport', '- [x] mesh opens: X — does not open', 'Result: Undetermined');
st('3x9 distance outside the vocabulary → Undetermined', 'Closer — even the textures attached', 'almost there', 'Result: Partial', 'Status: Undetermined');
ck('3y1 I-04 item format', S, '- [x] mesh opens: O — confirmed in the viewport', '- [x] mesh opens', 'I-04  ❌', 'Round 1 Success criteria met = "- [x] mesh opens"');
ck('3y2 I-04 distance format', S, 'Closer — even the textures attached', 'almost there', 'I-04  ❌', 'Round 1 Distance to destination = "almost there"', 'I-20  ⚠');
ck('3y3 I-20 ★ status mismatch', '01_exploration_tree.md', 'Status: In Progress', 'Status: Done', 'I-20  ❌', '★ Status = "Done" (computed: In Progress)');
ck('3y4 I-20 when the session changes the written status goes stale', S, 'Closer — even the textures attached', 'Same — no change', 'I-20  ❌', '(computed: Blocked)');
ck('3y5 I-20 row result mismatch', '01_exploration_tree.md', '| Partial | Continue |', '| Success | Continue |', 'I-20  ❌', 'Result = "Success" (computed: Partial)');
ck('3y6 I-20 row conclusion mismatch', '01_exploration_tree.md', '| Partial | Continue |', '| Partial | Discarded |', 'I-20  ❌', 'Conclusion = "Discarded"');
ck('3y7 I-05 old status vocabulary', '01_exploration_tree.md', 'Status: In Progress', 'Status: Ongoing', 'I-05  ❌', '★ Status = "Ongoing"');
ck('3y8 I-05 session conclusion outside the vocabulary', S, 'Conclusion: Continue', 'Conclusion: Change direction', 'I-05  ❌', 'Round 1 Conclusion = "Change direction"');
ck('3y9 I-05 no session conclusion line', S, 'Conclusion: Continue\n', '', 'I-05  ❌', 'Round 1 Conclusion = "(lines 0)"');

// 4. Round 2: discard + return (#0) + K001 invalidation, interrupted with the marker left
fs.appendFileSync(P(S), '\n---\n\n' + skel('## Round 2 · Attempt #2') + '\n');
expect('4a route Round 2 open', nav('route'), 'OpenRoundCount: 1', 'OpenRound: Round 2 · Attempt #2', 'NextAttemptNumber: #3');
expect('4a2 status looks at the attempt of the open round', nav('status'), '[Current position] Attempt #1', '[Status] To Do (Attempt #2 · open Round 2)');
expect('4a3 wrap next snapshot after it → history number 2', nav('snapshot'), 'History recorded: 0002 (history/' + TODAY.slice(0, 7) + '.log · changed files 2)');
expect('4a4 history list', nav('history'), '0001 | ' + TODAY + ' | 00_destination.md, 01_exploration_tree.md, 02_knowledge_base.md\n0002 | ' + TODAY + ' | 01_exploration_tree.md, 02_knowledge_base.md');
const df = nav('diff', '1', '2'); show('diff 1 2', df);
expect('4a5 diff: shows the placeholder row replaced by a real row', df, '[Compare] History 0001 (' + TODAY + ') → History 0002 (' + TODAY + ')', '- | — | — | — | — | — | — | — |', '+ | #1 | #0 | USD direct import | Partial | Continue | #K001 |', '- Status: To Do', '+ Status: In Progress', '+ | #K001 | Valid | summary | situation |', '00_destination.md: no change');
expect('4a6 diff second omitted = compared with the current files', nav('diff', '2'), '→ current files', '01_exploration_tree.md: no change');
expect('4a8 the history is 1 file per month', '[' + fs.readdirSync(P('history')).join(',') + ']', '[' + TODAY.slice(0, 7) + '.log]');
expect('4a7 diff a number that does not exist', nav('diff', '9'), '[nav.js error] History 9 not found', '[exit 1]');
wr('locks/invalidation.lock', 'Session: ' + TODAY + '\nInvalidation target:\n  #K001 — the coordinate system premise collapsed\n');
ed('02_knowledge_base.md', '| #K001 | Valid |', '| #K001 | Invalid |');
const rec = nav('recover'); show('recover (interrupted state)', rec);
expect('4b recover Incomplete', rec, 'IndexInvalid=true BodyInvalidation=false TreeInvalidated=false', 'Incomplete: #K001');
expect('4c I-19 middle state', nav('check'), 'I-19  ❌');
ed('knowledge/K001.md', 'Invalidation:    None', 'Invalidation:    ' + TODAY + ' — the coordinate system premise collapsed');
ed('01_exploration_tree.md', '| — | — | — | — | — |', '| #2 | #0 | must look again from the root | #K001 | ' + S + ' |');
expect('4d recover complete', nav('recover'), 'Incomplete: None');
fs.unlinkSync(P('locks/invalidation.lock'));
// tree: #2 row, discarded row, ★ return
ed('01_exploration_tree.md', '| #K001 | ' + S + ' |\n\n> `Branch point`', '| #K001 | ' + S + ' |\n| #2 | #1 | coordinate system correction | Failure | Discarded | None | ' + S + ' |\n\n> `Branch point`');
ed('01_exploration_tree.md', '| — | — | — | — | — | — |', '| #2 | #1 | coordinate system correction | axis flip cannot be solved | ' + TODAY + ' | importer 2.0 released |\n| — | #0 | manual retopology | too much effort | ' + TODAY + ' | staff added |');
ed('01_exploration_tree.md', 'Attempt #: #1\nPath: #0 → #1\nDirection: USD direct import\nStatus: In Progress', 'Attempt #: #0\nPath: #0\nDirection: waiting to restart from the root\nStatus: To Do');
ed('01_exploration_tree.md', '- **A.** coordinate system correction — Branch point: #1 — Basis: textures attach\n- **B.** Blender route — Branch point: #1 — Basis: conversion loss needs checking\n', '- **A.** Blender route — Branch point: #0 — Basis: conversion loss needs checking\n');
ed(S, 'Success criteria met:\n- [ ] —', 'Success criteria met:\n- [ ] axis correction: X — cannot be solved');
ed(S, 'Distance to destination: —', 'Distance to destination: Farther — the premise collapsed');
ed(S, 'Conclusion: —', 'Conclusion: Discarded');
const c4 = nav('check'); show('check (after the return)', c4);
expect('4e I-14 Return point ∈ Path', c4, 'I-14  ✅', 'I-19  ✅');
expect('4f I-15 no discard check → violation', c4, 'I-15  ❌');
ed(S, '## Round 2 · Attempt #2\n\nCycle goal: —\n\n### PLAN\nHypothesis:\n> —\n\nSuccess criteria (this cycle):\n- [ ] —\n\nLessons consulted: —\nDiscard check: —', '## Round 2 · Attempt #2\n\nCycle goal: coordinate system correction\n\n### PLAN\nHypothesis:\n> —\n\nSuccess criteria (this cycle):\n- [ ] —\n\nLessons consulted: None\nDiscard check: a different direction from manual retopology — covers automatic conversion only');
expect('4g I-15 pass', nav('check'), 'I-15  ✅', 'I-20  ✅', 'IsolationSet: None');
expect('4g2 state Discarded → Canceled', nav('state', '#2'), 'Result: Failure', 'Conclusion: Discarded', 'Status: Canceled');
expect('4g3 after the return ★ #0 → To Do', nav('status'), '[Status] To Do (Attempt #0)');
ck('4g4 I-20 Discarded but no discarded row', '01_exploration_tree.md', '| #2 | #1 | coordinate system correction | axis flip cannot be solved | ' + TODAY + ' | importer 2.0 released |\n', '', 'I-20  ❌', 'Discarded Directions lacks #2 row');
const b4 = nav('brief'); show('brief (after the return)', b4);
expect('4h brief discard candidates are only Branch point ∈ Path', b4, '[Discard check candidates] 1', 'manual retopology', '!axis flip', '[Valid lessons] 0');

// 5. migration: 4 attempt summary rows → the top 1 row to the archive
nav('snapshot');
const doneCycle = (n, p, goal) => '\n---\n\n' + skel('## Round ' + n + ' · Attempt #' + p).replace('Cycle goal: —', 'Cycle goal: ' + goal).replace('Lessons consulted: —', 'Lessons consulted: None')
  .replace('Discard check: —', 'Discard check: a different direction from manual retopology — covers automatic conversion only').replace('Success criteria met:\n- [ ] —', 'Success criteria met:\n- [x] ' + goal + ': O — confirmed')
  .replace('Distance to destination: —', 'Distance to destination: Closer — one step forward').replace('Conclusion: —', 'Conclusion: Continue') + '\n';
fs.appendFileSync(P(S), doneCycle(3, 3, 'Blender route') + doneCycle(4, 4, 'material cleanup'));
ed('01_exploration_tree.md', '| Failure | Discarded | None | ' + S + ' |', '| Failure | Discarded | None | ' + S + ' |\n| #3 | #0 | Blender route | Success | Continue | None | ' + S + ' |\n| #4 | #3 | material cleanup | Success | Continue | None | ' + S + ' |');
ed('01_exploration_tree.md', 'Attempt #: #0\nPath: #0\nDirection: waiting to restart from the root\nStatus: To Do', 'Attempt #: #4\nPath: #0 → #3 → #4\nDirection: material cleanup\nStatus: Done');
expect('5a I-03 cap exceeded', nav('check'), 'I-03  ❌', 'attempt summaries 4');
const row1 = '| #1 | #0 | USD direct import | Partial | Continue | #K001 | ' + S + ' |';
ed('01_exploration_tree.md', row1 + '\n', '');
const MONTH = TODAY.slice(0, 7);
const ar = nav('anchor', 'archive-file-structure').replace(/YYYY-MM-DD/, TODAY).replace(/period: YYYY-MM/, 'period: ' + MONTH).replace('attempts: []', 'attempts: [1]');
wr('archive/tree_' + MONTH + '.md', ar.replace('| — | — | — | — | — | — | — |', row1) + '\n');
expect('5b I-17 archived_through not updated', nav('check'), 'I-17  ❌');
ed('01_exploration_tree.md', 'archived_through: None', 'archived_through: ' + MONTH);
const c5 = nav('check'); show('check (after migration)', c5);
expect('5c migration passes', c5, 'I-16  ✅', 'I-17  ✅', 'I-18  ✅', 'I-11  ✅', 'I-20  ✅', 'IsolationSet: None');
ed('01_exploration_tree.md', '| #2 | #1 | coordinate system correction | Failure', row1 + '\n| #2 | #1 | coordinate system correction | Failure');
expect('5d I-16 copied only, not erased', nav('check'), 'I-16  ❌', 'both');
ed('01_exploration_tree.md', row1 + '\n| #2 | #1 | coordinate system correction | Failure', '| #2 | #1 | coordinate system correction | Failure');
const AR = 'archive/tree_' + MONTH + '.md';
expect('5e I-04 archive baseline', nav('check'), 'I-04  ✅', 'archive files 1');
inj('5f Archive attempts', AR, 'attempts: [1]', 'attempts: [1st]', AR + ' attempts = "[1st]"');
inj('5g Archive last_updated', AR, 'last_updated: ' + TODAY, 'last_updated: Today', AR + ' last_updated = "Today"');
inj('5h archive migrated rows', AR, '| #1 | #0 | USD', '| 1 | #0 | USD', 'Migrated Attempt Summaries row 1 # = "1"');
ck('5i I-05 archive result outside the vocabulary', AR, '| Partial | Continue |', '| so-so | Continue |', 'I-05  ❌', 'Migrated Attempt Summaries row 1 Result = "so-so"');

// 7. regressions of past errors (problems reported while using v2)
const TREE = '01_exploration_tree.md';
const src = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const has = (name, text, ...needles) => expect(name, text, ...needles);
// 7-F. frontmatter best_attempt: #1
ck('7F1 best_attempt: #1 → I-04 ❌(read as an empty value)', TREE, 'best_attempt: None', 'best_attempt: #1', 'I-04  ❌', 'best_attempt = "" (expected: integer or None)');
ck('7F2 best_attempt: 1 → pass', TREE, 'best_attempt: None', 'best_attempt: 1', 'I-04  ✅');
{ const k = rd(TREE); ed(TREE, 'best_attempt: None', 'best_attempt: #1'); expect('7F3 the hook gives the same verdict', hook(), '[Integrity] ❌', 'I-04'); wr(TREE, k); }
has('7F4 # the prohibition rule is inside the anchor block', nav('anchor', 'frontmatter-empty-value-rule'), '`#` (in YAML', 'attempt `7`');
has('7F5 wrap has the best_attempt write step and the pointer', src('.claude/skills/pdca-wrap/SKILL.md'), 'frontmatter `best_attempt` to the integer of P without `#`', 'anchor:frontmatter-empty-value-rule');
// 7-P. Return Log placeholder row
const BROW = '| #2 | #0 | must look again from the root | #K001 | ' + S + ' |';
has('7P1 the standing of the template row is in the conventions', nav('anchor', 'notation-grammar'), 'A row whose cells are all `—` is not a data row', 'It is replaced when the first data row is written');
has('7P1b 01 the Return Log of the template starts with an all — row and is not a violation in 0c·0e', src(TREE), '| — | — | — | — | — |');
{ const k = rd(TREE); ed(TREE, BROW, '| #2 | #0 | must look again from the root | — | ' + S + ' |'); const c = nav('check'); const h = hook();
  expect('7P6 Invalidated lessons of a real row — → I-04 ❌', c, 'I-04  ❌', 'Return Log row 1 Invalidated lessons = "—"');
  const ids = (c.split('\n').find(l => l.startsWith('IsolationSet: ')) || '').replace('IsolationSet: ', '');
  expect('7P2 the violation sets of the hook and check are equal', h, '[Integrity] ❌ ' + ids + '"'); wr(TREE, k); }
ck('7P3 3 real rows with the placeholder row left → counted as 3', TREE, BROW, '| — | — | — | — | — |\n' + BROW + '\n' + BROW.replace('#2 | #0', '#3 | #0') + '\n' + BROW.replace('#2 | #0', '#4 | #0'), 'I-03  ✅  return 3 /');
has('7P4 wrap has the procedure for writing a Return Log row', src('.claude/skills/pdca-wrap/SKILL.md'), 'write a row at the very bottom of the Return Log (Blocked at = P, Return point, Why that point, Invalidated lessons = `None`, Body = the session file path of this cycle)');
has('7P5a the position of the latest row is in the conventions', nav('anchor', 'notation-grammar'), '"Latest row" = the bottom data row', 'Migration starts from the **top** data row');
const OLD = '| #9 | #7 | old return | None | ' + S + ' |';
ck('7P5b I-14 looks at the bottom row (a row wedged in higher up is ignored)', TREE, BROW, OLD + '\n' + BROW.replace('#2 | #0', '#2 | #4'), 'I-14  ✅  Return point #4', '/ ★ Attempt # = #4');
// 23. 44section, 5 cases — things whose values went quietly wrong when broken (number 1, recover, is 21i3·21i4)
ck('23a a return row was written but ★ was left as it was (Return point ∈ Path but ★ Attempt # ≠ Return point) → I-14 ❌', TREE, BROW, OLD + '\n' + BROW, 'I-14  ❌  Return point #0 / ★ Attempt # = #4');
ck('23b CHECK had the not-met line removed → I-04 ❌ (keeps the result from being computed as Success)', S, '\n- [ ] coordinate system matches: X — the Z axis is flipped', '', 'I-04  ❌', 'Round 1 Success criteria line count = "CHECK 1 lines / PLAN 2 lines"');
ck('23b2 PLAN a success criteria line removed → I-04 ❌', S, '- [ ] coordinate system matches\n', '', 'I-04  ❌', 'Round 1 Success criteria line count = "CHECK 2 lines / PLAN 1 lines"');
{ wr('knowledge/K002.md', rd('knowledge/K001.md').replace('K001', 'K002'));
  expect('23c a lesson file with no index row → I-19 ❌ (keeps the next number from overwriting that file)', nav('check'), 'I-19  ❌', '#K002 body file exists but index row missing'); fs.unlinkSync(P('knowledge/K002.md')); }
{ const k = rd(TREE); const m = k.match(/^\| (#\d+) \| (#\d+) \| [^|\n]+ \| [^|\n]+ \| \d{4}-\d{2}-\d{2} \|/m); const nb = m[2] === '#0' ? m[1] : '#0';
  wr(TREE, k.replace(m[0], () => m[0].replace('| ' + m[1] + ' | ' + m[2] + ' |', '| ' + m[1] + ' | ' + nb + ' |')));
  expect('23d Branch point of a Discarded Directions row ≠ Branch point of the attempt summary row with the same # → I-20 ❌', nav('check'), 'I-20  ❌', 'Discarded Directions row 1 ' + m[1] + ' Branch point = "' + nb + '" (attempt summary row Branch point: ' + m[2] + ')'); wr(TREE, k); }
has('23e conventions: the sentences of the 5 cases', nav('anchor', 'check-execution') + nav('anchor', 'invariant-table-T1') + nav('anchor', 'invariant-table-T2') + nav('anchor', 'invariant-table-T3'), 'the target line regex during `recover`', '⑥ for every closed round of a session file, CHECK `Success criteria met:` item line count = PLAN `Success criteria (this cycle):` item line count', '`knowledge/` = the index `#` set', '★ `Attempt #:` = that `Return point`', 'compared only when there is exactly 1 attempt summary row');
ck('7P5c I-14 the return point of the bottom row is outside the path → ❌', TREE, BROW, BROW + '\n' + OLD, 'I-14  ❌  Return point #7');
// 7-P7. hook registration
{ const st7 = JSON.parse(src('.claude/settings.json')).hooks.PostToolUse[0];
  expect('7P7 settings.json has the Write hook registered', st7.matcher + ' ' + st7.hooks[0].command, 'Write', 'integrity-check.js');
  const h = hook(); expect('7P7b with the marker, one systemMessage JSON line · marker deleted', h, '{"systemMessage":"[Integrity] ', 'MarkerLeft=false'); }

// 8. destination edits (the writes the /pdca-init edit branch does, and hand edits that break the rules)
// at this point: D1~D4 are recorded in the history (2a snapshot). dz = edits 00, runs the command and reverts.
const dz = (name, edits, cmd, ...needles) => { const k = rd(D0); edits(); expect(name, nav(...cmd.split(' ')), ...needles); wr(D0, k); };
const LOG1 = '| ' + TODAY + ' | Initial version | None |';
const addLog = what => ed(D0, LOG1, LOG1 + '\n| ' + TODAY + ' | ' + what + ' | requirement change |');
const D1L = '- [ ] **D1** — path finding success rate 95% or higher', D2L = '- [ ] **D2** — map error 5cm or less', D4L = '- [ ] **D4** — an operator handles it without explanation';
const EFF = '\n      In effect: Valid';
const addQuant = (n, t) => ed(D0, '\n\n### Qualitative criteria', '\n- [ ] **D' + n + '** — ' + t + EFF + '\n\n### Qualitative criteria');              // bottom of the quantitative section
const addQual = (n, t) => ed(D0, '\n\n---\n\n## Constraints', '\n- [ ] **D' + n + '** — ' + t + EFF + '\n\n---\n\n## Constraints');    // bottom of the qualitative section
const retire = L => ed(D0, L + EFF, L + '\n      In effect: Discarded — ' + TODAY + ', the higher goal changed');
expect('8a baseline: Written · D1~D4 Recorded', nav('dest'), 'DestinationStatus: Written', 'Criterion: D1 | [ ] | Quantitative | Valid | Recorded |', 'Criterion: D4 | [ ] | Qualitative | Valid | Recorded |', 'I-22  ✅  recorded D# 4', '!Unrecorded');
// edits done by the rules → all pass
dz('8b Final Goal changed', () => { ed(D0, 'Isaac Sim is used to build the factory map as a digital twin', 'in the factory map digital twin 2 robots find paths at the same time'); addLog('Final Goal changed'); }, 'dest', 'DestinationStatus: Written', 'Final Goal: in the factory map digital twin 2 robots', 'I-21  ✅', 'change history 2 rows', 'I-22  ✅');
dz('8b2 the whole check passes after the final goal change', () => { ed(D0, 'Isaac Sim is used to build the factory map as a digital twin', 'in the factory map digital twin 2 robots find paths at the same time'); addLog('Final Goal changed'); }, 'check', 'IsolationSet: None', 'violation 0');
dz('8c quantitative criterion added (D5 sits above the qualitative D3)', () => { addQuant(5, '0 collisions'); addLog('D5 added'); }, 'dest', 'DestinationStatus: Written', 'Criterion: D5 | [ ] | Quantitative | Valid | Unrecorded | 0 collisions', 'NextCriterionNumber: D6', 'I-22  ✅  recorded D# 4');
dz('8c2 I-04 passes after a quantitative criterion is added', () => { addQuant(5, '0 collisions'); addLog('D5 added'); }, 'check', 'I-04  ✅', '00 D# 5', 'IsolationSet: None');
dz('8c3 qualitative criterion added', () => { addQual(5, 'the site manager approves'); addLog('D5 added'); }, 'dest', 'DestinationStatus: Written', 'Criterion: D5 | [ ] | Qualitative | Valid | Unrecorded |');
dz('8d criterion discarded (only the In effect line changes)', () => { retire(D2L); addLog('D2 Discarded'); }, 'dest', 'DestinationStatus: Written', 'Criterion: D2 | [ ] | Quantitative | Discarded — ' + TODAY + ', the higher goal changed | Recorded | map error 5cm or less', 'NextCriterionNumber: D5', 'I-22  ✅');
dz('8d2 check passes after a criterion is discarded', () => { retire(D2L); addLog('D2 Discarded'); }, 'check', 'IsolationSet: None');
dz('8e wording change of a recorded criterion = discard + new number', () => { retire(D2L); addQuant(5, 'map error 2cm or less'); addLog('D2 discarded, D5 added'); }, 'check', 'I-04  ✅', 'I-21  ✅', 'I-22  ✅', 'IsolationSet: None');
dz('8e2 numbers continue even when everything is discarded', () => { retire(D1L); retire(D2L); addQuant(5, 'new criterion'); addLog('D1 discarded, D2 discarded, D5 added'); }, 'dest', 'DestinationStatus: Written', 'NextCriterionNumber: D6');
dz('8f wrap checkbox change is not caught by the wording lock', () => ed(D0, D1L, D1L.replace('[ ]', '[x]')), 'dest', 'DestinationStatus: Written', 'Criterion: D1 | [x] |', 'I-22  ✅');
dz('8g constraints and out-of-scope change', () => { ed(D0, '- RTX 3080 1 unit', '- RTX 3080 1 unit\n- by 2026-12-31'); ed(D0, '- perfect physics simulation', '- None'); addLog('Constraints changed'); }, 'dest', 'DestinationStatus: Written');
// edits that break the rules → caught
dz('8h the wording of a recorded criterion edited in place → I-22 ❌', () => ed(D0, 'map error 5cm or less', 'map error 2cm or less'), 'dest', 'DestinationStatus: FormatViolation', 'I-21  ✅', 'I-22  ❌  D2 wording = "map error 2cm or less" (History 0001 wording: "map error 5cm or less")');
dz('8h2 a one-letter typo fix is the same', () => ed(D0, 'an operator handles it without explanation', 'an operator handles it without explanations'), 'check', 'I-22  ❌  D4 wording', 'IsolationSet: I-22');
{ const k = rd(D0); ed(D0, 'map error 5cm or less', 'map error 2cm or less'); expect('8h3 the hook too I-22', hook(), '[Integrity] ❌ I-22'); wr(D0, k); }
dz('8i last criterion row deleted (the number set D1~D3 is intact) → I-22 catches it', () => ed(D0, '\n' + D4L + EFF, ''), 'check', 'I-04  ✅', 'I-22  ❌  D4 item line missing', 'IsolationSet: I-22');
dz('8i2 middle criterion row deleted → I-04 and I-22', () => ed(D0, '\n' + D2L + EFF, ''), 'check', 'I-04  ❌', 'number set = "D1, D3, D4"', 'I-22  ❌  D2 item line missing');
dz('8j numbers swapped (wording unchanged) → I-22 and I-04 order', () => { ed(D0, D1L, '- [ ] **D9** — path finding success rate 95% or higher'); ed(D0, D2L, '- [ ] **D1** — map error 5cm or less'); ed(D0, '**D9**', '**D2**'); }, 'check', 'I-04  ❌', 'number order = "D2, D1, D3, D4"', 'I-22  ❌  D1 wording = "map error 5cm or less"');
dz('8k a skipped number on a new criterion → I-04', () => addQuant(7, '0 collisions'), 'check', 'I-04  ❌', 'number set = "D1, D2, D3, D4, D7"');
dz('8k2 an existing number reused on a new criterion → I-04', () => addQual(2, '0 collisions'), 'check', 'I-04  ❌', 'number set = "D1, D2, D2, D3, D4"');
dz('8l guidance line (fixed line) deleted → I-21', () => ed(D0, '> This file has no frontmatter.\n', ''), 'dest', 'DestinationStatus: FormatViolation', 'I-21  ❌  fixed line 7');
dz('8l2 section renamed → I-21', () => ed(D0, '## Constraints (must be kept)', '## Limits'), 'dest', 'DestinationStatus: FormatViolation', 'I-21  ❌  fixed line', '(expected: "## Constraints (must be kept)")');
dz('8l3 frontmatter added → I-21', () => wr(D0, '---\ntitle: x\n---\n' + rd(D0)), 'dest', 'DestinationStatus: FormatViolation', 'I-21  ❌');
dz('8l4 section added → I-21', () => fs.appendFileSync(P(D0), '\n## Memo\n- note\n'), 'dest', 'DestinationStatus: FormatViolation', 'I-21  ❌  fixed line');
dz('8m final goal 2 lines → I-21', () => ed(D0, 'Isaac Sim is used to build the factory map as a digital twin', 'Isaac Sim is used to build the factory map\nThe robot finds paths'), 'dest', 'DestinationStatus: FormatViolation', '## Final Goal value line 2 (expected: 1)');
dz('8m2 final goal erased → I-21', () => ed(D0, 'Isaac Sim is used to build the factory map as a digital twin\n', ''), 'dest', 'DestinationStatus: FormatViolation', '## Final Goal value line 0 (expected: 1)', 'Final Goal: None');
dz('8n constraints emptied → I-21', () => ed(D0, '- RTX 3080 1 unit\n', ''), 'dest', 'DestinationStatus: FormatViolation', 'value lines 0 (expected: 1 or more)');
dz('8n2 prose line in the constraints → I-21', () => ed(D0, '- RTX 3080 1 unit', 'RTX 3080 1 unit only is used'), 'dest', 'DestinationStatus: FormatViolation', '(expected: "- " at the start)');
dz('8o change history reason blank → I-21', () => ed(D0, LOG1, LOG1 + '\n| ' + TODAY + ' | D2 Discarded |  |'), 'dest', 'DestinationStatus: FormatViolation', 'change history row 2 Reason for change blank');
dz('8o2 prose line in the success criteria section → I-21', () => ed(D0, D1L, 'the success rate matters\n' + D1L), 'dest', 'DestinationStatus: FormatViolation', '(expected: an item line or an In effect line)');
// ◎ a criterion cited by the best record
{ const kt = rd(TREE); wr(TREE, kt.replace(/^Why closest:.*$/m, 'Why closest:  D1, D2 met / D4 unmet — test'));
  dz('8p ◎ cited criterion discarded → the row stays and I-13 passes', () => { retire(D2L); addLog('D2 Discarded'); }, 'check', 'I-13  ✅', 'all cited D# exist', 'I-22  ✅');
  dz('8p2 ◎ cited criterion row deleted → I-13 and I-22', () => ed(D0, '\n' + D4L + EFF, ''), 'check', 'I-13  ❌  D4 item line is not in 00_destination.md', 'I-22  ❌');
  wr(TREE, kt);
  expect('8p3 brief: ◎ unfilled = no best record', nav('brief'), '[Best Record] None');
  wr(TREE, kt.replace(/^Closest attempt:.*$/m, 'Closest attempt: #1').replace(/^Why closest:.*$/m, 'Why closest:  D1, D2 met / D4 unmet — even the textures attached').replace(/^What blocked it:.*$/m, 'What blocked it: the coordinate system Z axis is flipped'));
  expect('8p4 brief: ◎ 3 line values come out as they are', nav('brief'), '[Best Record] #1 | D1, D2 met / D4 unmet — even the textures attached | What blocked it: the coordinate system Z axis is flipped');
  expect('8p5 that ◎ value passes check too', nav('check'), 'I-02  ✅', 'I-06  ✅', 'I-13  ✅');
  wr(TREE, kt); }
// an unrecorded criterion can be edited, and is locked after the snapshot of wrap records it (this block grows the history)
addQuant(5, '0 collisions'); addLog('D5 added');
ed(D0, '0 collisions', '1 collision or fewer');
expect('8q wording change of an unrecorded criterion → passes', nav('dest'), 'DestinationStatus: Written', 'Criterion: D5 | [ ] | Quantitative | Valid | Unrecorded | 1 collision or fewer', 'I-22  ✅  recorded D# 4');
const snapQ = nav('snapshot');
expect('8q2 snapshot records the changed 00 in the history', snapQ, 'History recorded: ', 'changed files');
expect('8q3 after being recorded = Recorded', nav('dest'), 'Criterion: D5 | [ ] | Quantitative | Valid | Recorded | 1 collision or fewer', 'I-22  ✅  recorded D# 5');
dz('8q4 wording change after being recorded → I-22 ❌', () => ed(D0, '1 collision or fewer', '0 collisions'), 'dest', 'DestinationStatus: FormatViolation', 'I-22  ❌  D5 wording = "0 collisions"');
{ const k = rd(D0); ed(D0, '1 collision or fewer', '0 collisions'); nav('snapshot');
  expect('8q5 even when snapshot runs again with the edit in place, the wording first recorded is the yardstick', nav('dest'), 'I-22  ❌  D5 wording = "0 collisions"', 'wording: "1 collision or fewer")');
  wr(D0, k); expect('8q6 passes when the wording is put back', nav('dest'), 'DestinationStatus: Written', 'I-22  ✅'); }
expect('8q7 the destination change shows in the history diff', nav('diff', '1'), '00_destination.md: -', '+ - [ ] **D5** — 1 collision or fewer', '+ | ' + TODAY + ' | D5 added | requirement change |');
// command documents
has('8r pdca-start blocks first with dest', src('.claude/skills/pdca-start/SKILL.md'), '## 0. Check the destination', 'node .claude/hooks/nav.js dest', '[Start aborted] destination {DestinationStatus value} — run /pdca-init first');
has('8r2 pdca-init branches on the dest output', src('.claude/skills/pdca-init/SKILL.md'), '`Unwritten` → go to 2', '`Written` → go to 3', '`FormatViolation` → go to 4', 'anchor:00-writing-rules', 'anchor:00-file-structure', '`NextCriterionNumber`');
has('8r3 the six edits are in the conventions', nav('anchor', '00-writing-rules'), 'An edit is one of the six below, and nothing else', 'Change the wording of a recorded criterion', 'Change the wording of an unrecorded criterion', 'Fixed line regex');
expect('9a after closing the cycle: no open cycle', nav('brief'), '[Open cycle] None', '[Resume point] None');
expect('9a2 the full check passes even when a round holding a pause memo is closed', nav('check'), 'IsolationSet: None', 'I-23  ✅  open rounds 0');
has('9b wrap splits at the first branch', src('.claude/skills/pdca-wrap/SKILL.md'), '"End this cycle / end only the session and continue the cycle?"', 'End only the session → go to 12', '## 12. Session pause', '`### PLAN` · `### CHECK` · `### ACT` · the `Conclusion:` line or any other file', 'anchor:session-file-writing', 'the conclusion is received as `Pivot` in 3-1');
has('9b2 start continues the open round without asking and runs the full check', src('.claude/skills/pdca-start/SKILL.md'), 'continue that round without asking', 'There is no option of starting a new cycle while leaving an open cycle', '3. Run `node .claude/hooks/nav.js check`', '[Start aborted] violations unresolved: {IsolationSet}', '!Shall I continue / start anew');
has('9b3 the pause memo format is in the conventions', nav('anchor', 'session-file-writing'), '#### {YYYY-MM-DD} {HH:MM} — Session paused', '`Did: {value}` · `Remaining: {value}` · `Next first action: {value}`', 'Open round count condition → grep -F "anchor:invariant-table-T1"', '!1 or fewer');
// 10. follow-up fixes after verification (a rule in one place only · no missing branch)
const SPEC = fs.readFileSync(path.join(SRC, 'NOTATION_CONVENTIONS'), 'utf8');
const count = (t, s) => t.split(s).length - 1;
expect('10a date regex written = only 2 places, pk-definition-table (session PK) and column-kind-definitions (date literal)', String(count(SPEC, '[0-9]{4}-[0-9]{2}-[0-9]{2}')), '2');
expect('10a2 attempt PK and lesson PK regexes written in 1 place each', count(SPEC, '#(0\\|[1-9][0-9]*)') + '/' + count(SPEC, '#K[0-9]{3}'), '1/1');
{ const fc = JSON.parse(rd('.claude/hooks/format-constants.json'));
  expect('10a3 constants with the slot names filled in', [fc.regex.sessionHeader, fc.regex.invalidationId, fc.regex.effective[1], fc.regex.pauseMemo[0]].join('\n'),
    '^## Round [1-9][0-9]* · Attempt #(0|[1-9][0-9]*)( continued)?$', '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', '^Discarded — [0-9]{4}-[0-9]{2}-[0-9]{2}, .+$', '^#### [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2} — Session paused$', '!{Attempt PK}', '!{Date literal}', '!{Session PK}');
  expect('10a4 the initial values before first wrap come from the constants', fc.init.date + ' ' + fc.init.path, 'YYYY-MM-DD sessions/YYYY-MM-DD.md'); }
{ const nv = src('.claude/hooks/nav.js');
  expect('10b nav.js has no format literal written directly', nv, "!'YYYY-MM-DD'", '![0-9]{4}-[0-9]{2}', '!D[0-9]+', '!Session paused$/'); }
expect('10c counts are not written in the conventions (the list is the invariant tables) · the open round condition and the wording lock condition in 1 place each', count(SPEC, '23 invariants') + '/' + count(SPEC, 'number at most 1') + '/' + count(SPEC, 'equals the wording in the full text where that number first appeared'), '0/1/1');
has('10d init: rejected and no-change branches', src('.claude/skills/pdca-init/SKILL.md'), 'Rejected → print `[Destination aborted] not written` and end', '`[Destination done] no change` and end', '`DestinationFile: None`, `node .claude/hooks/nav.js dest --create` is run');
has('10d2 wrap: rejected branch · brief with the picked round · the pause path also has the marker', src('.claude/skills/pdca-wrap/SKILL.md'), 'Rejected → print `[wrap aborted] not written — the cycle stays open` and end', 'brief {file of this cycle} {N}', '4. Make `locks/integrity-check.pending` with Write (the same as 10-1)');
// 11. D# of Why closest · candidate line format (regex source = conventions, assembled into constants)
{ const kt = rd(TREE); const near = v => kt.replace(/^Closest attempt:.*$/m, 'Closest attempt: #1').replace(/^Why closest:.*$/m, 'Why closest:  ' + v).replace(/^What blocked it:.*$/m, 'What blocked it: the coordinate system');
  wr(TREE, near('D0 met — test')); expect('11a D0 in Why closest → I-13 ❌ (the same format as the D# definition)', nav('check'), 'I-13  ❌', '{D# met span} — {prose}');
  wr(TREE, near('D01, D2 met / D4 unmet — test')); expect('11a2 Why closest with D01 → I-13 ❌', nav('check'), 'I-13  ❌');
  wr(TREE, near('D1, D2 met / D4 unmet — test')); expect('11a3 a normal value passes', nav('check'), 'I-13  ✅');
  wr(TREE, kt); }
const HC = '## Next Direction Candidates\n';
ck('11b candidate bullet outside A·B·C → I-04 ❌', TREE, HC, HC + '\n- **D.** another way — Branch point: #1 — Basis: test\n', 'I-04  ❌', 'candidates ');
ck('11b2 a - line with no format in the candidates section → I-04 ❌', TREE, HC, HC + '\n- to look at later\n', 'I-04  ❌', 'candidates ');
ck('11b3 candidate branch point is not in attempt number format → I-04 ❌', TREE, HC, HC + '\n- **A.** another way — Branch point: 1 — Basis: test\n', 'I-04  ❌', 'candidates ');
ck('11b4 no candidate basis → I-04 ❌', TREE, HC, HC + '\n- **A.** another way — Branch point: #1\n', 'I-04  ❌', 'candidates ');
expect('11c no loose D# regex in the conventions · no candidate line regex in nav.js', count(SPEC, 'D[0-9]+') + '/' + count(src('.claude/hooks/nav.js'), 'Branch point: ('), '0/0');
{ const fc = JSON.parse(rd('.claude/hooks/format-constants.json'));
  expect('11d assembled constants', fc.regex.nearReason + '\n' + fc.regex.candidate, '^(D[1-9][0-9]*(, D[1-9][0-9]*)* met|None met)( / D[1-9][0-9]*(, D[1-9][0-9]*)* unmet)?$', '^- \\*\\*[A-C]\\.\\*\\* .+ — Branch point: #(0|[1-9][0-9]*) — Basis: .+$'); }
// 12. a discarded attempt cannot be resumed (at this point: Recent Attempts #2·#3·#4, in Discarded Directions #2)
expect('12a ResumableAttempts lacks the discarded #2 · has the successful #3·#4 and #1 of the archive · the computed status beside the number', nav('route'), 'ResumableAttempts: #1 (In Progress), #3 (Done), #4 (Done)\n', 'NextAttemptNumber: #5');
expect('12a2 the last round of a discarded attempt can only be looked up', nav('last', '#2'), '[Last round] ', 'Attempt #2', '  Conclusion: Discarded');
{ const k = rd(TREE); ed(TREE, '| #2 | #1 | coordinate system correction | axis flip cannot be solved |', '| — | #1 | coordinate system correction | axis flip cannot be solved |');
  expect('12b when the discard table has no number it enters the list again (the basis = the # column of the table alone)', nav('route'), 'ResumableAttempts: #1 (In Progress), #2 (Canceled), #3 (Done), #4 (Done)\n'); wr(TREE, k); }
// 12-1. an attempt pushed to the archive can also be resumed (at this point: #1 is only in the archive, not in the path or attempt summaries of the tree)
expect('12h baseline: #1 is not in the tree, only in the archive', String(/^\| #1 \|/m.test(rd(TREE))) + '/' + String(/→ #1|#1 →/.test(rd(TREE))) + '/' + String(rd(AR).includes('| #1 | #0 |')), 'false/false/true');
{ const ks = rd(S), ka = rd(AR); ed(S, 'Conclusion: Continue', 'Conclusion: Pivot'); ed(AR, '| Partial | Continue |', '| Partial | Pivot |');   // Round 1 (Attempt #1) closed as on hold
  expect('12h2 an on-hold (On Hold) attempt pushed to the archive shows in the list', nav('route'), 'ResumableAttempts: #1 (On Hold), #3 (Done), #4 (Done)\n');
  expect('12h3 that state passes the full check', nav('check'), 'IsolationSet: None');
  expect('12h4 last after picking also shows the last round of that attempt', nav('last', '#1'), '[Last round] Round 1 · Attempt #1 · ' + S, '  Conclusion: Pivot');
  fs.appendFileSync(P(S), '\n---\n\n' + skel('## Round 9 · Attempt #1 continued').replace('Discard check: —', 'Discard check: a different direction from manual retopology — covers automatic conversion only') + '\n');
  expect('12h5 resuming and opening a new round makes the status follow · the full check passes', nav('route') + '\n' + nav('check'), 'OpenRound: Round 9 · Attempt #1 continued', 'ResumableAttempts: #1 (In Progress), #3 (Done), #4 (Done)\n', 'IsolationSet: None');
  wr(S, ks); wr(AR, ka); }
{ const ka = rd(AR); ed(AR, '| #1 | #0 | USD', '| #8 | #0 | USD');
  expect('12i when the attempt of an archive row has no round, the parentheses hold Undetermined', nav('route'), 'ResumableAttempts: #3 (Done), #4 (Done), #8 (Undetermined)\n'); wr(AR, ka); }
{ const ka = rd(AR); fs.unlinkSync(P(AR));
  expect('12j without the archive file #1 is not in the list (source = the attempt summaries of the archive)', nav('route'), 'ResumableAttempts: #3 (Done), #4 (Done)\n'); wr(AR, ka); }
has('12k the convention definition has the archives and the item format · start takes the number before the parentheses as P', nav('anchor', 'check-execution') + src('.claude/skills/pdca-start/SKILL.md'), '`archive/tree_YYYY-MM.md` Migrated Attempt Summaries `#`', 'Item = `{Attempt PK} ({computed status})`', 'P = the attempt number before the parentheses of the picked item');
// 13. PLAN — a round cut off before it was written (at this point: path #0 → #3 → #4, 1 discarded row with branch point #0 = there is a discard check candidate)
{ const ks = rd(S); const sk9 = skel('## Round 9 · Attempt #5'); const add = b => { wr(S, ks); fs.appendFileSync(P(S), '\n---\n\n' + b + '\n'); };
  const filled = sk9.replace('Cycle goal: —', 'Cycle goal: test').replace('Hypothesis:\n> —', 'Hypothesis:\n> If done, it will work. Because it is so.').replace('Success criteria (this cycle):\n- [ ] —', 'Success criteria (this cycle):\n- [ ] it works').replace('Lessons consulted: —', 'Lessons consulted: None');
  add(sk9);
  expect('13a cut off after writing only the skeleton: the full check passes · I-15 skipped', nav('check'), 'IsolationSet: None', 'I-15  skipped  ' + S + ' Round 9 = PLAN Unwritten open round');
  expect('13a2 brief reports PLAN Unwritten', nav('brief'), '[Open cycle] Round 9 · Attempt #5 · ' + S, '  PLAN: Unwritten');
  add(filled);
  expect('13b only four slots filled (Discard check —) = still Unwritten · I-15 skipped', nav('brief') + '\n' + nav('check'), '  PLAN: Unwritten', 'I-15  skipped');
  add(filled.replace('Discard check: —', 'Discard check: None'));
  expect('13c PLAN Written but no discard check → I-15 ❌ (as before)', nav('brief') + '\n' + nav('check'), '  PLAN: Written', 'I-15  ❌', 'Discard check = "None"');
  add(filled.replace('Discard check: —', 'Discard check: a different direction from manual retopology — covers automatic conversion only'));
  expect('13d PLAN Written · has a basis for the check → I-15 ✅', nav('brief') + '\n' + nav('check'), '  PLAN: Written', 'I-15  ✅', 'IsolationSet: None');
  add(sk9.replace('Conclusion: —', 'Conclusion: Continue'));
  expect('13e PLAN a round closed while Unwritten is not skipped → I-15 ❌', nav('check'), 'I-15  ❌', 'Discard check = "—"');
  add(filled.replace('Discard check: —', 'Discard check: a different direction from manual retopology — covers automatic conversion only').replace('Hypothesis:\n> If done, it will work. Because it is so.', 'Hypothesis:'));
  expect('13f no hypothesis value line = Unwritten', nav('brief'), '  PLAN: Unwritten');
  wr(S, ks); }
has('13g start: resuming × PLAN value branches · the PLAN line definition of the conventions and the I-15 run condition', src('.claude/skills/pdca-start/SKILL.md') + nav('anchor', 'check-execution') + nav('anchor', 'invariant-table-T2'),
  '**resuming** and `PLAN: Written` → print `[Start done] resuming', '**resuming** and `PLAN: Unwritten` → go to step 3', 'New round (2-3) → go to step 3', '`PLAN: {Written | Unwritten}` line', '`PLAN:` value is `Unwritten` in');
has('12c the ResumableAttempts definition of the conventions (definition only, no explanatory sentence)', nav('anchor', 'check-execution'), 'the numbers in the `#` column of the Discarded Directions table', '!a discarded attempt is not resumed', '!goes through the discard check');
expect('12d baseline: computed status of the discarded attempt #2 = Canceled → I-20 passes', nav('check'), 'I-20  ✅', 'discarded attempts 1 status = Canceled');
{ const k = rd(S); fs.appendFileSync(P(S), '\n---\n\n' + skel('## Round 9 · Attempt #2 continued') + '\n');
  expect('12e a new round opened on a discarded attempt → I-20 ❌', nav('check'), 'I-20  ❌', 'Discarded Directions row 1 #2 computed status = "In Progress" (expected: Canceled)');
  expect('12e2 the hook gives the same verdict', hook(), '[Integrity] ❌', 'I-20'); wr(S, k); }
{ const k = rd(S); fs.appendFileSync(P(S), '\n---\n\n' + skel('## Round 9 · Attempt #2 continued').replace('Success criteria met:\n- [ ] —', 'Success criteria met:\n- [ ] axis alignment: X — still flipped').replace('Distance to destination: —', 'Distance to destination: Same — no change').replace('Lessons consulted: —', 'Lessons consulted: None').replace('Conclusion: —', 'Conclusion: Continue') + '\n');
  expect('12f when a discarded attempt is closed again and the conclusion is not Discarded I-20 ❌', nav('check'), 'I-20  ❌', 'Discarded Directions row 1 #2 computed status = "Blocked" (expected: Canceled)'); wr(S, k); }
{ const k = rd(TREE); ed(TREE, '| #2 | #1 | coordinate system correction | axis flip cannot be solved |', '| #8 | #1 | coordinate system correction | axis flip cannot be solved |');
  expect('12g a number of the discard table has no round → I-20 ⚠ or ❌ (does not pass)', nav('check'), '!I-20  ✅'); wr(TREE, k); }
expect('10e history  command reads with the header row regex built from the constants', nav('history'), '0001 | ' + TODAY + ' | ');
has('9b4 CLAUDE.md cycle boundary guidance', src('CLAUDE.md'), '4. Cycle boundary', '"PDCA cycle goals all seem to be achieved. Close the current cycle with /pdca-wrap, and start the following work with /pdca-start."');
has('8r4 CLAUDE.md 4 commands', src('CLAUDE.md'), 'There are 4 commands: /pdca-init · /pdca-start · /pdca-status · /pdca-wrap.');

// 14. status record: a project that already has work done at the time of /pdca-init (it writes down the reaction of the present system as it is, not how it should be · existing work is used only as the basis of the destination draft)
{
  const IDX = '02_knowledge_base.md', PAST = '2026-01-10', SP = 'sessions/' + PAST + '.md';
  const reset = () => {
    for (const x of ['locks', 'knowledge', 'sessions', 'archive', 'history']) { fs.rmSync(P(x), { recursive: true, force: true }); fs.mkdirSync(P(x), { recursive: true }); }
    for (const f of [TREE, IDX]) fs.cpSync(path.join(SRC, f), P(f)); fs.rmSync(P(D0), { force: true });
    nav('dest', '--create');
    ed(D0, '{Final goal in one sentence}', 'Build the factory map as a digital twin'); ed(D0, '- [ ] **D1** — {quantitative criterion}', '- [ ] **D1** — path finding success rate 95% or higher'); ed(D0, '- [ ] **D2** — {qualitative criterion}', '- [ ] **D2** — textures are indistinguishable from the real thing');
    ed(D0, '- {constraint}', '- RTX 3080 1 unit'); ed(D0, '- {out-of-scope item}', '- perfect physics simulation'); ed(D0, '| — | — | — |', '| ' + TODAY + ' | Initial version | None |');
  };
  const DH = 'Retry condition |\n|---|---|---|---|---|---|\n'; const DISC0 = '| — | #0 | manual retopology | too much effort | ' + PAST + ' | staff added |';
  const disc = row => ed(TREE, DH + '| — | — | — | — | — | — |', DH + row);
  const SUM0 = '| — | — | — | — | — | — | — |'; const ROW1 = '| #1 | #0 | USD direct import | Partial | Continue | None | ' + SP + ' |';
  const KF = (att, date) => '# K001 — existing lesson\n\n```\nDiscovered: ' + att + ' (' + date + ')\nRelated attempts: ' + att + '\nInvalidation:    None\n```\n\n## Content\n\nContent\n\n## Cautions / Limits\n\nNone\n';
  const KROW = '| #K001 | Valid | the USD importer flips the Z axis | right after import |';
  const starTo = (n, pv, dir, st, date, body) => ed(TREE, 'Attempt #: #0\nPath: #0\nDirection: Before the start — destination set, exploring the first direction\nStatus: To Do\nStarted: YYYY-MM-DD\nBody: sessions/YYYY-MM-DD.md', 'Attempt #: ' + n + '\nPath: ' + pv + '\nDirection: ' + dir + '\nStatus: ' + st + '\nStarted: ' + date + '\nBody: ' + body);
  const closedC = (h, goal, items, dist, concl) => skel(h).replace('Cycle goal: —', 'Cycle goal: ' + goal).replace('Hypothesis:\n> —', 'Hypothesis:\n> If done, it will work. Because it is so.')
    .replace('Success criteria (this cycle):\n- [ ] —', 'Success criteria (this cycle):\n' + items.split('\n').map(l => '- [ ] ' + l.replace(/^- \[.\] /, '').split(':')[0]).join('\n')).replace('Lessons consulted: —', 'Lessons consulted: None').replace('Discard check: —', 'Discard check: None')
    .replace('Success criteria met:\n- [ ] —', 'Success criteria met:\n' + items).replace('Distance to destination: —', 'Distance to destination: ' + dist).replace('Conclusion: —', 'Conclusion: ' + concl);
  const C1 = closedC('## Round 1 · Attempt #1', 'USD direct import', '- [x] mesh opens: O — confirmed\n- [ ] coordinate system matches: X — flipped', 'Closer — the mesh opens', 'Continue');
  // 14-1. commands only: right after init every place where existing work would show is empty
  reset();
  expect('14a status: right after init the briefing has every existing-work place at 0 · None', nav('brief') + '\n' + nav('route'), '[Current position] Attempt #0 — Before the start', '[Best Record] None', '[Discard check candidates] 0', '[Valid lessons] 0', '[Next Direction Candidates] 0', 'ResumableAttempts: None', 'NextAttemptNumber: #1');
  has('14a2 init writes only 00, and work already done is received with the first question and used only as the basis of the destination draft', src('.claude/skills/pdca-init/SKILL.md'), 'It writes no other file', '"Please describe the project you are starting. If there is work already done, or a document that records it, tell me as well"', 'Work already done is used only as the basis of these five items', '`- {that direction} will not be done`');
  expect('14a4 there is no existing-work form or seed command', nav('seed') + '\n' +(/seed|existing_work|form_status/.test(src('NOTATION_CONVENTIONS') + src('.claude/hooks/nav.js') + src('.claude/skills/pdca-init/SKILL.md') + src('.claude/skills/pdca-start/SKILL.md')) ? 'trace found' : 'no trace'), '[nav.js error] unknown command "seed"', '[exit 1]', 'no trace');
  has('14a3 status: when there are 0 discard check candidates, Discard check = None (no comparison with directions already dropped takes place)', src('.claude/skills/pdca-start/SKILL.md'), '`[Discard check candidates]` is `0`, `Discard check:` value = `None`');
  // 14-2. case 4: a criterion already met
  ed(D0, '- [ ] **D1**', '- [x] **D1**');
  expect('14b status (case 4): writing [x] at initial writing still passes the format (the check does not block it)', nav('dest') + '\n' + nav('check'), 'DestinationStatus: Written', 'Criterion: D1 | [x] | Quantitative | Valid | Unrecorded', 'IsolationSet: None');
  has('14b2 status (case 4): the conventions say wrap writes the checkbox, and the item line of the structure template is [ ]', nav('anchor', '00-writing-rules') + nav('anchor', '00-file-structure'), 'checkbox `[ ]`/`[x]` = `/pdca-wrap`', '- [ ] **D1** — {quantitative criterion}');
  // 14-3. put in by hand (before first wrap) — places that pass
  reset(); ed(TREE, '## Next Direction Candidates\n', '## Next Direction Candidates\n\n- **A.** Blender route — Branch point: #0 — Basis: memo from the predecessor\n');
  expect('14c status (case 8): a candidate line put in by hand (branch point #0) → check passes · shows in the briefing', nav('check') + '\n' + nav('brief'), 'IsolationSet: None', '[Next Direction Candidates] 1', 'Blender route');
  reset(); wr('knowledge/K001.md', KF('#0', PAST)); ed(IDX, '| — | — | — | — |', KROW);
  expect('14d status (case 2): a lesson put in by hand (Discovered and Related attempts = #0) → check passes · shows in the briefing', nav('check') + '\n' + nav('brief'), 'IsolationSet: None', '[Valid lessons] 1', '#K001 | the USD importer flips the Z axis');
  reset(); ed(TREE, 'Closest attempt: —\nWhy closest: —\nWhat blocked it: —', 'Closest attempt: #0\nWhy closest: D2 met / D1 unmet — existing output\nWhat blocked it: path finding not implemented'); ed(TREE, 'best_attempt: None', 'best_attempt: 0');
  expect('14e status (cases 3·4): ◎ best record put in by hand = #0 → check passes · shows in the briefing', nav('check') + '\n' + nav('brief'), 'IsolationSet: None', '[Best Record] #0 | D2 met / D1 unmet — existing output');
  // 14-4. put in by hand — places that block
  reset(); disc(DISC0);
  expect('14f status (case 7): a direction dropped without running, put in by hand (# = —) → shows in the briefing but there is no session file, so I-15 ❌', nav('brief') + '\n' + nav('check'), '[Discard check candidates] 1', 'manual retopology', 'I-15  ❌  discarded rows 1 / no session file', 'IsolationSet: I-15');
  has('14f2 status (case 7): in that state start meets a violation in the full check of 1-3, and the start is aborted unless it is fixed', src('.claude/skills/pdca-start/SKILL.md'), '`[Start aborted] violations unresolved: {IsolationSet}`');
  reset(); ed(TREE, SUM0, ROW1);
  expect('14g status (case 1): a past attempt row put in by hand (no session file) → I-12·I-20 ❌', nav('check'), 'I-12  ❌', 'I-20  ❌  Attempt summary row 1 #1 no closed round in the session files', 'IsolationSet: I-12, I-20');
  reset(); ed(TREE, SUM0, ROW1.replace('Partial | Continue', 'Failure | Discarded')); disc('| #1 | #0 | USD direct import | axis flip | ' + PAST + ' | importer 2.0 |');
  expect('14g2 status (case 1): an attempt row tried and dropped + a discarded row (no session file) → I-12·I-15·I-20 ❌', nav('check'), 'IsolationSet: I-12, I-15, I-20');
  // 14-5. case 9: there is no notation for writing an unknown value
  const unk = (name, a, b, id) => { reset(); disc(DISC0); ed(TREE, a, b); expect(name, nav('check'), id + '  ❌'); };
  unk('14h status (case 9): the discard date is unknown → I-04 ❌', PAST + ' | staff', 'unknown | staff', 'I-04');
  unk('14h2 status (case 9): discard date = — → I-04 ❌', PAST + ' | staff', '— | staff', 'I-04');
  unk('14h3 status (case 9): the branch point is unknown(—) → I-04 ❌', '| — | #0 | manual', '| — | — | manual', 'I-04');
  unk('14h4 status (case 9): the retry condition is unknown(—) → I-06 ❌', '| staff added |', '| — |', 'I-06');
  // 14-6. a past-dated session file also made by hand (corresponds to the old v4 Step 4)
  reset();
  wr(SP, prefix.replace(TODAY, PAST) + C1 + '\n\n---\n\n' + closedC('## Round 2 · Attempt #2', 'coordinate system correction', '- [ ] axis correction: X — cannot be solved', 'Farther — the premise collapsed', 'Discarded') + '\n');
  ed(TREE, SUM0, ROW1 + '\n| #2 | #1 | coordinate system correction | Failure | Discarded | None | ' + SP + ' |'); disc('| #2 | #1 | coordinate system correction | axis flip cannot be solved | ' + PAST + ' | importer 2.0 released |');
  starTo('#1', '#0 → #1', 'USD direct import', 'In Progress', PAST, SP); ed(TREE, 'last_updated: YYYY-MM-DD', 'last_updated: ' + PAST);
  { const c = nav('check'); expect('14i status (cases 1·6): writing a past-dated session file + tree row + discarded row + ★ by hand passes format and computed values, only I-15 ❌', c, 'I-04  ✅', 'I-12  ✅', 'I-20  ✅', 'I-15  ❌', 'Discard check = "None"', 'IsolationSet: I-15'); }
  expect('14i2 status: the briefing and routing of that state read the past work', nav('brief') + '\n' + nav('route'), '[Path] #0 → #1', '[Discard check candidates] 1', 'coordinate system correction', 'ResumableAttempts: #1 (In Progress)\n', 'NextRound: 1', 'NextAttemptNumber: #3');
  // 14-7. replay: a past attempt run as the cycle of today, start → wrap (the writes the commands do, as they are)
  reset();
  wr(S, prefix + C1.replace('New lessons: —', 'New lessons: #K001') + '\n'); wr('knowledge/K001.md', KF('#1', TODAY)); ed(IDX, '| — | — | — | — |', KROW);
  ed(TREE, SUM0, ROW1.replace('None | ' + SP, '#K001 | ' + S)); starTo('#1', '#0 → #1', 'USD direct import', 'In Progress', TODAY, S); ed(TREE, 'last_updated: YYYY-MM-DD', 'last_updated: ' + TODAY);
  expect('14j status (cases 1·2): replaying a past attempt as the cycle of today passes everything — every date is today', nav('check') + '\n' + rd(TREE) + rd('knowledge/K001.md'), 'IsolationSet: None', 'Started: ' + TODAY, 'Discovered: #1 (' + TODAY + ')');
  has('14j2 status: the procedure sets dates to today and the date of the session file of this cycle (no step receives a past date)', src('.claude/skills/pdca-wrap/SKILL.md') + nav('anchor', 'current-position-update'), '`Discovered` = P and the date of the session file of this cycle', '`Date` = today', '`Attempt #:` changed');
  ed('knowledge/K001.md', '#1 (' + TODAY + ')', '#1 (' + PAST + ')'); ed(TREE, 'Started: ' + TODAY, 'Started: ' + PAST);
  expect('14j3 status: writing real past dates by hand in the replayed record still passes the check (dates are checked for format only)', nav('check'), 'IsolationSet: None');
  has('14k status: the README says files are not edited by hand', src('README.md'), 'Files are not edited by hand');
}

// 16. initial writing by number of values, pause and DO record — runs in a separately made folder
{
  const mk = name => { const X = T + '_16' + name; fs.rmSync(X, { recursive: true, force: true }); fs.mkdirSync(X, { recursive: true });
    for (const f of ['.claude', '01_exploration_tree.md', '02_knowledge_base.md', 'NOTATION_CONVENTIONS']) fs.cpSync(path.join(SRC, f), path.join(X, f), { recursive: true });
    for (const d of ['locks', 'knowledge', 'sessions', 'archive']) fs.mkdirSync(path.join(X, d), { recursive: true }); return X; };
  const navX = (X, ...a) => { try { return cp.execFileSync('node', [path.join(X, '.claude/hooks/nav.js'), ...a], { cwd: X, env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: X }) }).toString().trimEnd(); } catch (e) { return (e.stdout || '').toString().trimEnd() + ' [exit ' + e.status + ']'; } };
  const QN = '- [ ] **D1** — {quantitative criterion}\n      In effect: Valid\n', QL = '- [ ] **D2** — {qualitative criterion}\n      In effect: Valid\n';
  const pair = (n, t) => '- [ ] **D' + n + '** — ' + t + '\n      In effect: Valid\n';
  const dest = (name, edit) => { const X = mk(name); navX(X, 'dest', '--create'); const p = path.join(X, D0);
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace('{Final goal in one sentence}', 'Achieve the test goal').replace('- {constraint}', '- None').replace('- {out-of-scope item}', '- None').replace('| — | — | — |', '| ' + TODAY + ' | Initial version | None |');
    fs.writeFileSync(p, edit(s)); const o = navX(X, 'dest'); fs.rmSync(X, { recursive: true, force: true }); return o; };
  // A. initial writing — line writing by the number of values
  expect('16a 0 qualitative: erasing the placeholder pair gives Written', dest('a', s => s.replace(QN, pair(1, 'response 200ms or less')).replace(QL, '')), 'DestinationStatus: Written', 'I-21  ✅', 'D# 1', 'Criterion: D1 | [ ] | Quantitative');
  expect('16a2 0 quantitative · 2 qualitative: the qualitative section starts at D1', dest('a2', s => s.replace(QN, '').replace(QL, pair(1, 'easy to read') + pair(2, 'easy to install'))), 'DestinationStatus: Written', 'I-21  ✅', 'Criterion: D1 | [ ] | Qualitative', 'Criterion: D2 | [ ] | Qualitative');
  expect('16a3 2 quantitative · 1 qualitative: quantitative D1·D2, qualitative D3', dest('a3', s => s.replace(QN, pair(1, 'response 200ms or less') + pair(2, 'error rate 1% or less')).replace(QL, pair(3, 'easy to read'))), 'DestinationStatus: Written', 'D# 3', 'Criterion: D3 | [ ] | Qualitative');
  expect('16a4 both 0 = FormatViolation', dest('a4', s => s.replace(QN, '').replace(QL, '')), 'DestinationStatus: FormatViolation', 'I-21  ❌', 'items 0 (expected: 1 or more)');
  expect('16a5 0 qualitative but the placeholder line left = FormatViolation', dest('a5', s => s.replace(QN, pair(1, 'response 200ms or less'))), 'DestinationStatus: FormatViolation', 'placeholder line left');
  expect('16a6 0 qualitative but only the item line erased = FormatViolation', dest('a6', s => s.replace(QN, pair(1, 'response 200ms or less')).replace('- [ ] **D2** — {qualitative criterion}\n', '')), 'DestinationStatus: FormatViolation', 'In effect line without an item line');
  expect('16a7 2 constraint lines · no out-of-scope', dest('a7', s => s.replace(QN, pair(1, 'response 200ms or less')).replace(QL, '').replace('## Constraints (must be kept)\n- None', '## Constraints (must be kept)\n- only 1 GPU is used\n- no external API is used')), 'DestinationStatus: Written', 'I-21  ✅');
  has('16a8 conventions: how to write per number of values at initial writing, and the numbers', nav('anchor', '00-writing-rules'), '| Placeholder line | Number of approved values | How to write |', 'Erase the placeholder item line and the `In effect:` line directly below. Keep the `### ` line', 'Replace that line with `- None`', 'the first item of the quantitative section is `D1`, growing by 1 from top to bottom, and the first item of the qualitative section continues with the next number', 'The numbers written on the placeholder lines are not used', 'A destination with 0 quantitative and qualitative criteria in total is not written');
  has('16a9 init: with 0 criteria it asks before confirming, and how to write follows the conventions', src('.claude/skills/pdca-init/SKILL.md'), 'When the quantitative and qualitative criteria of the draft total 0, do not ask for confirmation; ask for criteria', 'Replace the placeholder lines of that file with the approved values as the initial writing of the destination writing rules says', '!replace only the placeholder lines with the approved values and');
  // B·C·D. session file
  const X = mk('s'); navX(X, 'dest', '--create');
  { const p = path.join(X, D0); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace('{Final goal in one sentence}', 'Achieve the test goal').replace('- {constraint}', '- None').replace('- {out-of-scope item}', '- None').replace('| — | — | — |', '| ' + TODAY + ' | Initial version | None |').replace(QN, pair(1, 'response 200ms or less')).replace(QL, '')); }
  const skel = navX(X, 'anchor', 'session-file-structure').replace(/\r\n/g, '\n').trim().replace('YYYY-MM-DD', TODAY).replace('## Round 1 · Attempt #N', '## Round 1 · Attempt #1') + '\n';
  const SX = path.join(X, S); const put = s => fs.writeFileSync(SX, s);
  put(skel);
  expect('16b an open round with only the skeleton = PLAN: Unwritten · check passes', navX(X, 'brief', S, '1') + '\n' + navX(X, 'check'), 'PLAN: Unwritten', 'DO: 0', 'IsolationSet: None');
  put(skel.replace('Conclusion: —', 'Conclusion: Pivot'));
  expect('16b2 PLAN closing while Unwritten cannot be computed · I-04 ❌ (why wrap does not close it)', navX(X, 'state', '#1') + '\n' + navX(X, 'check'), 'Result: Undetermined', 'Status: Undetermined', 'I-04  ❌', 'IsolationSet: I-04');
  has('16b3 wrap: PLAN  value decides first', src('.claude/skills/pdca-wrap/SKILL.md'), '5. Branch on the `PLAN:` value of the step 3 output:', '`Unwritten` → without asking, print `[wrap notice] PLAN Unwritten — this round cannot be closed` and go to 12', '`Written` → confirm "End this cycle / end only the session and continue the cycle?":', '## 12. Session pause — only when arriving at 12 from 1-5');
  const plan = skel.replace('Cycle goal: —', 'Cycle goal: add a cache').replace('> —', '> If a cache is added, it will get faster. Because lookups decrease.').replace('- [ ] —', '- [ ] 200ms or below').replace('Lessons consulted: —', 'Lessons consulted: None').replace('Discard check: —', 'Discard check: None');
  put(plan);
  expect('16c DO 0 — open round = To Do', navX(X, 'state', '#1'), 'Status: To Do');
  put(plan.replace('### DO\n', '### DO\n#### ' + TODAY + ' 10:00 — added a cache layer\nPut a cache in the lookup path.\n'));
  expect('16c2 DO  entry written gives In Progress · the header shows in brief · check passes', navX(X, 'state', '#1') + '\n' + navX(X, 'brief', S, '1') + '\n' + navX(X, 'check'), 'Status: In Progress', 'DO: 1', '10:00 — added a cache layer', 'IsolationSet: None');
  // DO record hook (Stop) — in the present state with an open round, goes through rows 1~6 of the test table with fake transcripts
  {
    const TP = path.join(X, 'locks', 'transcript.jsonl');
    const U = (c, extra) => Object.assign({ type: 'user', message: { role: 'user', content: c } }, extra || {});
    const A = (name, input) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name, input }] } });
    const R = () => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }] } });
    const stop = (rows, inp) => { if (rows) fs.writeFileSync(TP, rows.map(o => JSON.stringify(o)).join('\n') + '\n');
      try { return cp.execFileSync('node', [path.join(X, '.claude/hooks/do-check.js')], { cwd: X, env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: X }), input: JSON.stringify(Object.assign({ hook_event_name: 'Stop', stop_hook_active: false, transcript_path: TP }, inp || {})) }).toString() || '(no output)'; } catch (e) { return '[exit ' + e.status + '] ' + (e.stdout || '') + (e.stderr || ''); } };
    const EDIT = A('Edit', { file_path: path.join(X, 'src', 'cache.py'), old_string: 'a', new_string: 'b' }), RUN = A('Bash', { command: 'python train.py' });
    const DOW = A('Edit', { file_path: path.join(X, S), old_string: 'a', new_string: 'b' }), NAV = A('Bash', { command: 'node .claude/hooks/nav.js route' });
    expect('17a hook row 6: blocks when there are actions and no DO write', stop([U('add a cache please'), EDIT, R(), RUN, R()]), '"decision":"block"', '[DO record] no DO entry for 2 actions — ', S + ' Round 1');
    expect('17a2 the blocking sentence exactly matches the regex of the conventions', String(new RegExp(nav('anchor', 'do-record-hook-rules').match(/`(\^\\\[DO record\\\] no DO entry for[^`]*)`/)[1]).test(JSON.parse(stop([U('x'), RUN, R()])).reason)), 'true');
    expect('17b hook row 5: passes when the session file of the target round was written', stop([U('add a cache please'), EDIT, R(), NAV, R(), DOW, R()]), '(no output)');
    expect('17c hook row 4: passes with 0 actions (read tools · nav.js runs are not counted)', stop([U('where are we now?'), A('Read', { file_path: 'a.md' }), R(), NAV, R()]), '(no output)');
    expect('17d hook row 3: a response that runs a command passes', stop([U('<command-message>pdca-wrap</command-message>\n<command-name>/pdca-wrap</command-name>'), U('skill body', { isMeta: true }), EDIT, R()]) + stop([U('wrap do it please'), A('Skill', { skill: 'pdca-wrap' }), R(), EDIT, R()]), '(no output)(no output)');
    expect('17e hook row 1: a response continued after a block is not blocked again', stop([U('add a cache please'), EDIT, R()], { stop_hook_active: true }), '(no output)');
    expect('17f looks at this response only: actions of the previous response are not counted', stop([U('add a cache please'), EDIT, R(), U('thanks'), { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'yes' }] } }]), '(no output)');
    expect('17g actions on side (subagent) lines are not counted', stop([U('look into it please'), Object.assign({ isSidechain: true }, RUN), R()]), '(no output)');
    expect('17h when the transcript file cannot be read it does not block and reports', stop(null, { transcript_path: path.join(X, 'locks', 'nofile.jsonl') }) + stop([{ type: 'assistant', message: { content: [] } }]), '[DO record] ⚠ could not check — could not read the transcript file', '[DO record] ⚠ could not check — the transcript file has no user input line', '!"decision"');
    fs.rmSync(TP, { force: true });
    has('17i hook registration (Stop) and the tool lists of the conventions = constants', src('.claude/settings.json') + JSON.stringify(JSON.parse(src('.claude/hooks/format-constants.json')).hook), '"Stop"', 'do-check.js', '"write":["Write","Edit","MultiEdit","NotebookEdit"]', '"run":["Bash","PowerShell"]');
    has('17j the hook script does not write tool names or labels again', String(/'(Write|Edit|MultiEdit|NotebookEdit|Bash|PowerShell)'/.test(src('.claude/hooks/do-check.js'))), 'false');
  }
  has('16c3 conventions: the two times a DO entry is written', nav('anchor', 'session-file-writing'), '① For every response that acted: before ending a response that wrote a file or ran a command, run `node .claude/hooks/nav.js route`', '`OpenRoundCount` is 1 or more, write what that response did as 1 DO entry in the round of the first `OpenRound` line', '② `/pdca-wrap`: among the actions of that session, those the `brief` output DO entry header list lacks are written after user approval');
  has('16c4 CLAUDE.md: DO record step and pointer', src('CLAUDE.md'), '5. DO record', 'run `node .claude/hooks/nav.js route`', 'grep -F "anchor:session-file-writing" (NOTATION_CONVENTIONS)');
  has('16c5 wrap: gathering missing DO happens once before the two paths split (1-4)', src('.claude/skills/pdca-wrap/SKILL.md').split('## 2. CHECK')[0], '4. Gather the missing DO entries.', 'Rejected → write nothing and go to step 5', '6. Run `node .claude/hooks/nav.js snapshot` and go to 2');
  has('16c6 wrap 12 has no gathering step (no copy)', src('.claude/skills/pdca-wrap/SKILL.md').split('## 12. Session pause')[1], '1. Propose the three values of the session-pause memo', '!DO entry drafts');
  const chk = plan.replace('Success criteria met:\n- [ ] —', 'Success criteria met:\n- [ ] 200ms or less: X — 250ms').replace('Conclusion: —', 'Conclusion: Continue');
  put(chk.replace('Distance to destination: —', 'Distance to destination: a bit closer — 50ms less'));
  expect('16d distance line outside the vocabulary: the result comes out and only the status is Undetermined (7-1 looks at both)', navX(X, 'state', '#1'), 'Result: Failure', 'Status: Undetermined — ', 'Distance to destination = "a bit closer');
  put(chk.replace('Distance to destination: —', 'Distance to destination: Same — no change'));
  expect('16d2 computed once the distance line is fixed', navX(X, 'state', '#1'), 'Result: Failure', 'Status: Blocked');
  expect('16d3 Undetermined when the return point has no round (3-2 asks again) · #0 is To Do', navX(X, 'state', '#5') + '\n' + navX(X, 'state', '#0'), 'Status: Undetermined — Attempt #5 has no round in the session files', 'Status: To Do');
  has('16d4 wrap: the return point is checked when received, P in 7-1, and 7-4 ends', src('.claude/skills/pdca-wrap/SKILL.md'), '`node .claude/hooks/nav.js state {return point}`. When the `Status:` value of the output starts with `Undetermined`, show that line and ask this item 2 again', '`Result:` value or the `Status:` value starts with `Undetermined`, show that line, go back to 4 and fix the CHECK lines', '`[wrap aborted] ★ status Undetermined — tree write incomplete` and end', '!stop writing and show that line.');
  // 17k. with no open round the hook passes (row 2) — the state after the round was closed earlier
  {
    const TP = path.join(X, 'locks', 'transcript.jsonl');
    fs.writeFileSync(TP, [{ type: 'user', message: { role: 'user', content: 'x' } }, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: 'python a.py' } }] } }].map(o => JSON.stringify(o)).join('\n') + '\n');
    expect('17k hook row 2: passes with no open round', cp.execFileSync('node', [path.join(X, '.claude/hooks/do-check.js')], { cwd: X, env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: X }), input: JSON.stringify({ stop_hook_active: false, transcript_path: TP }) }).toString() || '(no output)', '(no output)');
  }
  fs.rmSync(X, { recursive: true, force: true });
  // 18. E — count constants are in the 01 format alone, the rest are pointers
  {
    const spec = src('NOTATION_CONVENTIONS'), wrap = src('.claude/skills/pdca-wrap/SKILL.md');
    const outside = spec.replace(/<!-- anchor:01-format-position-path-attempt -->[\s\S]*?<!-- anchor-end:01-format-position-path-attempt -->/, '');
    expect('18a conventions: no ★ 6 lines · ◎ 3 lines · cap 3 outside the 01 format', String(/6 lines|Best Record 3 lines|≤ 3|3 lines or fewer/.test(outside)), 'false');
    expect('18b wrap:  writes no count and uses a pointer', String(/0~3 rows|6 lines|3 lines|exceeds 3/.test(wrap)), 'false');
    has('18c wrap·pointer sentences of the conventions', wrap + nav('anchor', 'invariant-table-T1') + nav('anchor', 'candidate-format'), 'The number is 0 or more and at most the count cap', 'exceeds the count cap of that section', 'at most the caps of Format 5', '0 or more lines and at most the count cap');
    const C0 = JSON.parse(src('.claude/hooks/format-constants.json'));
    expect('18d the structure values of the constants are unchanged (I-01 6 lines · I-02 3 lines · I-03 caps 3)', JSON.stringify(C0.struct), '"I-01":{"line":6,"section":1}', '"I-02":{"line":3,"section":1}', '"Next Direction Candidates":3', '"Return Log":3', '"Recent Attempts":3');
    // 19. F — session file line labels are generated from the round skeleton
    expect('19a constants: 9 line labels + In effect', JSON.stringify(C0.session.label) + C0.dest.effectiveLabel, '"goal":"Cycle goal:"', '"hypothesis":"Hypothesis:"', '"criteria":"Success criteria (this cycle):"', '"lessons":"Lessons consulted:"', '"discard":"Discard check:"', '"achieved":"Success criteria met:"', '"distance":"Distance to destination:"', '"conclusion":"Conclusion:"', '"reason":"Reason:"', 'In effect:');
    expect('19b nav.js has no line label regex written directly', String(/\/\^(Cycle goal|Hypothesis|Success criteria|Lessons consulted|Discard check|Conclusion|Distance to destination|Reason)|In effect:\[/.test(src('.claude/hooks/nav.js'))), 'false');
    expect('19c 23 source anchors = the number in the conventions', C0._generated.source_anchors.length + '/' + (/reads these 23 anchor blocks/.test(spec)) + '/' + C0._generated.source_anchors.includes('session-file-structure') + '/' + C0._generated.source_anchors.includes('do-record-hook-rules'), '23/true/true/true');
    // when a skeleton label is changed: the constants go stale and nav.js stops, and once regenerated it follows the new label
    const keep = rd('NOTATION_CONVENTIONS'), keepC = rd('.claude/hooks/format-constants.json');
    wr('NOTATION_CONVENTIONS', keep.replace('Lessons consulted: —\nDiscard check: —', 'Lessons consulted: —\nDiscard direction check: —'));
    expect('19d skeleton label changed and the constants not regenerated STALE', nav('route'), '[nav.js error] STALE');
    cp.execFileSync('node', [P('.claude/hooks/gen-format-constants.js'), '--write'], { cwd: T, env });
    expect('19e the regenerated constants have the new label', JSON.parse(rd('.claude/hooks/format-constants.json')).session.label.discard, 'Discard direction check:');
    wr('NOTATION_CONVENTIONS', keep.replace('Lessons consulted: —\nDiscard check: —\n', 'Lessons consulted: —\n'));
    let msg = ''; try { cp.execFileSync('node', [P('.claude/hooks/gen-format-constants.js'), '--emit'], { cwd: T, env, stdio: 'pipe' }); } catch (e) { msg = String(e.stderr); }
    expect('19f when the number of skeleton labels changes the generator stops', msg, 'parseSession: PLAN label lines 3 (expected 4)');
    wr('NOTATION_CONVENTIONS', keep); wr('.claude/hooks/format-constants.json', keepC);
    expect('19g normal once reverted', nav('route'), 'Today: ', '![nav.js error]');
  }
}

// 20. ★ the path pre-write condition is tested where the value is received (wrap 3-2) — onpath (a separately made folder)
{
  const X = T + '_20'; fs.rmSync(X, { recursive: true, force: true }); fs.mkdirSync(X, { recursive: true });
  for (const f of ['.claude', '01_exploration_tree.md', '02_knowledge_base.md', 'NOTATION_CONVENTIONS']) fs.cpSync(path.join(SRC, f), path.join(X, f), { recursive: true });
  for (const dd of ['locks', 'knowledge', 'sessions', 'archive']) fs.mkdirSync(path.join(X, dd), { recursive: true });
  const nx = (...a) => { try { return cp.execFileSync('node', [path.join(X, '.claude/hooks/nav.js'), ...a], { cwd: X, env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: X }) }).toString().trimEnd(); } catch (e) { return (e.stdout || '').toString().trimEnd() + ' [exit ' + e.status + ']'; } };
  const TX = path.join(X, '01_exploration_tree.md'); const rt = () => fs.readFileSync(TX, 'utf8').replace(/\r\n/g, '\n');
  const et = (a, b) => { const s = rt(); if (!s.includes(a)) throw new Error('nothing to edit: ' + a); fs.writeFileSync(TX, s.replace(a, () => b)); };
  // baseline: attempts #1 (branch point #0) · #2 (branch point #1) · #3 (branch point #2) exist and a return to #0 made the path "#0" — such a tree
  const R1 = '| #1 | #0 | direction 1 | Failure | Continue | None | ' + S + ' |', R2 = '| #2 | #1 | direction 2 | Failure | Continue | None | ' + S + ' |', R3 = '| #3 | #2 | direction 3 | Failure | Continue | None | ' + S + ' |';
  et('| — | — | — | — | — | — | — |', R1 + '\n' + R2 + '\n' + R3);
  expect('20a an attempt inside the path: Contains Yes · RowBranchPoint None when there is no row', nx('onpath', '#0'), 'Path: #0\nEndNode: #0\nContains: Yes\nRowBranchPoint: None');
  expect('20b return point outside the path (#1) → Contains No (3-2 asks again before writing)', nx('onpath', '#1'), 'EndNode: #0', 'Contains: No', 'RowBranchPoint: #0');
  expect('20c closing #2 again without a return: EndNode ≠ P · B = RowBranchPoint #1', nx('onpath', '#2'), 'EndNode: #0', 'Contains: No', 'RowBranchPoint: #1');
  expect('20c2 that B (#1) is outside the path → Contains No (3-2 asks again before writing)', nx('onpath', '#1'), 'Contains: No');
  expect('20d a new attempt with no row yet → RowBranchPoint None (B = the branch point value to be written in 7-1)', nx('onpath', '#4'), 'Contains: No', 'RowBranchPoint: None');
  expect('20e argument format', nx('onpath', '1') + '\n' + nx('onpath'), '[nav.js error] onpath argument "1"', '[nav.js error] onpath argument "undefined"', '[exit 1]');
  { const k = rt(); et('Path: #0', 'Path: #0 → #1 → #2'); et('Attempt #: #0', 'Attempt #: #2');
    expect('20f a path of several nodes: when EndNode = P it passes without comparison', nx('onpath', '#2'), 'Path: #0 → #1 → #2', 'EndNode: #2', 'Contains: Yes', 'RowBranchPoint: #1');
    expect('20f2 a middle node is also Contains Yes', nx('onpath', '#1'), 'Contains: Yes'); fs.writeFileSync(TX, k); }
  { const k = rt(); et(R1 + '\n', ''); fs.writeFileSync(path.join(X, 'archive/tree_2026-10.md'), '---\nattempts: [1]\nlast_updated: 2026-10-01\n---\n\n## Migrated Attempt Summaries\n\n| # | Branch point | Direction | Result | Conclusion | Lesson | Body |\n|---|---|---|---|---|---|---|\n' + R1 + '\n');
    expect('20g RowBranchPoint is read even when the row is only in the archive', nx('onpath', '#1'), 'RowBranchPoint: #0');
    fs.writeFileSync(TX, k);
    expect('20g2 the same attempt row in both the tree and the archive → error', nx('onpath', '#1'), '[nav.js error] Attempt #1 row count 2 (tree+archive)', '[exit 1]'); fs.unlinkSync(path.join(X, 'archive/tree_2026-10.md')); }
  { const k = rt(); et('Path: #0', 'Path: #0->#1');
    expect('20h the path cannot be read as nodes → error', nx('onpath', '#1'), '[nav.js error] ★ Path "#0->#1"  cannot be read as nodes', '[exit 1]'); fs.writeFileSync(TX, k); }
  // chain path: rebuilds the path when an attempt of a branch dropped from the path by a return is resumed and closed
  expect('20k ChainPath = back through branch points to #0', nx('onpath', '#2') + '\n' + nx('onpath', '#1'), 'ChainPath: #0 → #1 → #2', 'ChainPath: #0 → #1');
  expect('20k2 None for an attempt with no row · #0 is #0', nx('onpath', '#4') + '\n--\n' + nx('onpath', '#0'), 'RowBranchPoint: None\nChainPath: None\n--', 'ChainPath: #0');
  { const k = rt(); et(R1 + '\n', ''); expect('20k3 None when the chain breaks (no #1 row)', nx('onpath', '#2'), 'RowBranchPoint: #1', 'ChainPath: None'); fs.writeFileSync(TX, k); }
  { const k = rt(); et('Path: #0', 'Path: #0 → #1 → #2'); et('Attempt #: #0', 'Attempt #: #2');
    expect('20k4 a ★ written from the chain path + P passes path consistency (I-07·I-08)', nx('check', '--c3'), 'I-07  ✅', 'I-08  ✅  path end-1 = #1 / #2 row Branch point = #1', 'IsolationSet: None'); fs.writeFileSync(TX, k); }
  // check node set of the discard check = ★ path ∪ chain path of the open round attempt
  { const k = rt(); const SX = path.join(X, S);
    et('| — | — | — | — | — | — |', '| — | #1 | 1 branch discard | reason | ' + TODAY + ' | condition |\n| — | #3 | 3 branch discard | reason | ' + TODAY + ' | condition |');
    expect('20m with no open round the check nodes = the ★ path only', nx('brief'), '[Discard check candidates] 0 (Branch point ∈ Path)');
    fs.writeFileSync(SX, prefix + skel('## Round 1 · Attempt #2 continued').replace('Cycle goal: —', 'Cycle goal: continuing direction 2').replace('> —', '> If done, it will work. Because it is so.').replace('- [ ] —', '- [ ] it works').replace('Lessons consulted: —', 'Lessons consulted: None').replace('Discard check: —', 'Discard check: None') + '\n');
    expect('20m2 continuing attempt #2 outside the path makes the discarded row on its chain path a candidate (not the row branching from #3)', nx('brief'), '[Discard check candidates] 1 (Branch point ∈ Path ∪ Attempt #2 ChainPath #0 → #1 → #2)', '1 branch discard', '!3 branch discard');
    expect('20m3 I-15 uses the same set (no discard check → ❌)', nx('check'), 'I-15  ❌', 'Discard check = "None"');
    fs.writeFileSync(SX, fs.readFileSync(SX, 'utf8').replace('## Round 1 · Attempt #2 continued', '## Round 1 · Attempt #4'));
    expect('20m4 a new attempt with no row has no chain path, so the ★ path only', nx('brief') + '\n' + nx('check'), '[Discard check candidates] 0 (Branch point ∈ Path)', 'I-15  skipped');
    fs.unlinkSync(SX); fs.writeFileSync(TX, k); }
  // I-16: a missing attempt summary row is identified by the # value
  { const k = rt(); nx('snapshot');
    et('| #2 | #1 | direction 2 | Failure | Continue |', '| #2 | #1 | direction 2 | Partial | Pivot |');
    expect('20n wrap row whose result·conclusion was edited is not a missing row', nx('check'), '!I-16  ❌', 'I-16  skipped  no migrated rows');
    et(R1 + '\n', '');
    expect('20n2 a row vanished from the tree but is not in the archive → ❌', nx('check'), 'I-16  ❌', 'a row missing from the tree is not in an archive: "#1 | #0 | direction 1');
    fs.writeFileSync(path.join(X, 'archive/tree_' + TODAY.slice(0, 7) + '.md'), '---\nattempts: [1]\nlast_updated: ' + TODAY + '\n---\n\n## Migrated Attempt Summaries\n\n| # | Branch point | Direction | Result | Conclusion | Lesson | Body |\n|---|---|---|---|---|---|---|\n' + R1 + '\n');
    expect('20n3 passes when a row with the same # is in the archive', nx('check'), 'I-16  ✅', 'moved this time 1 rows');
    fs.unlinkSync(path.join(X, 'archive/tree_' + TODAY.slice(0, 7) + '.md')); fs.writeFileSync(TX, k); }
  has('20i conventions: pre-write condition and when it is tested · onpath output definition · check node set · I-16', nav('anchor', 'current-position-update') + nav('anchor', 'check-execution') + nav('anchor', 'invariant-table-T2') + nav('anchor', 'invariant-table-T3'), 'Pre-write condition: when returned = the return point is a node of the existing path', 'is P, or B is a node of the existing path, or the chain path of B is not `None`', 'Otherwise the chain path of B with P appended', 'the path is written from its chain path, that span comes back into the path', 'At the step that receives whether a return happened, `/pdca-wrap` tests the pre-write condition', 'If false, it writes nothing and asks again whether a return happened', '!stops writing and', '| `onpath {Attempt PK}` | 5 lines: `Path:` · `EndNode:` · `Contains:` · `RowBranchPoint:` · `ChainPath:` |', '`onpath` output:', 'Check node set = ★ `Path` nodes ∪ the chain path nodes of the attempt of the target open round', '`Branch point` is in the check node set', 'for attempt summaries, a snapshot row whose `#` value is not in the tree');
  has('20j wrap 3-2: decided with onpath where it is received', src('.claude/skills/pdca-wrap/SKILL.md'), '`node .claude/hooks/nav.js onpath {return point}`. When the `Contains:` value of the output is `No`, show the `Path:` line and the `Contains:` line and ask this item 2 again', 'No → run `node .claude/hooks/nav.js onpath {P}`. When the `EndNode:` value of the output is P, no further value is received', '`No` and the `ChainPath:` value is not `None` → show `[wrap notice] branch point {B} of attempt {P} is not in the path — ★ path rebuilt as {ChainPath value} → {P}`', '`No` and the `ChainPath:` value is `None` → show the `Path:` line and `[wrap notice] branch point {B} of attempt {P} is not in the path and there is no chain path — the ★ path cannot be written without a return`, and ask this item 2 again');
  fs.rmSync(X, { recursive: true, force: true });
}

// 21. nav.js full-line review cases N1~N10 · N18 (separately made folders, made anew per case)
{
  const mkX = () => { const X = T + '_21'; fs.rmSync(X, { recursive: true, force: true }); fs.mkdirSync(X, { recursive: true });
    for (const f of ['.claude', '01_exploration_tree.md', '02_knowledge_base.md', 'NOTATION_CONVENTIONS']) fs.cpSync(path.join(SRC, f), path.join(X, f), { recursive: true });
    for (const dd of ['locks', 'knowledge', 'sessions', 'archive']) fs.mkdirSync(path.join(X, dd), { recursive: true });
    const nx = (...a) => { try { return cp.execFileSync('node', [path.join(X, '.claude/hooks/nav.js'), ...a], { cwd: X, env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: X }), stdio: ['ignore', 'pipe', 'pipe'] }).toString().trimEnd(); } catch (e) { return (e.stdout || '').toString().trimEnd() + ' [exit ' + e.status + ']'; } };
    const w = (f, s) => fs.writeFileSync(path.join(X, f), s); const r = f => fs.readFileSync(path.join(X, f), 'utf8').replace(/\r\n/g, '\n');
    const e = (f, a, b) => { const s = r(f); if (!s.includes(a)) throw new Error('nothing to edit: ' + a); w(f, s.replace(a, () => b)); };
    return { X, nx, w, r, e }; };
  const TR = '01_exploration_tree.md', SUM0 = '| — | — | — | — | — | — | — |';
  const planned = h => skel(h).replace('Cycle goal: —', 'Cycle goal: A').replace('> —', '> If done, it will work. Because it is so.').replace('- [ ] —', '- [ ] it works').replace('Lessons consulted: —', 'Lessons consulted: None').replace('Discard check: —', 'Discard check: None');
  const closedP = h => planned(h).replace('Success criteria met:\n- [ ] —', 'Success criteria met:\n- [ ] it works: X — not yet').replace('Distance to destination: —', 'Distance to destination: Same — as it was').replace('Conclusion: —', 'Conclusion: Continue');
  { const { nx, w } = mkX();   // N1
    w('sessions/2020-01-01.md', prefix.replace(TODAY, '2020-01-01') + planned('## Round 1 · Attempt #5') + '\n'); w(S, prefix + closedP('## Round 1 · Attempt #1') + '\n');
    expect('21a N1 even when the open round is only in an old file, the target of status = the attempt of the first OpenRound line of route', nx('route') + '\n' + nx('status'), 'LatestSessionPath: ' + S, 'OpenRound: Round 1 · Attempt #5 · sessions/2020-01-01.md', '[Status] To Do (Attempt #5 · open Round 1)'); }
  { const { nx, w } = mkX();   // N2
    w(S, prefix + planned('## Round 5 · Attempt #1') + '\n---\n\n' + planned('## Round 2 · Attempt #2') + '\n');
    expect('21b N2 round numbers get smaller downward → I-04 ❌', nx('check'), 'I-04  ❌', 'round number order = "5, 2" (expected: growing from top to bottom (no equal numbers))');
    w(S, prefix + closedP('## Round 2 · Attempt #1') + '\n---\n\n' + planned('## Round 2 · Attempt #2') + '\n');
    expect('21b2 N2 two equal round numbers → I-04 ❌', nx('check'), 'I-04  ❌', 'round number order = "2, 2"');
    w(S, prefix + closedP('## Round 1 · Attempt #1') + '\n---\n\n' + planned('## Round 9 · Attempt #2') + '\n');
    expect('21b3 N2 skipped numbers (1, 9) pass', nx('check'), 'I-04  ✅'); }
  { const { nx, e } = mkX();   // N3
    e(TR, '| Lesson |', '| lessons |'); e(TR, SUM0, '| #1 | #0 | direction | Failure | Continue | None | ' + S + ' |');
    const o = nx('check'); expect('21c N3 an exception during a check is ❌ and goes in the IsolationSet', o + '\n' + (/IsolationSet: .*I-04/.test(o) ? 'isolation included' : 'no isolation'), 'I-04  ❌  error during check: ', 'expected: the check runs to the end', 'isolation included', '!⚠  error during check'); }
  { const { nx, w } = mkX();   // N4
    w(S, prefix + closedP('## Round 1 · Attempt #1') + '\n'); w('sessions/2099-01-01.md', prefix.replace(TODAY, '2099-01-01') + closedP('## Round 1 · Attempt #2') + '\n');
    expect('21d N4 a session file dated later than today → I-04 ❌ (start 1-3 blocks before routing)', nx('check'), 'I-04  ❌', 'sessions/2099-01-01.md file date = "2099-01-01" (expected: Today(' + TODAY + ') or below)'); }
  { const { nx, w } = mkX();   // N5
    w(S, prefix + planned('## Round 1 · Attempt #1').replace('### ACT\n', '### ACT\n#### memo\n') + '\n');
    expect('21e N5 DO a #### line outside the section is not a DO entry (state and brief give the same count)', nx('state', '#1') + '\n' + nx('brief'), 'Status: To Do', '  DO: 0'); }
  { const { nx } = mkX();   // N6
    expect('21f N6 unknown commands and arguments give [nav.js error]', [nx('foo'), nx('anchor'), nx('check', '--c4'), nx('dest', '--creat'), nx()].join('\n'), '[nav.js error] unknown command "foo" — Usage: check [--c3]', '[nav.js error] anchor argument missing', '[nav.js error] check argument "--c4" is unknown', '[nav.js error] dest argument "--creat" is unknown', '[nav.js error] unknown command "undefined"', '[exit 1]', '![exit 2]', '![Invariant check]', '!DestinationFile');
    expect('21f2 N6 known arguments work as before', nx('check', '--c3').split('\n')[0] + '\n' + nx('dest'), '[Invariant check · C3]', 'DestinationFile: None'); }
  { const { X, nx } = mkX();   // N7
    fs.unlinkSync(path.join(X, TR)); const o = ['check', 'status', 'brief', 'route', 'snapshot', 'onpath #1'].map(c => nx(...c.split(' '))).join('\n');
    expect('21g N7 01 missing: every command that reads that file gives the same wording', o + '\ncount=' + (o.split('[nav.js error] 01_exploration_tree.md not found').length - 1), 'count=6', '!Cannot read'); }
  { const { nx, w } = mkX();   // N8
    w('archive/tree_2026-10.md', '---\nattempts: []\nlast_updated: 2026-10-01\n---\n\n## Migrated Attempt Summaries\n\n| # | Branch point | Direction | Result | Conclusion | Lesson | Body |\n|---|---|---|---|---|---|---|\n| abc | #0 | direction | Failure | Continue | None | sessions/2026-10-01.md |\n');
    expect('21h N8 an archive # with a broken format is left out of the number computation', nx('route') + '\n' + nx('check'), 'NextAttemptNumber: #1', '!#NaN', 'I-04  ❌', 'Migrated Attempt Summaries row 1 # = "abc"'); }
  { const { nx, w } = mkX();   // N9
    w('locks/other.lock', 'Session: ' + TODAY + '\n');
    expect('21i N9 invalidation.lock — a .lock that is not it → recover stops', nx('recover'), '[nav.js error] locks/other.lock — the only invalidation marker name is locks/invalidation.lock', '[exit 1]');
    w('locks/invalidation.lock', 'Session: ' + TODAY + '\n'); fs.unlinkSync(path.join(T + '_21', 'locks/other.lock'));
    expect('21i2 N9 invalidation.lock is read as before', nx('recover'), 'Marker: locks/invalidation.lock', 'Incomplete: None');
    w('locks/invalidation.lock', 'Session: ' + TODAY + '\nInvalidation target:\n  #K3 — reason\n');
    expect('21i3 a line of the marker that does not fit the format → recover does not skip it and stops', nx('recover'), '[nav.js error] locks/invalidation.lock — lines that do not fit the format 1: "#K3 — reason"', '[exit 1]', '!Incomplete:');
    w('locks/invalidation.lock', 'Session: ' + TODAY + '\nInvalidation target:\n  #K001 — reason\n');
    expect('21i4 a well-formed marker is read as before', nx('recover'), 'Target: #K001 — reason', 'Incomplete: #K001', '![nav.js error]'); }
  { const { nx, e } = mkX();   // N10
    e(TR, SUM0, '| #1 | #0 | A | B compare | Failure | Continue | None | ' + S + ' |');
    expect('21j N10 a | in a cell value → caught as a cell count mismatch', nx('check'), 'I-04  ❌', 'Attempt summary row 1 cell count = "8" (expected: 7 cells (| is not used in a cell value))'); }
  { const { X, nx, w, e } = mkX();   // N18
    const ROW = '| #1 | #0 | direction 1 | Failure | Pivot | None | ' + S + ' |', AF = 'archive/tree_' + TODAY.slice(0, 7) + '.md';
    const arch = (att, rows) => '---\nattempts: ' + att + '\nlast_updated: ' + TODAY + '\n---\n\n## Migrated Attempt Summaries\n\n| # | Branch point | Direction | Result | Conclusion | Lesson | Body |\n|---|---|---|---|---|---|---|\n' + rows + '\n';
    w(AF, arch('[1]', ROW)); e(TR, 'archived_through: None', 'archived_through: ' + TODAY.slice(0, 7));
    expect('21k N18 an attempt only in the archive: RowBranchPoint is not None (the second branch of 7-1)', nx('onpath', '#1') + '\n' + String(/^\| #1 \|/m.test(fs.readFileSync(path.join(X, TR), 'utf8'))), 'RowBranchPoint: #0', 'false');
    e(TR, SUM0, ROW.replace('Pivot', 'Continue'));
    expect('21k2 N18 adding to the tree while leaving the archive row (the old 7-1) gives I-16 ❌ · onpath error', nx('check') + '\n' + nx('onpath', '#1'), 'I-16  ❌', 'Attempt #1 is in both the tree and an archive', '[nav.js error] Attempt #1 row count 2');
    w(AF, arch('[]', '| — | — | — | — | — | — | — |')); e(TR, 'archived_through: ' + TODAY.slice(0, 7), 'archived_through: None');
    const o = nx('check'); expect('21k3 N18 reverting (archive row deleted · removed from attempts · archived_through recomputed) → no I-16·I-17 violation · 1 row', o + '\n' + nx('onpath', '#1'), '!I-16  ❌', '!I-17  ❌', 'RowBranchPoint: #0', '![nav.js error]'); }
  has('21l conventions: the sentences of N1·N2·N3·N4·N5·N10·N18', nav('anchor', 'check-execution') + nav('anchor', 'invariant-table-T1') + nav('anchor', 'status-determination') + nav('anchor', 'archive-file-structure'), 'Target attempt = when there is an open round, in `route` the first `OpenRound` line attempt', '!when the latest session file has an open round', 'An item whose check raised a script exception is `❌`', 'a command not in the table · a `check` or `dest` argument not in the table', 'cell count = the cell count of the header row', 'the date of the file name ≤ today, and the round numbers grow from top to bottom', 'lines starting with `#### ` between the `### DO` line and the `### CHECK` line', 'Reverting: when an attempt whose row is only in this file is resumed and closed again', 'One attempt has 1 row across the tree and the archives');
  has('21m wrap 7-1·8: P the three places of a row and after reverting archived_through', src('.claude/skills/pdca-wrap/SKILL.md'), 'The place of the P row is decided from the `RowBranchPoint:` value of the `node .claude/hooks/nav.js onpath {P}` output and Recent Attempts of the tree', 'Not in Recent Attempts and the `RowBranchPoint:` value is not `None` (the row is in an archive) → erase that row of the archive', 'Not in Recent Attempts and the `RowBranchPoint:` value is `None` → add at the very bottom', 'rows were moved, or an archive row was reverted in 7-1', '(`None` when no archive file has data rows)');
  fs.rmSync(T + '_21', { recursive: true, force: true });
}

// 22. 42section inner 2 — counts·lists·regexes·path forms as constants (new folder · the template as it is)
{
  const X = T + '_22'; fs.rmSync(X, { recursive: true, force: true }); fs.mkdirSync(X, { recursive: true });
  for (const f of ['.claude', '01_exploration_tree.md', '02_knowledge_base.md', 'NOTATION_CONVENTIONS']) fs.cpSync(path.join(SRC, f), path.join(X, f), { recursive: true });
  const xp = f => path.join(X, f), xe = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: X });
  const run = (file, ...a) => { try { return cp.execFileSync('node', [xp('.claude/hooks/' + file), ...a], { cwd: X, env: xe, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trimEnd(); } catch (e) { return (e.stdout || '').toString().trimEnd() + (e.stderr || '').toString().trimEnd() + ' [exit ' + e.status + ']'; } };
  const xr = f => fs.readFileSync(xp(f), 'utf8'), xw = (f, t) => fs.writeFileSync(xp(f), t);
  const swap = (f, a, b, fn) => { const o = xr(f); if (!o.includes(a)) throw new Error('nothing to edit: ' + a); xw(f, o.replace(a, () => b)); try { return fn(); } finally { xw(f, o); } };
  const K = JSON.parse(xr('.claude/hooks/format-constants.json')), NAV = xr('.claude/hooks/nav.js');
  expect('22a alert thresholds·invariant list·C3 list are in the constants', JSON.stringify(K.alert) + JSON.stringify(K.check.c3) + K.check.all.length, '"treeLines":150', '"pathNodes":8', '"lessons":40', '["I-01","I-07","I-08","I-09"]', ']23');
  expect('22a2 nav.js has no list·threshold·path·label literal', String(NAV.includes("const ALL = [")) + String(NAV.includes('alert thresholds 150')) + String(NAV.includes("'knowledge/'")) + String(NAV.includes('/^tree_')) + String(NAV.includes("'Related attempts'")) + String(NAV.includes('/^Session:/')), 'falsefalsefalsefalsefalsefalse');
  expect('22b the value order of the vocabularies is fixed', JSON.stringify(K.vocab), '"Result":["Success","Failure","Partial"]', '"Conclusion":["Continue","Pivot","Discarded"]', '"Status":["To Do","In Progress","Blocked","On Hold","Done","Canceled"]', '"Distance to destination":["Closer","Same","Farther"]', '"Validity":["Valid","Invalid"]');
  expect('22c path derivation·lesson file labels·criterion kinds·marker format are in the constants', JSON.stringify(K.path) + JSON.stringify(K.kfile) + JSON.stringify(K.dest.kinds) + K.lock.sessionLabel + K.regex.lockTarget, '"Lesson":{"prefix":"knowledge/","suffix":".md"}', '"Archive":{"prefix":"archive/tree_","suffix":".md"}', '"found":"Discovered"', '["Quantitative","Qualitative"]', 'Session:^#K[0-9]{3} — .+$');
  expect('22d a ## line that merely contains the name is not counted as the ★ section (convention format 1)', (() => { const o = xr('01_exploration_tree.md'); xw('01_exploration_tree.md', o + '\n## Appendix — how to read ★ Current Position\n'); try { return run('nav.js', 'check'); } finally { xw('01_exploration_tree.md', o); } })(), 'I-01  ✅  ★ sections 1 / 6 lines');
  expect('22e the Discarded Directions table header row differs from the conventions → I-04 ❌', swap('01_exploration_tree.md', '| # | Branch point | Direction | Discard reason | Date | Retry condition |', '| # | Branch point | Direction | Discard cause | Date | Retry condition |', () => run('nav.js', 'check')), 'I-04  ❌', 'Discarded Directions header row');
  expect('22e2 the attempt summary table header row differs from the conventions → I-04 ❌', swap('01_exploration_tree.md', '| # | Branch point | Direction | Result | Conclusion | Lesson | Body |', '| # | Branch point | Direction | Result | Conclusion | Lesson | Session |', () => run('nav.js', 'check')), 'I-04  ❌', 'Attempt summary header row');
  expect('22f an item in the invariant tables of the conventions that nav.js lacks → [nav.js error]', swap('NOTATION_CONVENTIONS', '| I-23 | Open rounds', '| I-24 | Open rounds', () => { run('gen-format-constants.js', '--write'); return run('nav.js', 'check'); }), '[nav.js error] invariant list mismatch', 'I-24');
  expect('22g the alert thresholds follow the numbers of the conventions', swap('NOTATION_CONVENTIONS', '`01_exploration_tree.md line count` > 150', '`01_exploration_tree.md line count` > 5', () => { run('gen-format-constants.js', '--write'); return run('nav.js', 'check'); }), '[Notice] 01_exploration_tree.md', '(threshold 5)');
  expect('22g2 the generator stops when there are not 3 alert thresholds', swap('NOTATION_CONVENTIONS', ' · `lesson list row count` > 40', '', () => run('gen-format-constants.js', '--emit')), 'parseCheckRun: alert thresholds 2');
  expect('22h normal once reverted', run('gen-format-constants.js', '--write') + run('gen-format-constants.js', '--check') + run('nav.js', 'check', '--c3'), 'IsolationSet: None', '![exit');
  fs.rmSync(X, { recursive: true, force: true });
}

// 6. error path
wr('.claude/hooks/format-constants.json', rd('.claude/hooks/format-constants.json').replace('"Pivot"', '"Change direction"'));
expect('6a stale check', nav('check'), '[nav.js error] STALE', '[exit 1]');
expect('6b stale hook', hook(), '[Integrity] ⚠ format constants stale', 'MarkerLeft=false');
fs.unlinkSync(P('.claude/hooks/format-constants.json'));
expect('6c hook without constants', hook(), '[Integrity] ⚠ format constants stale');
expect('6d anchor a key that does not exist', nav('anchor', 'nokey'), '[nav.js error]', 'resolution failed');
// (order: 7 → 6. 6 breaks the format constants file, so it goes last)
console.log('\nTotal: PASS ' + pass + ' / FAIL ' + fail);
