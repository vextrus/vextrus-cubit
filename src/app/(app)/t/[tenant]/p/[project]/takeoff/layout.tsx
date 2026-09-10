// The takeoff lane's frame (docs/design/s-takeoff.md § 1): its own navigation above whatever surface
// of the lane a reader is standing on. The nav is the lane's one home for where its surfaces are,
// and every entry's address is asked of the route builder that owns it (B-17).
import "./takeoff.css";

import { registerRoute } from "./register/route-address";
import { strings } from "@/ui/strings";
import { TakeoffNav } from "./nav";

export default async function TakeoffLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string; project: string }>;
}) {
  const { tenant, project } = await params;
  return (
    <>
      <TakeoffNav entries={[{ testId: "takeoff-nav-register", label: strings.takeoff_nav_register, href: registerRoute(tenant, project) }]} />
      {children}
    </>
  );
}
