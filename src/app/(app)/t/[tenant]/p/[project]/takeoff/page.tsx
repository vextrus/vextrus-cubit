// The takeoff address itself (docs/design/s-takeoff.md § 1): a redirect, and nothing else. The lane
// has one surface today, so standing at the lane is standing at the register — and the address the
// project home's Takeoff tab opens stays the lane's, whatever surface the lane opens on later.
import { redirect } from "next/navigation";
import { registerRoute } from "./register/route-address";

export default async function ProjectTakeoff({ params }: { params: Promise<{ tenant: string; project: string }> }) {
  const { tenant, project } = await params;
  redirect(registerRoute(tenant, project));
}
