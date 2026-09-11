// The project's one choke point (ARCH-02). Every screen under /t/<tenant>/p/<project> renders inside
// this layout, and until it existed each of them re-asked the question — six of them wrongly, and
// one (settings/ruleset) not at all. The membership question is asked here, once, before any of them
// reads anything; the permission a particular screen moves stays that screen's to name.
import type { ReactNode } from "react";
import { authorizePage } from "@/server/authorize-page";

export default async function ProjectLayout({ children, params }: { children: ReactNode; params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  await authorizePage({ tenant, project });
  return <>{children}</>;
}
