// The door in front of everything signed-in (R-UI-031): a request that presents no session never
// paints workspace content — it is sent to `/sign-in`, which is the remedy and the way back in.
// The guard lives here, above every `/t/…` route, so no screen below it owes the check again.
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { presentedSessionToken } from "../../server/shell/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const presented = await presentedSessionToken();
  if (presented === null) redirect("/sign-in");
  return <>{children}</>;
}
