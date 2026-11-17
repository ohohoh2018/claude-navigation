---
name: pdca-init
description: Writes the destination (00_destination.md). Initial writing in a new project, editing in a project that already has one. Run once before /pdca-start.
---

# /pdca-init — write and edit the destination (v2)

This is the only command that writes the body of `00_destination.md`. It writes no other file. The status and verdicts follow the output of `node .claude/hooks/nav.js dest` as it is and are not recomputed. Commands and output formats → grep -F "anchor:check-execution" (NOTATION_CONVENTIONS). How to resolve a pointer → grep -F "anchor:execution-delegation" (NOTATION_CONVENTIONS).

When the output starts with `[nav.js error]`, stop at that step and show that line to the user.

The content and format of everything written follow the destination writing rules. Destination writing rules → grep -F "anchor:00-writing-rules" (NOTATION_CONVENTIONS).

Order of execution: **1 determine → (2 initial writing | 3 edit | 4 format repair) → 5 check**.

## 1. Determine

1. Run `node .claude/hooks/nav.js dest` and show the output as it is.
2. Branch on the `DestinationStatus` value:
   - `Unwritten` → go to 2.
   - `Written` → go to 3.
   - `FormatViolation` → go to 4.

## 2. Initial writing

1. Ask the user "Please describe the project you are starting. If there is work already done, or a document that records it, tell me as well" and receive the answer. When the user points at a document, read that file. When they do not, read nothing.
2. On the basis of the answer and the document pointed at, show a draft of the five items: final goal / quantitative criteria / qualitative criteria / constraints / out of scope. An item with no basis in the answer and the document is not made up; ask the user about that item. Work already done is used only as the basis of these five items. A direction that the answer or the document says will not be done again goes into the constraints draft as a `- {that direction} will not be done` line, and when a reason is written with it, ` ({reason})` is added at the end of the line.
3. When the quantitative and qualitative criteria of the draft total 0, do not ask for confirmation; ask for criteria, show the draft again in the form of step 2, and do this step 3 again. With 1 or more, confirm "Shall I write this content?":
   - Change requested → edit as requested, show it again in the form of step 2, and do this step 3 again.
   - Approved → go to step 4. Do not write a file before approval.
   - Rejected → print `[Destination aborted] not written` and end.
4. When the output of 1-1 has `DestinationFile: None`, `node .claude/hooks/nav.js dest --create` is run (it is not run when it is `Present`). Replace the placeholder lines of that file with the approved values as the initial writing of the destination writing rules says (all of: line writing by the number of values, numbers, the change history row). Structure template → grep -F "anchor:00-file-structure" (NOTATION_CONVENTIONS).
5. Go to 5.

## 3. Edit

1. Ask the user "What do you want to change?" and sort the answer into the matching ones of the six edits of the destination writing rules. An edit not among the six (deleting a criterion, changing a number, changing a fixed line) is not done, and the reason is reported in one line. When there are 0 edits to do (the user said there is nothing to change, or no edit remains), print `[Destination done] no change` and end.
2. Receive the values each edit needs:
   - Change the final goal → the new sentence, the reason for change.
   - Add a criterion → the criterion wording, which section of quantitative and qualitative, the reason for change.
   - Discard a criterion → the target number, the reason for discarding.
   - Change the wording of a criterion → the target number, the new wording, the reason for change. When the `Criterion:` line of that number in the output of 1-1 has `Recorded`, handle it as "change the wording of a recorded criterion"; when `Unrecorded`, as "change the wording of an unrecorded criterion".
   - Change constraints or out-of-scope → the lines to change, the reason for change.
3. For each line that changes, show the line before and the line after side by side, show the change history rows to add, and confirm "Shall I edit it this way?":
   - Change requested → go back to step 2.
   - Approved → go to step 4. Do not write a file before approval.
   - Rejected → print `[Destination aborted] not written` and end.
4. Edit only the approved lines and add the change history rows. New number = `NextCriterionNumber` of the output of 1-1. When two or more criteria are added at once, grow by 1 from that value.
5. Go to 5.

## 4. Format repair

1. From the values read and the expected values on the I-21 and I-22 lines of the output of 1-1, show a fix for each violation. The fix for an I-22 violation is one thing only: putting the wording of that criterion back to the history wording written in the output.
2. Confirm "Shall I edit it this way?":
   - Approved → write the fix and go back to 1.
   - Rejected → print `[Destination aborted] FormatViolation unresolved` and end.

## 5. Check

1. Run `node .claude/hooks/nav.js dest` and show the output as it is.
2. `DestinationStatus: Written` → go to step 3. Otherwise → go to 4.
3. Closing output (labels and order fixed):

```
[Destination done] {today}
[Final Goal] {the `Final Goal:` value of the dest output}
[Criteria] {the number of `Criterion:` lines of the dest output}
[Written] 00_destination.md
[Next] /pdca-start
```
