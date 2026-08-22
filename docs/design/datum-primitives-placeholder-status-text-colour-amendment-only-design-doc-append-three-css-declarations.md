# Design Decision — datum-primitives amendment: placeholder and status-text colour

Not a routed screen. This decision fixes the one visual change inc-007e ships: the contrast
remedy from the inc-007-design-gallery arbitration, applied to `src/ui/primitives/primitives.css`
and recorded as an append to `docs/design/datum-primitives.md` (AM-03: the record lands before
acceptance is written). Everything else in `datum-primitives.md` §1–§17 stands unchanged and
remains the primitives' contract.

## 1. The defect being remedied

`docs/design/datum-primitives.md` §3, §6 and §7 set placeholder and status text in
`--graphite-500`. On the surface these texts actually sit on — `--graphite-0`, the field and
overlay background in both themes (datum-tokens §2) — that token misses R-UI-012's 4.5:1 floor
for 13 px text:

| Text on `--graphite-0` | Light | Dark |
|---|---|---|
| `--graphite-500` (`#8591A0` / `#5C6678`) — today | ≈ 3.2:1 | ≈ 3.3:1 |
| `--graphite-600` (`#66707F` / `#7E8899`) — remedy | ≈ 5.0:1 | ≈ 5.4:1 |

axe reports the Select trigger placeholder as a serious `color-contrast` violation on every
`/design` render (it is real DOM text; the native `::placeholder` texts fail the same arithmetic
but sit outside axe's reach). The arbitration's remedy covers all three texts, because the
requirement is R-UI-012, not axe's detection surface.

## 2. The CSS change, exact and complete

Three declarations in `src/ui/primitives/primitives.css` change their value from
`var(--graphite-500)` to `var(--graphite-600)`. No selector is added or removed; no other
declaration changes; the string `--graphite-500` appears zero times in the file afterwards
(today it appears exactly three times, in these declarations):

```css
.datum-field::placeholder {
  color: var(--graphite-600);
}

.datum-select-trigger[data-placeholder] {
  color: var(--graphite-600);
}

.datum-combobox-status {
  color: var(--graphite-600);
}
```

- `.datum-field::placeholder` covers the Input and Textarea placeholder (§3) and, because the
  Combobox field is an Input, the Combobox placeholder too (§7).
- `.datum-select-trigger[data-placeholder]` covers the Select trigger showing its consumer's
  `placeholder` (§6).
- `.datum-combobox-status` covers both Combobox status rows — “Searching…” and “No matches for
  this search.” (§7). Its other properties (padding, `--text-13`) are untouched.

## 3. What deliberately does not change

- **Disabled placeholders stay `--graphite-400`** (§3): a disabled control is exempt from the
  contrast floor, and the disabled/enabled distinction must stay legible.
- The hierarchy of inks is preserved with one step less span: committed value `--graphite-900`,
  secondary/placeholder `--graphite-600`, disabled `--graphite-400`. Placeholder and secondary
  text now share a token — acceptable, because a placeholder is distinguished by emptiness and
  position, never by colour alone (R-UI-060).
- `--graphite-500` keeps its roles elsewhere (datum-primitives §10 shortcut hints, s-design rail
  group labels and identifier text): those are outside this arbitration and outside this file.
- No token value changes; `src/ui/tokens.ts` and `tokens.css` are untouched.
- The three texts repaint on `/design` (input invalid, select placeholder, combobox entries) —
  captured by the J-004 baselines; see the sibling gallery decision.

## 4. The append to docs/design/datum-primitives.md, verbatim

One section, appended after §17, deliberately unnumbered so the AC-1 title string is exact.
This is the entire doc edit — no line of §1–§17 is rewritten:

```markdown
## Placeholder and status-text colour

Amended by the inc-007-design-gallery arbitration's remedy, superseding the `--graphite-500`
mentions in §3, §6 and §7: placeholder and status text at `--graphite-500` reads at about
3.2:1 (light) and 3.3:1 (dark) on the `--graphite-0` field surface, under R-UI-012's 4.5:1.
The Input and Textarea placeholder (`.datum-field::placeholder`), the Select trigger
placeholder (`.datum-select-trigger[data-placeholder]`) and the Combobox status rows —
“Searching…” and “No matches for this search.” (`.datum-combobox-status`) — render in
`--graphite-600`: about 5.0:1 light, 5.4:1 dark. Disabled placeholders stay `--graphite-400`
(§3); no other rule changes.
```

## 5. States, copy, motion

No state gains or loses a rendering; no copy changes; no motion changes. This amendment is a
colour rebinding only.

## 6. Both themes

`--graphite-600` is role-stable (secondary text, datum-tokens §2), so the remedy needs no
theme fork: light `#66707F` on white, dark `#7E8899` on near-black, both ≥ 4.5:1.

## 7. Test hooks

No routes, no test ids. The graded surface (C-05, per AC-1): the three selectors above each
bind `color: var(--graphite-600)` in `src/ui/primitives/primitives.css`, the string
`--graphite-500` appears zero times in that file, and `docs/design/datum-primitives.md` carries
the §4 append. The visible proof lives in the six J-004 baselines.
