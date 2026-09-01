// The participants module (R-SPINE-011, L-ACT-03): who holds which role on a project, the full
// record of how that came to be, and the people a role may be assigned to. Every caller — a server
// action, a transport, a suite — comes through this barrel, so the doors a project's roster has are
// enumerable in one place (ARCH-02).
//
// The module reads; it never writes. Assignment is an act, so the write is the act seam's and this
// module holds no second path to it (B-17, SEAM-ACT).
export { assignableSubjects } from "./directory";
export { participatesIn, requireRoleHistoryAccess } from "./guard";
export { roleHistory, type ProjectRef, type RoleDirection, type RoleHistoryEntry } from "./history";
export { projectParticipants, type ProjectParticipant } from "./roster";
export { type MemberIdentity, type ParticipantsCtx } from "./scope";
