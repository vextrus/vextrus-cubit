"use client";
/**
 * IdChip (R-UI-082) — an opaque identifier as a person can actually use it: the short form on
 * screen, the whole value one keystroke away, and the whole value in the tooltip so nobody has to
 * copy it to read it.
 *
 * A digest, a uuid and an act id are not prose and are never abbreviated in the DATA — the short
 * form is a rendering, and the element carries the full value in `data-value` so a suite, a
 * screen reader's copy and the clipboard all get the real thing.
 */
import { useState, type ReactNode } from "react";
import { cx } from "./class-names";
import { IconCopy } from "../../icons";
import { IconButton } from "./icon-button";
import { Tooltip } from "./tooltip";
import { strings } from "../../strings";

/** How many characters of an opaque value a reader needs to tell two of them apart on one screen. */
const SHORT_LENGTH = 7;

export interface IdChipProps {
  value: string;
  /** The short form, when the caller knows a better one than the leading characters. */
  short?: string;
  className?: string;
  "data-testid"?: string;
}

/** The short form of an opaque value — the leading characters, and the whole of a value already short. */
export function shortForm(value: string, length: number = SHORT_LENGTH): string {
  return value.length <= length ? value : value.slice(0, length);
}

export function IdChip({ value, short, className, "data-testid": testId }: IdChipProps): ReactNode {
  const [copied, setCopied] = useState(false);

  const copy = (): void => {
    // The clipboard is a browser capability, not a guarantee: a denied permission or a context that
    // has none is not a fault, and the chip simply does not claim to have copied.
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (clipboard === undefined) return;
    void clipboard.writeText(value).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <span
      className={cx("cx-id-chip", className)}
      data-testid={testId ?? "id-chip"}
      data-value={value}
      data-copied={copied || undefined}
      onPointerLeave={() => setCopied(false)}
      onBlur={() => setCopied(false)}
    >
      <Tooltip content={value}>
        <span className="cx-id-chip-value" tabIndex={0}>
          {short ?? shortForm(value)}
        </span>
      </Tooltip>
      <IconButton
        className="cx-id-chip-copy"
        data-testid={testId === undefined ? "id-chip-copy" : `${testId}-copy`}
        icon={<IconCopy size="sm" />}
        label={copied ? strings.primitive_id_chip_copied : strings.primitive_id_chip_copy}
        onClick={copy}
      />
    </span>
  );
}
