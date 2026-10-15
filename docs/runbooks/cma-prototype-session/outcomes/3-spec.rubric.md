# Outcome 3 rubric: the final single spec of the whole product

Grade each criterion on its own. Paths are under /mnt/session/outputs/public/03-spec/.

1. `VEXTRUS-SPEC.md` is one file that a new engineer could build from: the product and whom it serves,
   every module and feature from M0 through M5 and the later modules (4D, 5D, As built, As maintained,
   facility management, the buyer's view), each with its users, flows, data, finish line and milestone.
2. It uses CONTEXT.md's terms exactly; any new term (for example from the Revit-style classification)
   is defined in `glossary-delta.md` and used consistently.
3. It agrees with every ADR it relies on, citing each by number; where it argues for a change, the
   change is in `adr-proposals.md` (context, decision proposed, alternatives, consequences) and the spec
   marks the passage as depending on the owner's ruling.
4. The Live Model's schema is specified: Element identity, Discipline Parts, Element Relations,
   classification (Discipline, Category, Family, Type, Tag), Attributes by Life Phase, Records, Trace,
   IFC4 and Uniclass mapping; with an entity-relationship diagram.
5. The drawing-to-model pipeline is specified step by step (read, split sheets, Drafting Profile,
   recognise, assemble, check, confirm), with what Edison taught at each step, stated generically.
6. The system design covers the module map, the data flow, jobs, storage, the viewer, tenancy and
   security, performance budgets and deployment, consistent with docs/architecture.md and ADRs 0020-0023,
   0031 and 0034, with C4 context and container diagrams and sequence diagrams for the Takeoff,
   Confirmation and a Revision Comparison.
7. Every diagram is Mermaid source in the Markdown and also rendered to SVG under `diagrams/`; each one
   renders without error.
8. `m1-delta.md` lists exactly what should change in docs/specs/M1.md, docs/milestones.md and
   docs/design/m1-screens.md before M1 starts, each change with its reason and the evidence from the
   prototype.
9. `owner-questions.md` holds every product, scope, business, stack or spending decision the spec needs,
   one per question, the recommendation first with its reason in a line.
10. No file under `public/` holds drawing text, names, dimensions or geometry from the Edison set; the
    Adversary has checked that and has checked 20 of the spec's claims against the repository.
