/**
 * The spine module's strings — the copy that belongs to the platform itself (R-SPINE-060).
 *
 * Every key is prefixed with the module's own name, so a key says where it is registered and
 * two modules cannot claim the same id. English values, because R-SPINE-060 is a readiness
 * rule and not a translation system: the table is the place a translation would later go, and
 * the point today is that no string is anywhere else.
 *
 * Frozen for the reason the refusal registries are: a table an importer can edit at run time
 * is a default, not the one string table.
 */
export const SPINE_STRINGS = Object.freeze({
  'spine.appName': 'Vextrus CUBIT',
} as const);
