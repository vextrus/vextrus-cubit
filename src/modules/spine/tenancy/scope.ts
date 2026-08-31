// Who is asking, and of which workspace — the shape every door of this module takes first. It is
// the participants module's `ParticipantsCtx` minus the actor kind: a workspace role is moved by a
// person or it is not moved at all, and tenant administration writes no act to name a kind on
// (SEAM-ACT).
export interface TenancyActor {
  readonly tenantId: string;
  readonly userId: string;
}
