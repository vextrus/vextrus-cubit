# Attributes are data; As designed values sit on the Element State, later Life Phases in Records

How the Live Model (ADR 0035) holds its cost, construction and O&M attributes:
1. **Identity.** Each Element's UUIDv7 is permanent across Revisions and Life Phases and is its IFC
   GlobalId; anything an export splits out of one Element gets an id derived from it, never a random one.
2. **Attribute Definitions are data**, Library rows per Element Family and per market, and a Developer may
   add its own. Each carries a permanent namespaced key, never renamed or reused (a change of meaning is a
   new key that replaces the old); a data type and unit dimension; labels per language (English, Bangla);
   the Element Families it applies to; the Life Phases it may hold and who writes each; its source; whether
   it feeds a figure; its Deviation tolerance; its market scope; and its IFC mapping. Classification
   (Uniclass first) is a reference on the Family, or on the Element where it differs, never a field.
3. **As designed values:** a small typed core on the Element State (mark, storeys, grid, position, Mix,
   grade, Rebar Basis, Construction Stage, casting stage) plus a JSONB document whose every key the
   confirm service checks against its definition. Only a change to a figure-feeding attribute moves the
   Priced BOQ's cache key (a hash of the figure-feeding facts); a key is promoted to a typed column only on
   a measured need.
4. **As built and As maintained values** are **Records**: one append-only row per value, naming who, when
   and on what evidence, stamped with the design version in force. A Record never makes a Model Version
   and never moves a figure; a Deviation is shown, never absorbed.
5. **When.** M0 creates the tables empty (Attribute Definitions and their family applicability, Records,
   classification systems and references), with their row-level security policies; M1 fills the As
   designed definitions for its families with their IFC mappings and Uniclass references; cost control and
   after-sales add theirs later with no schema change.

Why: measured in the session-02 component-store prototype on PostgreSQL 16 at 1.5 M Elements, 100 tenants,
row-level security forced: the C2 query ("every C2 column on levels 3–6, its concrete, rebar, cost,
casting stage and maintenance notes") took 1.6 ms warm with this shape, 1.9 ms with all-JSONB and 5.2 ms
(66 ms cold) with a row per attribute (EAV); storage 1.9 GB against 2.5 and 8.0 GB; a one-value change
wrote 6 rows against EAV's 46; As built and As maintained Records made no Model Version and moved no
figure in 9 of 9 runs (docs/research/component-attributes-and-classification.md; the prototype's report
in `.private/work/session-02/component-store/`). The pattern (stable identity, definitions as data with
permanent keys, values keyed by them beside a typed core) is what IFC property templates, bSDD, Revit
shared parameters, iTwin and IFC 5 all do. Rejected: attributes as columns (a migration per attribute);
EAV for design values (slower and 4× larger); all-JSONB with later phases copied into documents (no
per-value evidence or history); ad hoc keys without a definition (untyped, and irreparable in append-only
data).

## History
- 27 Sep 2026 (owner's decision, session 02 Q14), with the prototype judged: "Agree with your
  recommendation on Q14. Judgement on the prototype itself: yes, the inspector, the query and the
  three-phase history read as I'd want, looks good."
