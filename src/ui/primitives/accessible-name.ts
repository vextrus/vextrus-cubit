/**
 * The type that makes a name a condition of mounting a control (R-UI-012, Design Decision §1).
 *
 * §1: "Every interactive element has an ARIA name: from its visible text, its `<label>`, or a
 * required `label`/`aria-label` prop (IconButton, Slider, Progress, Combobox). No unnamed
 * control ships." A Button is named by the words inside it and an Input by the `<label>` a
 * screen writes for it — but a Slider, a Progress and a Combobox render no text of their own,
 * so for those three the name has to come in as a prop, and a prop that is merely offered is
 * one a screen forgets.
 *
 * Two branches rather than one required `aria-label`, because a name that repeats a heading
 * the user can already see should point at that heading instead of restating it: either the
 * words, or the id of the element carrying them, and at least one of the two.
 */
export type AccessibleName =
  | { readonly 'aria-label': string; readonly 'aria-labelledby'?: string }
  | { readonly 'aria-label'?: string; readonly 'aria-labelledby': string };
