---
name: pdca-start
description: Starts a PDCA exploration session. With nav.js it checks the destination, recovers an invalidation, routes the cycle and rechecks ★/path, gives the session briefing, and then writes the PLAN.
---

# /pdca-start — start a session (v2)

The main session only coordinates and writes. Index values and verdicts follow the output of `node .claude/hooks/nav.js` as it is and are not recomputed. Commands and output formats → grep -F "anchor:check-execution" (NOTATION_CONVENTIONS). How to resolve a pointer → grep -F "anchor:execution-delegation" (NOTATION_CONVENTIONS).

When the output starts with `[nav.js error]`, stop at that step and show that line to the user.

Order of execution: **0 check the destination → 1 recovery → 2 routing → 3 recheck → 4 briefing → 5 write the PLAN**.

## 0. Check the destination

1. Run `node .claude/hooks/nav.js dest`.
2. Branch on the `DestinationStatus` value:
   - `Written` → go to 1.
   - Otherwise → show the `DestinationStatus:` line and the I-21 and I-22 lines of the output, print `[Start aborted] destination {DestinationStatus value} — run /pdca-init first`, and end.

## 1. Recovery

1. Run `node .claude/hooks/nav.js recover`.
2. Branch on the last line of the output:
   - `Marker: None` → go to step 3.
   - `Incomplete: None` → delete `locks/invalidation.lock` and go to step 3.
   - `Incomplete: {list}` → one-tap confirmation "The invalidation of the previous session was interrupted: {list} — shall I finish applying it?".
     - Approved → using all `Target:` lines of the output with their lessons and reasons as they are, run 2~5 of the invalidation write order and go to step 3. Invalidation write order → grep -F "anchor:invalidation-write-order" (NOTATION_CONVENTIONS). When the Return Log has no row whose `Body` date equals the `Session:` value of the output, ask the user for the blocked point, the return point and the reason, and write that row.
     - Rejected → leave the marker as it is, print `[Recovery deferred] {list}`, and go to step 3.
3. Run `node .claude/hooks/nav.js check` and show the output block as it is (the full check of the state the last session left).
   - `IsolationSet: None` → go to 2.
   - Otherwise → from the value read and the expected value of each IsolationSet item, show a fix, and one-tap confirmation "Violations {IsolationSet} — shall I fix them?":
     - Approved → write the fix and run this step 3 again.
     - Rejected → print `[Start aborted] violations unresolved: {IsolationSet}` and end.

## 2. Routing

1. Run `node .claude/hooks/nav.js route`.
2. Branch on the `OpenRoundCount` value:
   - `0` → go to step 3 (new round).
   - `1` → continue that round without asking. This cycle = the session file path and round of that `OpenRound` line. Do not make a new file or round. Print `[Resuming] {the value of that OpenRound line}`, mark it as **resuming**, and go to 「3. Recheck」.
   - `2` or more → show all `OpenRound` lines in output order and the user picks one. Proceed with the picked line as for `1` (a state with two or more open rounds is an I-23 violation and was already shown in 1-3).
   - There is no option of starting a new cycle while leaving an open cycle. To stop or put off that cycle, end the cycle in `/pdca-wrap` and give `Discarded` or `Pivot` as the conclusion.
3. Write a new round:
   1. Decide the attempt number P. When `ResumableAttempts: None`, P = `NextAttemptNumber`. Otherwise one-tap confirmation "Continue an existing attempt / a new direction?":
      - Continue existing → show the `ResumableAttempts` line as it is and the user picks one item in it. P = the attempt number before the parentheses of the picked item. Add ` continued` at the end of the header. Run `node .claude/hooks/nav.js last {P}` and show the output as it is (it is the content of the last round of this attempt and the basis when writing the PLAN in 5. PLAN values are not copied from this output; they are set anew with the user in 5).
      - New direction → P = `NextAttemptNumber`. Do not add ` continued`.
   2. Round number N = `NextRound`.
   3. Decide the file. `TodayFileExists: No` → make `sessions/{Today}.md` anew with the prefix. `TodayFileExists: Yes` → append at the end of the `LatestSessionPath` file (do not edit the existing content).
   4. Write the round skeleton with the header substituted as `## Round {N} · Attempt {P}` (followed by ` continued` when continuing). Prefix, skeleton and divider → grep -F "anchor:session-file-writing" (NOTATION_CONVENTIONS).
   5. Go to 「3. Recheck」.

## 3. Recheck

1. Run `node .claude/hooks/nav.js check --c3` and show the output block as it is.
2. `IsolationSet: None` → go to 「4. Briefing」.
3. Otherwise → from the value read and the expected value of each IsolationSet item, show a fix, and one-tap confirmation "★/path consistency violations {IsolationSet} — shall I fix 01_exploration_tree.md?":
   - Approved → write the fix and go back to step 1.
   - Rejected → print `[Start aborted] ★/path violations unresolved: {IsolationSet}` and end. Do not brief.

## 4. Briefing

1. Run `node .claude/hooks/nav.js brief` and show the output as it is.
2. Branch on the mark of 2-2 and the `PLAN:` value of the output:
   - **resuming** and `PLAN: Written` → print `[Start done] resuming — {the [Open cycle] line value of the output}` and end here. The PLAN is not written again. The basis of what to do next is the `[Open cycle]` block and the `[Resume point]` line of the output.
   - **resuming** and `PLAN: Unwritten` → go to step 3 (a round cut off before its PLAN was written). N and P = the round and attempt number of that `OpenRound` line.
   - New round (2-3) → go to step 3.
3. Settle the direction of this cycle with the user (a person decides).
4. When `[Discard check candidates]` is `0`, `Discard check:` value = `None`. With 1 or more, for each candidate the user judges "Is the settled direction the same direction as this discarded direction?":
   - All "no" → the basis of that judgment is the `Discard check:` value.
   - Even one "same" → when the user confirms the basis that the `Retry condition` of that candidate is met, that basis is the `Discard check:` value; when not confirmed, go back to step 3.

## 5. Write the PLAN

1. In the block of this round, replace the `—` of the five slots below with values. Value formats → grep -F "anchor:session-file-writing" (NOTATION_CONVENTIONS).
   - `Cycle goal:` = the settled direction.
   - `Hypothesis:`
   - `Success criteria (this cycle):` (1 or more lines)
   - `Lessons consulted:` = the numbers among `[Valid lessons]` of the briefing that the user picked as applying to this direction. `None` when nothing is picked.
   - `Discard check:` = the value set in 4-4.
2. Do not touch `### DO` · `### CHECK` · `### ACT`.
3. Print `[Start done] Round {N} · Attempt {P}` and end.
