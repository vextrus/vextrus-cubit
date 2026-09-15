// The register JSON export's one public surface (R-TO-070, C-TO-EXPORT): the version the shape is
// published under, the schema that shape is declared in, the pure function from the register's
// reading to a document, and the canonical text that document is published as.
//
// Every name is spelled rather than starred — this barrel is the area's public roster, and a roster
// that says nothing cannot tell a moved name from a dropped one (ARCH-02). A transport door (a
// query, a download) calls `registerJsonOf` and `serializeRegisterJson` and adds nothing of its own.
//
// Each schema name carries both meanings it is declared under: the Zod schema a caller parses with,
// and the type `z.infer` gives it.
export {
  REGISTER_JSON_SCHEMA_VERSION,
  RegisterJsonAttribute,
  RegisterJsonBinding,
  RegisterJsonCampaign,
  RegisterJsonDocument,
  RegisterJsonLine,
  RegisterJsonObject,
  RegisterJsonReading,
  RegisterJsonRefusal,
} from "./schema";
export { registerJsonOf, serializeRegisterJson } from "./serialize";
