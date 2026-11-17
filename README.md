PDCA Exploration System — User Guide

What it solves

The problem of forgetting directions already tried and repeating the same mistake is blocked with the discard list.

The problem of losing the current position when the session changes is carried over with the current position of the exploration tree.

The problem of the basis of a judgment vanishing because records are plain logs is handled by leaving the causal chain of hypothesis, result and judgment.

Getting started

1. Copy this whole folder and use it as the new project folder. Check that the hidden folder .claude was copied with it (.claude/settings.json, .claude/hooks/ and .claude/skills/ must be there for the commands and checks to work).

2. Open Claude Code in that folder and run /pdca-init. When you describe the project, Claude shows a draft of the destination (00_destination.md) and writes it to the file once you approve. If there is work already done, or a document that records it, tell Claude as well. Claude uses that content as the basis of the destination draft.

3. Start the first session with /pdca-start. When ending a session, always run /pdca-wrap.

Requirements: Claude Code, Node.js (the node command must run).

Using it on a remote server: compress this folder including .claude, upload it, and extract it on the server to use as the project folder. From there it is the same from step 2.

Sessions and cycles: a cycle (one round of setting up a hypothesis, running it and evaluating it) continues across sessions. /pdca-wrap first asks "End this cycle / end only the session and continue the cycle?". If you are only changing sessions because context is running short, pick "end only the session". Then what was done, what remains and the next first action are written in the session file, and running /pdca-start in a new session continues the same cycle from that point. To put a cycle off for a while and do another direction first, pick "end the cycle" and give Pivot as the conclusion. There is one open cycle at a time. While a cycle is open, Claude leaves one line of what it did in the session file for every response that wrote a file or ran a command. If it is skipped, a hook blocks the response from ending and demands the record (so that what was done remains even when the session ends without /pdca-wrap being run).

Files are not edited by hand. When the destination must change, run /pdca-init again (change the final goal, add a criterion, discard a criterion). The wording of a success criterion already recorded is not edited; it is discarded and added again under a new number. This keeps the meaning of a D# that past records point to from changing.

Commands

There are four: /pdca-init · /pdca-start · /pdca-status · /pdca-wrap. /pdca-init is used to write or edit the destination, /pdca-start to start a session, /pdca-status to see the current position during a session, and /pdca-wrap to end a session (whether ending the cycle or only the session). The purpose and behavior of each command follow the command description (SKILL) shown when it runs.

Learn more

Folders and files

00_destination.md: the destination. The final goal and the success criteria (D#). It is not in a freshly copied folder; /pdca-init makes it.

01_exploration_tree.md: the exploration tree. Current position, recent attempts, discarded directions, next direction candidates. /pdca-wrap writes it.

02_knowledge_base.md: the lesson list. Lesson bodies are in knowledge/.

sessions/: session records. One file per date (hypothesis, run, result, judgment).

knowledge/: lesson bodies. One file per lesson.

archive/: past records pushed out of the exploration tree. One file per month.

history/: the edit history of 00·01·02. One file per month.

locks/: control files the commands use. Do not touch them.

.claude/: commands (skills), check scripts (hooks), the lookup agent (agents), hook registration (settings.json).

CLAUDE.md: the base instructions Claude reads every session.

dev/: verification scripts for people who change this system (node dev/verify_lint.js . and node dev/verify_scenarios.js . ../_nav_test_tmp). A project that only uses the system does not need it and can delete it.

NOTATION_CONVENTIONS: the source of formats and rules. The commands load only the parts they need.

Format, ID and invariant rules: the NOTATION_CONVENTIONS document.

Checking the current state yourself: in the project folder run node .claude/hooks/nav.js status or node .claude/hooks/nav.js check. See the writing status of the destination with node .claude/hooks/nav.js dest.

Seeing past states: every time a wrap is done, the files among 00·01·02 that changed, as they are right before the write, are appended to that month file (YYYY-MM.log) of the history/ folder. See the list with node .claude/hooks/nav.js history, and the difference between two points in time with node .claude/hooks/nav.js diff 1 2.
