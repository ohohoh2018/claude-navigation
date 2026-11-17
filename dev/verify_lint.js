const fs = require('fs'), path = require('path');
const root = process.argv[2];
const files = ['NOTATION_CONVENTIONS', '.claude/agents/nav-scout.md', '.claude/skills/pdca-init/SKILL.md', '.claude/skills/pdca-start/SKILL.md', '.claude/skills/pdca-status/SKILL.md', '.claude/skills/pdca-wrap/SKILL.md', '01_exploration_tree.md', '02_knowledge_base.md', 'CLAUDE.md', 'README.md', '.claude/hooks/nav.js', '.claude/hooks/integrity-check.js', '.claude/hooks/do-check.js', '.claude/hooks/gen-format-constants.js'];
const txt = {}; for (const f of files) txt[f] = fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const spec = txt['NOTATION_CONVENTIONS'].split('\n');
const op = {}, cl = {};
spec.forEach((l, i) => { let m; if ((m = l.match(/^<!-- anchor:(.+) -->$/))) (op[m[1]] = op[m[1]] || []).push(i); if ((m = l.match(/^<!-- anchor-end:(.+) -->$/))) (cl[m[1]] = cl[m[1]] || []).push(i); });
let bad = 0; const B = s => { bad++; console.log('❗ ' + s); };
// anchor
for (const k of new Set([...Object.keys(op), ...Object.keys(cl)])) {
  const o = op[k] || [], c = cl[k] || [];
  if (o.length !== 1 || c.length !== 1 || o[0] > c[0] || !/^[A-Za-z0-9._-]+$/.test(k)) B('anchor ' + k + ' open ' + o.length + ' close ' + c.length);
  else { // table target: when the line after the open is a table header, the close comes right after the table
    const s = o[0] + 1;
    if (/^\|.*\|$/.test(spec[s]) && /^\|[-| :]+\|$/.test(spec[s + 1] || '')) { let j = s; while (/^\|/.test(spec[j] || '')) j++; if (j !== c[0]) B('table-target anchor ' + k + ' close position'); }
  }
}
// content outside anchors (other than titles·dividers·the preamble)
let inside = 0; const outside = [];
spec.forEach((l, i) => { if (/^<!-- anchor:/.test(l)) inside++; else if (/^<!-- anchor-end:/.test(l)) inside--; else if (!inside && l.trim() && !/^(#|---|>)/.test(l)) outside.push(i + 1); });
if (outside.length) B('body lines outside anchors: ' + outside.join(','));
// pointers
const used = new Set();
for (const f of files) {
  const labels = {};
  txt[f].split('\n').forEach((l, i) => {
    const re = /grep -F "anchor:([^"]*)"( \(([^)]*)\))?/g; let m;
    while ((m = re.exec(l))) {
      if (m[1].includes('{')) continue;
      used.add(m[1]);
      const before = l.slice(0, m.index);
      if (/\.js$/.test(f)) { if (!op[m[1]]) B(f + ':' + (i + 1) + ' unresolved ' + m[1]); continue; }
      const lab = (before.match(/([^·>(.]*) → $/) || [])[1];
      if (!op[m[1]]) B(f + ':' + (i + 1) + ' unresolved ' + m[1]);
      if (m[3] !== 'NOTATION_CONVENTIONS') B(f + ':' + (i + 1) + ' file name ' + m[3]);
      if (lab === undefined) B(f + ':' + (i + 1) + ' no arrow: …' + before.slice(-30));
      else { const key = lab.trim(); if (labels[key] && labels[key] !== m[1]) B(f + ':' + (i + 1) + ' label "' + key + '" → ' + labels[key] + ' / ' + m[1]); labels[key] = m[1]; }
    }
  });
}
console.log('anchor count', Object.keys(op).length, '| anchors not used by a pointer:', Object.keys(op).filter(k => !used.has(k)).join(', ') || 'None');
// forbidden notation
const md = files.filter(f => !/\.js$/.test(f));
const scan = (name, re) => { for (const f of md) txt[f].split('\n').forEach((l, i) => { const m = l.match(re); if (m) B(name + ' ' + f + ':' + (i + 1) + ' ' + m[0]); }); };
scan('§', /§\S+/);
scan('vague word', /appropriately|suitably|as needed|if needed|if necessary|if possible|preferably|roughly|more or less|depending on the situation|case by case/);
scan('etc', /(^|\s)etc($|[\s,.)])/);
scan('prose reference', /above [^()→\n]{0,30}anchor|"[0-9]+([.-][0-9]+)*\..*"/);
scan('build label', /Confirmed [A-Z]|OQ-[0-9]+|Stage [0-9]+(\.[0-9]+)?[^)]|Procedure [A-Z]|Decision [0-9]+|Problem [0-9]+|P4-C|Layer [01]|Judgment [AB]|design principle|handover/);
scan('old structure', /grep-executor-set|event-set|recovery-set|periodic-set|Glob\(/);
for (const f of files) console.log(String(txt[f].split('\n').length - 1).padStart(5), f);
console.log(bad ? 'problems ' + bad + '' : '0 problems');
