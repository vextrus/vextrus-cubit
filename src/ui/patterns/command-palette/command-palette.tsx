"use client";
// The ⌘K dialog itself: the shipped Dialog primitive, a combobox over a listbox, and the body that
// answers (Decision §1). No cmdk — the combobox is hand-rolled so that an unavailable row stays
// listed with its reason and the navigate group stays the seam's answer rather than a client filter
// (I-136).
import { useId, useRef, type KeyboardEvent } from "react";
import { Input } from "../../primitives/core";
import { Dialog, DialogContent } from "../../primitives/overlay";
import { strings } from "../../strings";
import { useCommandPalette } from "./command-palette-provider";
import { PaletteBody } from "./palette-body";

export function CommandPalette() {
  const palette = useCommandPalette();
  const listId = useId();
  const input = useRef<HTMLInputElement | null>(null);

  // Outside a provider there is no palette to open, so there is nothing to render (I-135).
  if (palette === null) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // The arrows walk the options while DOM focus stays in the combobox (I-137); Escape is the
    // Dialog's own, and ⌘K is the one global handler's, so neither is answered twice (B-17).
    if (event.key === "ArrowDown") {
      event.preventDefault();
      palette.move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      palette.move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      palette.jump("first");
    } else if (event.key === "End") {
      event.preventDefault();
      palette.jump("last");
    } else if (event.key === "Enter") {
      event.preventDefault();
      palette.activate();
    }
  };

  return (
    <Dialog
      open={palette.open}
      onOpenChange={(next) => {
        if (!next) palette.closePalette();
      }}
      // Non-modal for one reason (the frame's own I-118): the modal treatment marks the rest of the
      // frame `aria-hidden` while its links stay focusable, which axe reports as a serious
      // `aria-hidden-focus` — and Q-11 admits none at a checkpoint. The scrim, the dismissal and the
      // focus return are therefore stated here rather than inherited.
      modal={false}
    >
      {palette.open ? <div className="cx-scrim" aria-hidden="true" /> : null}
      <DialogContent
        asChild
        aria-label={strings.command_palette_label}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          input.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div data-testid="command-palette" className="cx-palette">
          <Input
            ref={input}
            data-testid="command-palette-input"
            className="cx-palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={palette.activeId ?? undefined}
            aria-autocomplete="list"
            aria-label={strings.command_palette_input_label}
            autoComplete="off"
            placeholder={strings.command_palette_placeholder}
            value={palette.query}
            onChange={(event) => palette.ask(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <PaletteBody
            listId={listId}
            status={palette.status}
            groups={palette.groups}
            activeId={palette.activeId}
            query={palette.query}
            refusal={palette.refusal}
            fault={palette.fault}
            offline={palette.offline}
            onClear={() => {
              palette.clear();
              input.current?.focus();
            }}
            onChoose={palette.choose}
            onHover={palette.hover}
            onShortcuts={palette.openSheet}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
