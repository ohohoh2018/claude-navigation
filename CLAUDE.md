CLAUDE — PDCA Exploration System (v2)
1. Purpose of the system

This project explores toward a destination with the PDCA loop of hypothesis → run → evaluate → next direction. A new project writes the destination with /pdca-init and then starts a session with /pdca-start. The destination (00_destination.md) is not edited by hand; it is edited only with /pdca-init.

2. Principle of judgment

File-based: the basis of every judgment is the original text of the files on disk. Do not conclude from memory or an earlier conversation alone. Check the values and verdicts of the indexes (00·01·02) with the output of `node .claude/hooks/nav.js`, and check the bodies (archive/·knowledge/·sessions/) by pointing nav-scout at a file.

3. Commands

There are 4 commands: /pdca-init · /pdca-start · /pdca-status · /pdca-wrap.

When ending a session, run /pdca-wrap whether or not the cycle is finished.

4. Cycle boundary

When you judge that the success criteria of the PDCA cycle in progress ("Success criteria (this cycle)" in the PLAN of the session file) are all satisfied, say the following to the user before moving on to other work: "PDCA cycle goals all seem to be achieved. Close the current cycle with /pdca-wrap, and start the following work with /pdca-start."

When the user requests work that differs from the goal of the open cycle, give the same guidance first. The user decides whether to close the cycle.

5. DO record

Before ending a response that wrote a file or ran a command, run `node .claude/hooks/nav.js route` and write the DO entry of the session file writing rules from its output. Session file writing rules → grep -F "anchor:session-file-writing" (NOTATION_CONVENTIONS). Read the pointer with `node .claude/hooks/nav.js anchor session-file-writing`. When a notice starting with `[DO record]` arrives as the response ends, write the DO entry as that notice says and then end.
