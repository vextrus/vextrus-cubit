// The frame's areas and the addresses they live at (R-UI-031): the URL is the source of truth, so
// the mapping between an address and the entry that is selected has one home — the rail, the
// breadcrumb and the routes themselves all read it from here rather than each spelling `/t/…`.

/** The workspace the frame is showing: the uuid its address names it by, and the name it wears. */
export interface ShellWorkspace {
  tenantId: string;
  name: string;
}

/** The areas the shell ships. Each is one rail entry, one address and one breadcrumb crumb. */
export type ShellArea = "projects" | "books" | "settings";

/** The address of an area within a workspace — Projects is the workspace's own home. */
export function shellHref(tenantId: string, area: ShellArea): string {
  const home = `/t/${tenantId}`;
  return area === "projects" ? home : `${home}/${area}`;
}

/** Which area an address is in. Anything under a workspace that names no area is its Projects home. */
export function areaOf(pathname: string | null): ShellArea {
  if (pathname === null) return "projects";
  const trailing = pathname.replace(/\/+$/, "");
  if (trailing.endsWith("/books")) return "books";
  if (trailing.endsWith("/settings")) return "settings";
  return "projects";
}
