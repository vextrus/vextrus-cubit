// The auth frame's footer lines (Decision § 1): a link in the evidence-link idiom, optionally
// preceded by the prose that introduces it. One home for the idiom, so every S-Auth screen's footer
// focuses, colours and underlines alike (B-17, R-UI-012).
import Link from "next/link";
import { strings, type StringKey } from "../../ui/strings";

/** One footer line: the place it leads to, what it is called, and the prose that introduces it. */
export interface FooterLine {
  href: string;
  label: StringKey;
  prose?: StringKey;
}

export function FooterLines({ lines }: { lines: readonly FooterLine[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="cx-auth-footer">
      {lines.map((line) => (
        <p className="cx-auth-footer-line" key={line.href + line.label}>
          {line.prose === undefined ? null : <span>{strings[line.prose]}</span>}
          {/* Every hop between S-Auth screens travels through the router: a bare anchor fetches a
              fresh document and re-mounts the frame around it, so a person moving between sign-in
              and reset pays a full document load for a change of one column. It is still a real
              `<a>` — that is what `Link` renders — with the same idiom on it. */}
          <Link className="cx-auth-link cx-reticle" href={line.href}>
            {strings[line.label]}
          </Link>
        </p>
      ))}
    </div>
  );
}
