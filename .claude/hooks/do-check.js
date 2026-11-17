#!/usr/bin/env node
/*
 * do-check.js — DO record hook (Stop)
 * Contract → NOTATION_CONVENTIONS: grep -F "anchor:do-record-hook-rules"
 *   · Test: goes through rows 1~6 of the test table of the rules from the top
 *   · The open rounds and tool name lists come from nav.js (not written again here)
 *   · Output: pass = nothing / block = decision block / value could not be read = one systemMessage line (does not block)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const emit = o => process.stdout.write(JSON.stringify(o));
const cannot = why => emit({ systemMessage: '[DO record] ⚠ could not check — ' + why });
const samePath = (a, b) => path.resolve(ROOT, a).replace(/\\/g, '/').toLowerCase() === path.resolve(ROOT, b).replace(/\\/g, '/').toLowerCase();
const blocks = o => (o && o.message && Array.isArray(o.message.content)) ? o.message.content : [];
const text = o => { const c = o && o.message ? o.message.content : ''; return typeof c === 'string' ? c : blocks(o).map(b => (typeof b.text === 'string' ? b.text : '')).join('\n'); };

function main() {
  let inp;
  try { inp = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { return cannot('could not read the input JSON'); }
  if (inp.stop_hook_active) return;                                                   // 1
  let open, tools;
  try { const nav = require('./nav.js'); open = nav.openCycleList(); tools = nav.hookTools(); } catch (e) { return cannot('could not look up the open rounds: ' + e.message); }
  if (!open.length) return;                                                           // 2
  const target = open[0];
  let rows;
  try { rows = fs.readFileSync(inp.transcript_path, 'utf8').split('\n').filter(l => l.trim() !== '').map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); }
  catch (e) { return cannot('could not read the transcript file'); }
  const isPrompt = o => o.type === 'user' && !o.isSidechain && !o.isMeta && !blocks(o).some(b => b.type === 'tool_result');
  let start = -1;
  for (let i = rows.length - 1; i >= 0; i--) if (isPrompt(rows[i])) { start = i; break; }
  if (start < 0) return cannot('the transcript file has no user input line');
  const turn = rows.slice(start).filter(o => !o.isSidechain);
  const uses = []; turn.forEach(o => { if (o.type === 'assistant') blocks(o).forEach(b => { if (b.type === 'tool_use') uses.push(b); }); });
  const inp2 = u => u.input || {};
  if (turn.some(o => o.type === 'user' && text(o).includes('<command-name>/pdca-')) ||
      uses.some(u => u.name === 'Skill' && String(inp2(u).skill || '').startsWith('pdca-'))) return;   // 3
  const toSession = u => tools.write.includes(u.name) && typeof (inp2(u).file_path || inp2(u).notebook_path) === 'string' && samePath(inp2(u).file_path || inp2(u).notebook_path, target.file);
  const isNav = u => tools.run.includes(u.name) && String(inp2(u).command || '').includes('nav.js');
  const acts = uses.filter(u => (tools.write.includes(u.name) || tools.run.includes(u.name)) && !toSession(u) && !isNav(u));
  if (!acts.length) return;                                                           // 4
  if (uses.some(toSession)) return;                                                   // 5
  emit({ decision: 'block', reason: '[DO record] no DO entry for ' + acts.length + ' actions — run `node .claude/hooks/nav.js route`, write 1 DO entry at the very end of the `### DO` section of ' + target.file + ' Round ' + target.n + ', then end the response. Format: `node .claude/hooks/nav.js anchor session-file-writing`' });   // 6
}
try { main(); } catch (e) { cannot('run failed: ' + e.message); }
process.exit(0);
