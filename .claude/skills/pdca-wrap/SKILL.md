---
name: pdca-wrap
description: Run when ending a session. Ending the cycle does CHECK→ACT, the tree and index writes and the checks; ending only the session writes a pause memo and leaves the cycle open.
---

# /pdca-wrap — wrap up a session (write family · v2)

When ending a session, run this command whether or not the cycle is finished. Ending the cycle and ending only the session split at 1-5. wrap is the only writer of the tree, the index and the lessons. Index values and verdicts follow the output of `node .claude/hooks/nav.js` as it is and are not recomputed. Commands and output formats → grep -F "anchor:check-execution" (NOTATION_CONVENTIONS). How to resolve a pointer → grep -F "anchor:execution-delegation" (NOTATION_CONVENTIONS).

When the output starts with `[nav.js error]`, stop at that step and show that line to the user.

Order of execution: **1 prepare → (ending the cycle: 2 CHECK → 3 ACT → 4 session log → 5 lessons → 6 return and invalidation → 7 tree → 8 migration → 9 destination checkboxes → 10 check → 11 closing | ending only the session: 12 session pause)**.

## 1. Prepare

1. Run `node .claude/hooks/nav.js route` and branch on the `OpenRoundCount` value:
   - `0` → print `[wrap aborted] no open cycle` and end.
   - `1` → that `OpenRound` line is this cycle.
   - `2` or more → show all `OpenRound` lines and the user picks one.
2. This cycle = ⟨file, round N, attempt P⟩. All three are values of the picked `OpenRound` line (file = the session file path at the end of that line).
3. Run `node .claude/hooks/nav.js brief {file of this cycle} {N}` and show the `[Open cycle]` block.
4. Gather the missing DO entries. Among the actions done in this session, pick out those not in the DO entry header list of the step 3 output and show them as DO entry drafts. With 0 drafts, show "No DO entry to add" and go to step 5. With 1 or more, confirm "Shall I write these DO entries?":
   - Change requested → edit as requested, show again, and repeat this confirmation.
   - Approved → write them at the very end of the `### DO` section and go to step 5. Date = `Today` of the step 1 output, time = `Now` of the step 1 output. DO entry format → grep -F "anchor:session-file-writing" (NOTATION_CONVENTIONS).
   - Rejected → write nothing and go to step 5.
5. Branch on the `PLAN:` value of the step 3 output:
   - `Unwritten` → without asking, print `[wrap notice] PLAN Unwritten — this round cannot be closed` and go to 12. Do not run 2~11.
   - `Written` → confirm "End this cycle / end only the session and continue the cycle?":
     - End the cycle → go to step 6.
     - End only the session → go to 12. Do not run 2~11.
6. Run `node .claude/hooks/nav.js snapshot` and go to 2.

Stopping a cycle for a while to go in another direction is "end the cycle", and the conclusion is received as `Pivot` in 3-1.

## 2. CHECK — ask the user

1. For each success criterion of the PLAN, whether it was met (O / X) and the reason.
2. The distance to the destination and the reason.
3. What differed from expectation.
4. Bottlenecks/barriers.

Write the answers of the user for all four items as they are. Claude does not decide the answers in their place or rewrite them. The answers to 1 and 2 are the computation input of `Result` and the ★ `Status`. Computation rules → grep -F "anchor:status-determination" (NOTATION_CONVENTIONS).

Value formats → grep -F "anchor:session-file-writing" (NOTATION_CONVENTIONS).

## 3. ACT — the user settles it

For each item Claude proposes on the basis of the CHECK answers and the user settles it. Nothing is written before it is settled.

1. One `Conclusion` from the conclusion vocabulary. `Result` and the ★ `Status` are not asked (the computed values are written in 7). Conclusion vocabulary → grep -F "anchor:enum-column-vocab" (NOTATION_CONVENTIONS).
2. Whether a return happens: "Does this cycle return to an earlier point?"
   - Yes → receive the return point (an attempt number inside the ★ path) and run `node .claude/hooks/nav.js state {return point}`. When the `Status:` value of the output starts with `Undetermined`, show that line and ask this item 2 again. Otherwise run `node .claude/hooks/nav.js onpath {return point}`. When the `Contains:` value of the output is `No`, show the `Path:` line and the `Contains:` line and ask this item 2 again. When `Yes`, receive why that point, and the invalidated lessons (numbers and a reason per number, `None` when there are none).
   - No → run `node .claude/hooks/nav.js onpath {P}`. When the `EndNode:` value of the output is P, no further value is received. Otherwise decide B (B = the `RowBranchPoint:` value of the output. When that value is `None`, the `Branch point` value to be written in the P row in 7-1), run `node .claude/hooks/nav.js onpath {B}` and branch on the `Contains:` value of the output:
     - `Yes` → no further value is received.
     - `No` and the `ChainPath:` value is not `None` → show `[wrap notice] branch point {B} of attempt {P} is not in the path — ★ path rebuilt as {ChainPath value} → {P}`. No further value is received.
     - `No` and the `ChainPath:` value is `None` → show the `Path:` line and `[wrap notice] branch point {B} of attempt {P} is not in the path and there is no chain path — the ★ path cannot be written without a return`, and ask this item 2 again.
   - Pre-write condition (★ update rule) → grep -F "anchor:current-position-update" (NOTATION_CONVENTIONS)
3. One line for the ★ `Direction`.
4. When the conclusion is `Discarded`, the discard reason and the retry condition.
5. Next direction candidates (direction and basis). The number is 0 or more and at most the count cap. Count cap → grep -F "anchor:01-format-position-path-attempt" (NOTATION_CONVENTIONS). When some existing candidates are to be discarded without running, the discard reason and retry condition per candidate.
6. Whether there is a new lesson. If so, the title, the summary, applies when, the content, cautions/limits.
7. Whether to update ◎: "Is this attempt closer to the destination than the current best record?" The default is no (keep).
   - Yes → receive the list of met and unmet D# with the reason prose, and what blocked it.

## 4. Session log

Fill `### CHECK` and `### ACT` of the round block of this cycle with the values of 2 and 3, and write the conclusion word on the `Conclusion:` line. The value formats follow the same block as in 2.

## 5. Lessons — only when there is a new lesson

1. Number = the greatest number of the Lesson List of `02_knowledge_base.md` + 1. `#K001` when there is no data row.
2. Make `knowledge/K###.md`. `Discovered` = P and the date of the session file of this cycle, `Related attempts` = P. Lesson file structure → grep -F "anchor:k-file-structure" (NOTATION_CONVENTIONS).
3. Add a row at the very bottom of the Lesson List of `02_knowledge_base.md` (`Validity` = `Valid`).

## 6. Return and invalidation — only when 3-2 is yes

- The invalidated lessons are `None` → write a row at the very bottom of the Return Log (Blocked at = P, Return point, Why that point, Invalidated lessons = `None`, Body = the session file path of this cycle).
- There are 1 or more invalidated lessons → one-tap confirmation "Invalidation targets {list and reasons} — shall I apply them?".
  - Approved → run 1~5 of the invalidation write order as it is. The Return Log row written in step 4 of that order is the same as the row described in the first bullet, with the target list in the `Invalidated lessons` column. Invalidation write order → grep -F "anchor:invalidation-write-order" (NOTATION_CONVENTIONS).
  - Rejected → go back to 3-2 and receive the invalidated lessons again.

## 7. Tree — `01_exploration_tree.md`

1. Recent Attempts: run `node .claude/hooks/nav.js state {P}`. When the `Result:` value or the `Status:` value starts with `Undetermined`, show that line, go back to 4 and fix the CHECK lines. Otherwise `Result` = the `Result:` value of the output, `Conclusion` = the `Conclusion:` value of the output. The place of the P row is decided from the `RowBranchPoint:` value of the `node .claude/hooks/nav.js onpath {P}` output and Recent Attempts of the tree:
   - Recent Attempts has a row whose `#` is P → edit only `Result`·`Conclusion`·`Lesson` of that row (`Lesson` = the union of the existing value and the new lesson, `Body` unchanged).
   - Not in Recent Attempts and the `RowBranchPoint:` value is not `None` (the row is in an archive) → erase that row of the archive, write the same row at the very bottom of Recent Attempts, then edit only `Result`·`Conclusion`·`Lesson`. Remove the number of P from the frontmatter `attempts` of that archive file and change `last_updated` to today. Reverting rule → grep -F "anchor:archive-file-structure" (NOTATION_CONVENTIONS)
   - Not in Recent Attempts and the `RowBranchPoint:` value is `None` → add at the very bottom (`Body` = the session file path of this cycle). `Branch point` value → grep -F "anchor:branch-point-value-rule" (NOTATION_CONVENTIONS).
2. When the conclusion is `Discarded`, add a row at the very bottom of Discarded Directions (`#` = P, `Branch point` = the branch point of the P row, `Date` = today).
3. Move the candidates set to be discarded in 3-5 to Discarded Directions, and rewrite the Next Direction Candidates lines as the candidates of 3-5. Candidate line format → grep -F "anchor:candidate-format" (NOTATION_CONVENTIONS).
4. Write all lines of the ★ Current Position code block. `Status:` = the `Status:` value of the `node .claude/hooks/nav.js state {new ★ Attempt #}` output. When that value starts with `Undetermined`, do not write ★; print that line and `[wrap aborted] ★ status Undetermined — tree write incomplete` and end (a value that passed the checks of 3-2 and 7-1 is not `Undetermined`). ★ update rule → grep -F "anchor:current-position-update" (NOTATION_CONVENTIONS).
5. When 3-7 is yes, write all lines of the ◎ Best Record code block and change the frontmatter `best_attempt` to the integer of P without `#` (when P = `#7`, `best_attempt: 7`. Write `#7` in ◎ `Closest attempt:`).
6. Change the frontmatter `last_updated` to today.

Field formats → grep -F "anchor:01-field-format-table" (NOTATION_CONVENTIONS). frontmatter notation → grep -F "anchor:frontmatter-empty-value-rule" (NOTATION_CONVENTIONS).

## 8. Migration

For each of the Return Log and Recent Attempts, when the data row count exceeds the count cap of that section, move as many rows as the excess, from the top row, to `archive/tree_YYYY-MM.md` (write them character for character in the archive, then erase them from the tree). When rows were moved, or an archive row was reverted in 7-1, change the frontmatter `archived_through` to the greatest month among the archive files that have data rows (`None` when no archive file has data rows). Archive file rules → grep -F "anchor:archive-file-structure" (NOTATION_CONVENTIONS). Count cap → grep -F "anchor:01-format-position-path-attempt" (NOTATION_CONVENTIONS).

## 9. Destination checkboxes — `00_destination.md`

1. When a row was added in 7-1 or 3-7 is yes: for each D# that is `In effect: Valid` and `[ ]`, show whether it is met and the basis, and change only the D# the user agreed to into `[x]`.
2. When 3-2 is yes or the conclusion is `Discarded`: for each D# that is `[x]`, ask "Is it still met?", and change only the D# the user said no to into `[ ]`.
3. When neither holds, skip this step.

## 10. Check

1. Make `locks/integrity-check.pending` with Write (the hook gives a one-line signal). Marker format → grep -F "anchor:integrity-hook-marker" (NOTATION_CONVENTIONS).
2. Run `node .claude/hooks/nav.js check` and show the output block as it is.
3. `IsolationSet: None` → go to 11.
4. Otherwise → from the value read and the expected value of each IsolationSet item, show a fix, and one-tap confirmation "Violations {IsolationSet} — shall I fix them?":
   - Approved → write the fix and go back to step 2.
   - Rejected → go to 11 (written as unresolved).

## 11. Closing output (labels and order fixed)

```
[Session wrap] {date of the session file of this cycle} · Round {N}
[Conclusion] Attempt {P} — {conclusion}
[Written] {paths of the files written in this wrap, joined with `, `}
[Invariants] {content of the `Result:` line of the last check output}
[Next] {number of Next Direction Candidates lines}
{all `[Notice]` lines of the last check output (no such line when there are none)}
{end line}
```

End line = `wrap done` when the IsolationSet of the last check is `None`, otherwise `wrap done ({count} violations unresolved: {IsolationSet})`.

## 12. Session pause — only when arriving at 12 from 1-5

Write only in the `### DO` section of the round block of this cycle. Do not touch `### PLAN` · `### CHECK` · `### ACT` · the `Conclusion:` line or any other file.

1. Propose the three values of the session-pause memo (Did / Remaining / Next first action). A value with nothing to write is `None`.
2. Confirm "Shall I write it this way?":
   - Change requested → edit as requested, show it again in the form of step 1, and repeat this confirmation.
   - Approved → go to step 3. Do not write before approval.
   - Rejected → print `[wrap aborted] not written — the cycle stays open` and end.
3. Write the session-pause memo at the very end of the `### DO` section. Date = `Today` of the 1-1 output, time = `Now` of the 1-1 output. Session-pause memo format → grep -F "anchor:session-file-writing" (NOTATION_CONVENTIONS).
4. Make `locks/integrity-check.pending` with Write (the same as 10-1), then run `node .claude/hooks/nav.js check` and show the output block as it is. When it is not `IsolationSet: None`, from the value read and the expected value of each IsolationSet item, show a fix, and one-tap confirmation "Violations {IsolationSet} — shall I fix them?":
   - Approved → write the fix and run this step 4 again.
   - Rejected → go to step 5 (written as unresolved).
5. Run `node .claude/hooks/nav.js brief {file of this cycle} {N}` and give the closing output (labels and order fixed):

```
[Session paused] {Today} · Round {N} · Attempt {P}
[Cycle] open — the next /pdca-start continues this round
[Written] {the session file path of this cycle}
[Resume point] {the `[Resume point]` value of the brief output}
[Invariants] {content of the `Result:` line of the last check output}
{end line}
```

End line = `pause done` when the IsolationSet of the last check is `None`, otherwise `pause done ({count} violations unresolved: {IsolationSet})`.
