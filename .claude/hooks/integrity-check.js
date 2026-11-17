#!/usr/bin/env node
/*
 * integrity-check.js — integrity check hook (PostToolUse Write)
 * Contract → NOTATION_CONVENTIONS: grep -F "anchor:integrity-hook-rules"
 *   · Gate: checks only when locks/integrity-check.pending exists, and deletes the marker after the check
 *   · Test: calls the same function as check of nav.js (the check logic is not copied here)
 *   · Output: one systemMessage line. 4 states = pass / violation / stale / error
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const MARKER = path.join(ROOT, 'locks', 'integrity-check.pending');
const emit = msg => process.stdout.write(JSON.stringify({ systemMessage: msg }));

if (fs.existsSync(MARKER)) {
  try {
    const nav = require('./nav.js');
    const { res } = nav.runCheck(nav.ALL);
    const bad = res.filter(x => x.v === nav.BAD).map(x => x.id);
    const unk = res.filter(x => x.v === nav.UNK).length;
    if (bad.length) emit('[Integrity] ❌ ' + bad.join(', '));
    else emit('[Integrity] ✅ 0 violations' + (unk ? ' (undetermined ' + unk + ')' : ''));
  } catch (e) {
    if (/^STALE: /.test(e.message)) emit('[Integrity] ⚠ format constants stale — regenerate with node .claude/hooks/gen-format-constants.js --write');
    else emit('[Integrity] ⚠ check failed — ' + e.message);
  } finally {
    if (fs.existsSync(MARKER)) fs.unlinkSync(MARKER);
  }
}
process.exit(0);
