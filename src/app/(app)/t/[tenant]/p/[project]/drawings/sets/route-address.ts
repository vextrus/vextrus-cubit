// The two addresses these screens stand at, spelled once (B-17): the paths a commit revalidates,
// the way from a set row into the set itself, and the evidence a refusal whose remedy is one of
// them points back at. Until the shell's project navigation names them (the recorded R-UI-031 IOU),
// this is their one address.
export function setsRoute(tenantId: string, projectId: string): string {
  return `/t/${tenantId}/p/${projectId}/drawings/sets`;
}

export function setRoute(tenantId: string, projectId: string, setId: string): string {
  return `${setsRoute(tenantId, projectId)}/${setId}`;
}
