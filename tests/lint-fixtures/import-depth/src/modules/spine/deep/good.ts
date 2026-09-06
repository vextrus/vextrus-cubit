// ARCH-01: the lawful counterpart. A short climb inside the file's own module names its target
// plainly, `@/` names a layer from the root of the tree, a package specifier reaches no layer at
// all, and a long climb that lands OUTSIDE `src/` — the database lane's harness — reaches no layer
// either, so no alias could replace it.
import { errors } from "@/core/errors";
import { projects } from "../../spine/projects";
import { sibling } from "../sibling";
import { harness } from "../../../../db/__tests__/harness";
import { describe } from "vitest";

export const wired = { errors, projects, sibling, harness, describe };
