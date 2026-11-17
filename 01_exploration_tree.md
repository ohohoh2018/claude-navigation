---
best_attempt: None
last_updated: YYYY-MM-DD
archived_through: None
---

# Exploration Tree — Index

> This file is an **index**. The detailed run process of an attempt is in `sessions/`, and past records pushed out are in `archive/`.
> `/pdca-wrap` is the only writer. Value reads and format checks are done by `.claude/hooks/nav.js`.
> ⚠️ **No compression**: `◎ Best Record`, `Why that point` of the Return Log, and `Discarded Directions` are not deleted or summarized.
> frontmatter notation → grep -F "anchor:frontmatter-empty-value-rule" (NOTATION_CONVENTIONS) · `last_updated` date format → grep -F "anchor:date-literal-full-list" (NOTATION_CONVENTIONS)

## ★ Current Position

```
Attempt #: #0
Path: #0
Direction: Before the start — destination set, exploring the first direction
Status: To Do
Started: YYYY-MM-DD
Body: sessions/YYYY-MM-DD.md
```

> ★ section and path format → grep -F "anchor:01-format-position-path-attempt" (NOTATION_CONVENTIONS)
> ★ update rule → grep -F "anchor:current-position-update" (NOTATION_CONVENTIONS)
> `Status` is a computed value (a person does not choose it). Status determination → grep -F "anchor:status-determination" (NOTATION_CONVENTIONS)

## ◎ Best Record

> The yardstick is the destination criteria (D#) of `00_destination.md`. Per-session success criteria are not the yardstick.
> The default on update is **keep**. To change it, present "why this one is closer" and get user approval.

```
Closest attempt: —
Why closest: —
What blocked it: —
```

> ◎, Return Log, Recent Attempts and Next Direction Candidates field formats → grep -F "anchor:01-field-format-table" (NOTATION_CONVENTIONS)
> `Why closest` value format → grep -F "anchor:composite-why-closest" (NOTATION_CONVENTIONS)

## Return Log

| Blocked at | Return point | Why that point | Invalidated lessons | Body |
|---|---|---|---|---|
| — | — | — | — | — |

> `Invalidated lessons` is not left empty. When checked and not applicable, write `None`.
> Row order, template row, and the difference between `None` and `—` → grep -F "anchor:notation-grammar" (NOTATION_CONVENTIONS)
> Invalidation write order → grep -F "anchor:invalidation-write-order" (NOTATION_CONVENTIONS)

## Recent Attempts

| # | Branch point | Direction | Result | Conclusion | Lesson | Body |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

> `Branch point` value → grep -F "anchor:branch-point-value-rule" (NOTATION_CONVENTIONS)
> Result and conclusion vocabulary → grep -F "anchor:enum-column-vocab" (NOTATION_CONVENTIONS)
> `Body` path → grep -F "anchor:id-path-derivation" (NOTATION_CONVENTIONS)

## Next Direction Candidates

> Candidate line format, promotion and discard → grep -F "anchor:candidate-format" (NOTATION_CONVENTIONS)

## Discarded Directions

| # | Branch point | Direction | Discard reason | Date | Retry condition |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

> ⛔ Rows of this table are not deleted, summarized or migrated.
> To propose a discarded direction again, first present the basis that its `Retry condition` is met.
> Discarded Directions table format → grep -F "anchor:01-format-discarded-directions" (NOTATION_CONVENTIONS)
