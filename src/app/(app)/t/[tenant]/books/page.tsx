// Books: the area is reachable from the rail, and it says
// honestly that it holds nothing yet (R-UI-050). Its next action is not here — a book is written
// by projects — so the action is the way to the screen where the work starts.
import Link from "next/link";
import { ShellEmptyState, shellHref } from "../../../../../ui/shell";
import { strings } from "../../../../../ui/strings";

export const metadata = { title: strings.shell_books_heading };

export default async function BooksShell({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  return (
    <>
      <h1 className="cx-shell-heading">{strings.shell_books_heading}</h1>
      <ShellEmptyState heading={strings.shell_books_empty_heading} body={strings.shell_books_empty_body}>
        {/* A move inside the frame, so it travels through the router like every other one: a bare
            anchor would fetch a fresh document and re-mount the shared layout, taking the rail's
            collapse back to expanded (§1). It is still a real `<a>` — that is what `Link` renders. */}
        <Link className="cx-shell-link cx-reticle" href={shellHref(tenant, "projects")}>
          {strings.shell_books_empty_action}
        </Link>
      </ShellEmptyState>
    </>
  );
}
