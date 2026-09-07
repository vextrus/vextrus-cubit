// Which project an address is inside, in the one place that reads it (B-17). The URL is the source
// of truth for where a reader stands (R-UI-031), and the palette's area rows and its `go` shortcuts
// both need that answer — so it is read once here rather than at each call site.
//
// It is the app layer's because the shape it reads is the app layer's own route tree:
// `/t/{tenant}/p/{project}/…`, which `src/ui` never spells (ARCH-01).

/** The `/p/<segment>` a workspace address names, or null for an address inside no project. */
const PROJECT_SEGMENT = /^\/t\/[^/]+\/p\/([^/]+)(?:\/|$)/;

/** The project an address is inside, or null when it names none. */
export function projectOf(pathname: string | null): string | null {
  if (pathname === null) return null;
  const match = PROJECT_SEGMENT.exec(pathname);
  return match === null ? null : (match[1] ?? null);
}
