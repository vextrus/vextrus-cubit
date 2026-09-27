# Component attributes and classification: how each Element's attributes are held

Question: how should every Element's attributes be held (as data per Element Family and per market,
not as columns) so that they stay identical across Revisions and the building's Life Phases, and map
cleanly to IFC and to classification systems when later markets demand them? And what must the
MVP's data spine hold now so that nothing is rebuilt later?

Researched 27 Sep 2026 for session 02 (the owner's rulings of the day: ADR 0035, one identity per
Element across As designed, As built and As maintained; the data carries the Life Phase from M0).
Inputs read: `docs/intent.md`, `CONTEXT.md`, `docs/data-model.md` §2 and §3.3, ADRs 0031, 0034, 0035
and 0036, `docs/research/glodon-bim-2.md`, and the sibling `docs/research/global-markets-foundation.md`
(the Market row, message catalogues, money with its currency, UUIDv7), which this file does not
repeat. Terms are `CONTEXT.md`'s. One new term is proposed: **Attribute Definition** (§1.3).

**Confidence.**
- **High:** a primary source says it and I read it (a standard's own text or source repository, an
  official register or API, a court order, vendor source code or docs).
- **Medium:** plain inference from a primary source, or a primary source that marks itself as a draft.
- **Low:** my judgement, a blog, or a search-result summary I could not open.

Sources are `[C#]`, listed at the end. Nothing was measured on this machine for this file; a sibling
prototype is measuring JSONB against EAV locally. Nothing from the real drawings was used.

---

## 0. What is unmeasured, uncertain or blocked (read first)

1. **No performance number here is ours.** The only JSONB-versus-EAV figures found are two 2016 blog
   posts on PostgreSQL 9.4/9.5 with synthetic data [C64][C65]. They are claims about other people's
   workloads, eight or more major versions ago. The sibling prototype's measurement on PG 16 replaces them.
2. **The rendered standards pages refused every fetch** (a Cloudflare challenge; only buildingSMART's
   mandates PDF [C43] downloaded): the IFC 4.3 documentation, `standards.buildingsmart.org`,
   `buildingsmart.org`, `technical.buildingsmart.org` and `iso.org`, from curl and the fetch tool, and
   (for `iso.org` and the IFC documentation) from the headless browser too. Instead I read:
   - IFC 4.3 from the source repository that generates the documentation, branch `ifc4.3-main` at
     commit `6754caa287` (24 Sep 2026) [C2], and from buildingSMART's own bSDD API, which serves the
     IFC 4.3 dictionary [C20]. The published ISO 16739-1:2024 text itself was not read (it is sold).
     Small differences between the branch head and the ISO edition are possible.
   - ISO facts (titles, dates, stages, scopes) from ISO's own open-data file [C33], not from the
     catalogue pages. **No ISO standard's body text was read**; ISO 23386's list of property
     attributes is known only through bSDD's mapping page, which says of itself "work in progress …
     should not be used for reference" [C23]. Treat §3's ISO 23386 row as Medium.
3. **The licence readings are mine, not legal advice** (§5.2). The MasterFormat ruling is one US
   district court's order of 1 Sep 2026 [C42]. It binds no court in Bangladesh, the Gulf, India or the
   UK, and it leaves CSI's trademarks in place. The docket showed filings on 15 Sep 2026 (a costs
   application and a fees motion) and 25 Sep 2026 (an opposition), and no notice of appeal; an appeal
   is still possible.
4. **No Developer has been asked which O&M attributes they want.** Which As maintained fields a Dhaka
   after-sales team fills (COBie's? their own?) is unknown. ADR 0035 already rejected a starter O&M
   set of Vextrus defaults for the MVP.
5. **No Bangladeshi, Indian or Saudi classification mandate was found.** This is an absence in
   searches and in buildingSMART's 2025 mandates playbook, which has no chapter for them [C43]. It
   does not prove there is none. `docs/research/glodon-bim-2.md` reached the same "not found" for a
   Bangladeshi data standard.
6. **The Uniclass codes quoted in §9 come from NBS's own bSDD copy** (version "1", released
   16 Aug 2024, status Preview) [C25]. NBS publishes Uniclass quarterly, most recently on
   1 Jul 2026 [C38]. Re-check each code against the current download before it ships.
7. **Even an authority gets IFC mapping wrong.** Dubai Municipality's live bSDD dictionary (1.0.4,
   active since 5 Mar 2026) requires `Qto_ColumnBaseQuantities.Area` and
   `Pset_ColumnCommon.Capacity` for columns [C26]. Neither name is in IFC 4.3's own sets for
   `IfcColumn` [C20]. Any mapping we write needs a check against the IFC dictionary in CI.
8. **COBie's two live versions disagree on O&M fields.** COBie 2.4 (NBIMS-US V3) has
   `Type.ExpectedLife` and `Type.ReplacementCost` [C36]. COBie V3's Type field list (NIBS page) has
   neither; it has `PurchaseCost` and `NominalWeight` [C35]. I read the page's field tables but not
   its comparison figure (AD.8), which is an image.
9. **Glodon's attribute storage is not publicly documented** that I could find. The Glodon paper
   says only that geometry, discipline attributes, cost, construction requirements and O&M
   parameters "hang on the same object" (`docs/research/glodon-bim-2.md`, Ch.5, p.36–37).

---

## 1. Conclusions

### 1.1 The answer in one paragraph

Every mature system surveyed splits the problem the same way: **(a) a stable identity per thing,
(b) attribute definitions held as data, each with a permanent key, a data type, a unit dimension,
labels per language, a version and a status, and (c) values held in a flexible container keyed by
those definition keys**, with a small fixed core of typed columns for what every query needs. IFC
does it with property-set templates and name-matched properties [C3]–[C6], bSDD and ISO 23386 with
dictionary properties [C22][C27], Revit with shared parameters defined in a file independent of any
project [C49][C50], iTwin with versioned EC schemas, aspects and kinds of quantity [C53]–[C55],
Speckle with dynamic properties on immutable objects [C58], and the IFC 5 alpha with namespaced
attribute keys layered onto UUID paths [C48]. Vextrus should do the same. The **Element's UUID is
the identity that becomes the IFC `GlobalId`** (which "has to be persistent" [C13]) and the COBie
`ExtIdentifier` (which COBie uses to "maintain identity if an object is renamed" [C36]).
**Attribute Definitions are Library data per Element Family, scoped by market**, each carrying its
IFC mapping as data. **Values stay in the Element State's JSONB, keyed by definition key, for As
designed**, and in an append-only record per value, with its evidence, for As built and As maintained
(ADR 0035). **Classification is a
reference (system, edition, code, URI) attached to the Family by default and to the Element when it
differs**, never a column and never our own codes inside someone else's table. Before the first
Element is written this is a handful of small tables, a key-naming rule, a write-time validator and
one identity function. The attribute content waits for M1, and the O&M, COBie and market content
waits for its module.

### 1.2 The recurring pattern, with evidence

| Concern | IFC 4.3 | bSDD / ISO 23386 | COBie | Revit | iTwin (BIS/EC) | Speckle | IFC 5 alpha |
|---|---|---|---|---|---|---|---|
| Stable identity | `GlobalId`, "has to be persistent"; STEP `#123` ids are not [C11][C13] | URI per property/class, versioned [C22] | `ExtIdentifier` = `GlobalId`, used to merge and keep identity through renames [C36] | the IFC exporter derives the GUID from the element and can store it back on the element (`StoreIFCGUID`) [C51] | `FederationGuid` names the real-world entity; survives delete and recreate [C52] | `applicationId` holds the host's native id; `id` is a content hash that changes on any edit [C58] | `path` is a UUID; layers add attributes to it [C48] |
| Definition as data | `IfcPropertySetTemplate` + `IfcSimplePropertyTemplate` (measure type, unit, enumerators) [C4][C5] | Property: code, name, definition, data type, units, dimension, allowed values [C22] | fixed tables; custom fields go in the Attribute table, never as new columns [C35] | shared-parameter file, independent of any project [C49][C50] | ECProperty in a versioned ECSchema; `KindOfQuantity` [C54][C55] | none (dynamic keys) [C58] | `schemas` block: key → data type, restrictions [C48] |
| Grouping | property set; `Pset_` prefix reserved for IFC's own [C3] | `ClassProperty.PropertySet`; "Pset_ is reserved" [C22] | table per concern | parameter groups [C50] | `ElementAspect` = optional property group [C53] | nested objects | namespaces (`bsi::ifc::prop::`) [C48] |
| Type vs occurrence | type psets shared; occurrence overrides by name [C18][C6] | ClassProperty overrides Property [C22] | Type vs Component tables [C35] | type vs instance parameters | `TypeDefinitionElement` for shared values, aspects for one Element's [C53][C56] | — | — |
| Units | measure type + unit per template [C5]; SI recommended [C20] | ISO 80000 dimension vector + unit list [C22] | Title Block units [C35] | spec types | persistence unit + presentation units [C54] | — | — |
| Versioning | IFC release | dictionary semver; replaced/replacing codes; "latest" is not immutable [C22] | V2.4 → V3 | — | read.write.minor; removing or retyping a property is a major change [C55] | every edit is a new object [C58] | `dataVersion` [C48] |
| Ad hoc data | any user pset without the `Pset_` prefix [C3] | private dictionaries | Attribute table | project parameters | `JsonProperties`: "no type-safety", "no required data" [C57] | any key | any namespace |

The lesson in the last row: every system allows ad hoc attributes, and every system that documents
them warns that they are untyped and invisible to generic tools [C57]. So Vextrus allows only
attributes that have a definition, including a tenant's own.

### 1.3 The recommended Attribute Definition

**Attribute Definition** (proposed term): one kind of fact an Element can carry, defined once as
data: its permanent key, type, unit dimension, labels, the Element Families and markets it applies
to, the Life Phases it may hold values in, and how it maps to IFC. *Avoid*: parameter, property
(an IFC word), field, column.

| Field | What it holds | Why (source) |
|---|---|---|
| `key` | Permanent, namespaced, ASCII: `vx.column.section_b`, `vx.concrete.strength_class`; a tenant's own start `t.<code>.` | Every system keys values by a permanent identifier: IFC property names within a pset [C3], bSDD `Code` "used as an identifier in IFC models" [C22], Revit's shared parameters [C49], IFC 5 `bsi::ifc::prop::FireRating` [C48]. **Never renamed or reused.** |
| `version`, `status`, `replaces` / `replaced_by`, `deprecation_note` | Integer version; Preview / Active / Inactive; links to a successor | bSDD `Status`, `VersionNumber`, `ReplacedObjectCodes`, `ReplacingObjectCodes`, `DeprecationExplanation` [C22]. Rule, after iTwin [C55]: labels, descriptions and display units may change in place (a minor change); a change of type, unit dimension or meaning is a **new key** that `replaces` the old one. |
| `data_type` | boolean, integer, decimal, text, date, duration, enum, reference, list | bSDD's six types plus a decimal (data-model §2: nothing that feeds a figure is a float); IFC measure types map from it [C5]. |
| `value_kind` | single, range, list | bSDD `PropertyValueKind` [C22]; IFC bounded and list values [C5]. |
| `dimension`, `quantity_kind`, `storage_unit` | ISO 80000 exponent vector (L M T I Θ N J), e.g. length `1 0 0 0 0 0 0`; `length`, `area`, `volume`, `mass`, `duration`, `money`, `ratio`, `dimensionless`; the SI unit it is stored in (`m`, `m2`, `kg`…); money stores no unit and takes its currency from the Project (sibling doc, item 6) | bSDD `Dimension` and `PhysicalQuantity` [C22]; IDS converts IFC values to SI by these same exponents [C47]; iTwin's persistence unit [C54]; ADR 0008 (SI inside `building_model`, Display Units outside). |
| `allowed_values` | For enums: a code per value, with labels | bSDD `AllowedValue.Code`, "the information to be used as an identifier in IFC models" [C22]; IFC enumerators [C5]. |
| `labels`, `definitions` | Per language: `{"en": "Section width", "bn": …}`; English required | bSDD: names and definitions are translatable, one file per language [C22]; ISO 12006-3 is said to require the English term [C23] (Medium: the page is a draft). Tenant-defined attributes cannot live in a code message catalogue, so labels are data. |
| `families` (through an applicability row) | Which Element Families it applies to, whether required, sort order, a per-family override of allowed values or range, and `level` (occurrence or type) | bSDD `ClassProperty` with `IsRequired`, `PredefinedValue`, overriding allowed values [C22]; IFC `ApplicableEntity` and type-driven override [C4][C6]; COBie's Type and Component split [C35]. |
| `life_phases` | Which of As designed, As built, As maintained may hold a value, and who writes each (a Confirmation; a site record; a maintenance record) | ADR 0035. COBie's field rules do exactly this: `ModelNumber`, warranty and serial fields are "not applicable" in planning and design and filled in construction and handover [C35][C36]. |
| `deviation_tolerance` | Absolute or relative, for comparing As built or As maintained with As designed | ADR 0035 defines a Deviation "beyond a tolerance"; ISO 23386 gives a property a "Tolerance" attribute [C23]; iTwin `relativeError` [C54]. |
| `derived` | True for quantities the engine computes (volume, area); such values are never stored as facts | ADR 0031 §1 (measuring is a pure function); iTwin's rule against storing derived data [C57]; IFC calls quantities "derived measures" [C7]. |
| `source`, `source_ref` | Who defines it (Vextrus Library, IFC 4.3, a market authority, the tenant) and a URI | bSDD `DocumentReference`, `OwnedUri`, `CountryOfOrigin` [C22]. |
| `market_scope` | Empty (global) or a list of market codes | bSDD `CountriesOfUse`, `SubdivisionsOfUse` [C22]; Dubai's permit attributes (`RecycledConcreteRatio`…) exist only in its dictionary [C26]. |
| `ifc` (one or more mapping rows) | IFC version, entity and predefined type, property-set name, property name, IFC measure type, and the bSDD URI of the IFC property | IFC psets and qtos per class [C20]; bSDD `PropertyUri`, e.g. `…/ifc/4.3/prop/LoadBearing` [C22]; Dubai maps by exactly these URIs [C26]. Our own sets are named without `Pset_` or `Qto_` (e.g. `Vextrus_ColumnDesign`) [C3]. |
| `method_of_measurement` | For quantity kinds: `BaseQuantities` (geometric, IFC) or a Rule Set and its version (IS 1200 with PWD's conventions) | `IfcElementQuantity.MethodOfMeasurement`; several quantity sets per element, one per method [C7]. |

**Classification is not a field of the Attribute Definition.** It classifies the Element (and the
Family by default): a `ClassificationSystem` (name, publisher, edition, date, licence, attribution,
may-ship flag, URI) and `ClassificationReference` rows (system, edition, code, name, URI), attached
to a Family as its default and to an Element when it differs. This is IFC's "lightweight
classification", an identification such as the Uniclass notation "L6814" plus a link, without
shipping the table [C8][C9][C10]. IFC 5 does the same with a `code` and a bSDD `uri` [C48].

### 1.4 How the values are held in Postgres (the recommended shape)

- **As designed values stay where `docs/data-model.md` §3.3 puts family facts:** `ElementState.params`
  JSONB, in SI, numbers as decimal strings. The change is that **every key in `params` must be the
  key of an Active Attribute Definition that applies to the Element's Family**, checked by the
  confirm service when it writes (and by a CI test over fixtures). Facts every query needs stay typed
  columns, as they are today (Storey Band, grid reference, position, Mix, Rebar Basis). A JSONB key
  is promoted to a column only when a slow query is measured.
  - Why JSONB here and not EAV: Element States are append-only and written only by a Confirmation,
    and the engine reads all of an Element's facts at once to measure it (ADR 0031 §1). A document
    per state fits that. PostgreSQL's own advice is that each JSON document be "an atomic datum"
    because "any update acquires a row-level lock on the whole row" [C60]; append-only states are
    never updated except for `valid_to_seq`.
- **As built and As maintained values are one append-only row per recorded value**: Element, key,
  Life Phase, value (typed as its definition says), the recorded act that wrote it (who, when, the
  evidence), and its validity. This is EAV-shaped on purpose. Each value arrives alone, from a
  different person on a different day, with its own evidence (ADR 0035), and values are sparse (a
  warranty on a lift, not on 86 columns). Writing them never touches the As designed rows. Its volume
  and query speed are unmeasured.
- **Indexing, from PostgreSQL 16's documentation:**
  - A GIN index with `jsonb_path_ops` serves containment (`params @> '{"vx.concrete.strength_class":"C30"}'`).
    It is "usually much smaller" and more specific than the default `jsonb_ops`, but it cannot answer
    "does this key exist" [C60].
  - For a hot key, an expression index, or `CREATE STATISTICS` on the expression. The statistics
    give "benefits similar to an expression index without the overhead of index maintenance" [C61];
    expression indexes cost time on every insert [C62]. This partly answers the 2016 complaint that
    "PostgreSQL doesn't know how to keep statistics on the values of fields within JSONB columns"
    [C65]; whether it is enough here is unmeasured.
  - Documents over about 2 kB are TOASTed, compressed and moved out of line. Slab polygons may
    cross that line [C63]. Unmeasured.
  - Keep decimal strings inside JSONB. PostgreSQL stores JSONB numbers as `numeric`, which is exact,
    but warns that systems reading JSON as IEEE doubles lose precision [C60], and the SPA and export
    libraries are such systems.
- **Identity.** `Element.id` (UUIDv7, data-model §2) is the IFC `GlobalId`, encoded in IFC's
  22-character form [C12]. A UUIDv7 is a 128-bit UUID, as IFC's GUID is [C12][C14]. Anything the
  export must split out of one Element (a bar mark's bars, a door leaf in an opening) gets a
  deterministic id derived from the Element's id and a local name, never a random one, so a
  re-export gives the same GUIDs. Autodesk's exporter does the same with a sub-element index [C51].
  A Revision that keeps the Element (ADR 0015) keeps the GUID; a new Element means a new GUID, as
  COBie's merge rule expects [C36].

### 1.5 What must exist when

| When | What | Cost now | Cost if left |
|---|---|---|---|
| **M0** (the data spine; M0 itself writes no Element, since storeys are confirmed from M1 (`docs/milestones.md`), so these land with `building_model`'s first migration, in M0 or at the latest in M1's first ticket) | 1. `AttributeDefinition` and `FamilyAttribute` tables in the Library tenant (L policy), with the fields of §1.3, empty. | Two small tables and a migration. | Every JSONB key written before they exist has to be found, renamed and back-filled. |
| M0 | 2. **The key rule:** namespaced, permanent, never renamed or reused; a change of meaning is a new key with `replaces`. Written into `docs/architecture.md`. | A paragraph. | Renames scatter through `params`, exports, caches and Issued Estimates, all append-only. |
| M0 | 3. **The write-time validator** in the confirm service: key exists, applies to the Family, is Active; value type, dimension, range and allowed values; Life Phase allowed. | Small, pure, testable (engine-side). | Silent junk in append-only rows that cannot be edited. |
| M0 | 4. **The Life Phase on every value path** (ADR 0035 says the data carries it from M0): As designed in `ElementState.params`; the append-only phase-value table created, empty. | One table. | A later migration of every value. |
| M0 | 5. **The identity function** `element_id → IFC GlobalId` and the rule for derived sub-ids, with a test that two exports of the same Model Version give identical GUIDs. | Tens of lines. | GUIDs that change on each export break every COBie merge and every FM system that imported them [C13][C36]. |
| M0 | 6. `ClassificationSystem` and `ClassificationReference` tables; the only system populated is our own Element Family list. | Two small tables. | A classification column bolted on later, then a second for the next system. |
| **M1** | 7. The As designed Attribute Definitions for M1's families (sections, levels, Mix, strength class, cover, load-bearing, Storey Band facts), each with its IFC mapping row (§9). | Content work per Takeoff Step. | — (this is M1's content, not a structure). |
| M1 | 8. The IFC export reads the mapping rows (IFC 4.3, `Pset_*Common` + `Pset_ConcreteElementGeneral` + `Qto_*BaseQuantities` + our own sets), and ADR 0031's validation gate checks names against the IFC 4.3 dictionary [C20]. | Part of the export ticket. | A second, hard-coded mapping inside the exporter. |
| M1 | 9. Uniclass 2015 default references for M1's Families (§9), shipped unmodified, attributed, with the edition. | A data file. | None, if it waits; it is cheap now and useful in the Gulf. |
| Later (cost control) | As built definitions (actual pour date, actual grade, actual section), recorded acts with evidence, Deviation checks. | — | — |
| Later (after-sales and FM) | As maintained definitions from `Pset_Warranty`, `Pset_ServiceLife`, `Pset_Condition`, `Pset_ManufacturerTypeInformation`, `Pset_ManufacturerOccurrence` [C20] and COBie's Type, Component and Job fields [C35]; an Element Type table (type-level values, occurrence overrides [C18]); `IfcAsset` groupings [C19]; a COBie export. | — | — |
| Later (a market) | That market's dictionary imported as Attribute Definitions with `market_scope` (Dubai publishes one in bSDD [C26]); IDS checks [C47]; OmniClass or MasterFormat only after a licence review (§5.2). | — | — |

### 1.6 Risks

1. **Key drift.** Renaming a key orphans every value written under it, and Element States and
   Issued Estimates are append-only. The key rule (item 2) and the validator (item 3) are the
   defence. bSDD and iTwin both treat a rename as a replacement or a major change [C22][C55].
2. **Mapping errors propagate.** The Dubai example shows a mapping can put an IFC property in a set IFC
   does not put it in (`Pset_ColumnCommon.Capacity`, `Qto_ColumnBaseQuantities.Area`) [C26], so the check
   tests the set-plus-property pair, not the property URI alone. A CI check against bSDD's IFC 4.3 dictionary catches this. Note that the IFC 4.3
   dictionary itself is listed as "Preview" in bSDD [C24].
3. **Standards are moving under us.**
   - ISO 19650-1 and -2 are "to be revised". A draft 19650-2, "Information management process",
     replaces both the delivery-phase part (-2) and the operational part (-3), and is at the
     "decision to redraft" stage [C31][C34].
   - ISO 23387:2020 is withdrawn; its 2025 edition replaced it [C28].
   - A revision of ISO 12006-2 was abandoned; the 2015 edition stands [C29][C34].
   - IFC 5 is an alpha that says "not suitable for production use" and asks for no derivatives [C48].
   - Keeping IFC as an export (data-model §3.3) and definitions as data absorbs these changes.
4. **Licences.**
   - Uniclass is CC BY-ND: it may be shipped and used commercially, with attribution, but our own
     codes must not be added to its tables [C38][C39].
   - OmniClass's EULA forbids, without CSI's written approval, redistributing it "through a web
     service or by access to an application programming interface", publishing crosswalks to other
     systems (making one privately is not barred), and selling "information products that use OmniClass
     numbers and titles" [C40]. CSI's current download licence (Version 4/1/2022) is stricter: never
     "Incorporate all or any portion of the CSI Product into commercial construction software or other
     information products" without written permission [C40b]. A hosted product showing OmniClass codes
     needs that approval.
   - MasterFormat's numbers, titles and taxonomy were held not protected by copyright in one US
     court [C42]; the trademarks remain.
5. **Granularity.** iTwin warns that one real thing modelled at two granularities, or from two
   perspectives, needs two identities [C52]. A Dhaka owners' association may maintain "the lift" or
   "the water pump set", which are groups of Elements. That is `IfcAsset` ("generally the level of
   granularity at which maintenance operations are undertaken") [C19], a later grouping with its own
   id, not a change to the Element.
6. **JSONB's known costs** (planner estimates, whole-row locks, TOAST) are documented [C60][C61][C63]
   but unmeasured on our shapes. The sibling prototype decides.
7. **Over-building.** COBie itself warns against collecting data nobody uses ("it may not be useful to
   spend the effort collecting the serial number for every light fixture") [C35]. The structure
   costs little; the O&M content should wait for a buyer's list.

### 1.7 Questions for the owner (one at a time; my recommendation first)

1. **Adopt the Attribute Definition as the only way an Element carries a fact beyond its typed
   core?** Recommendation: yes, before the first Element is written (M0's data spine), with the key
   rule, the validator and Library scope.
   Reason: a key renamed or invented later cannot be repaired in append-only data.
2. **Ship Uniclass 2015 references for M1's Families?** Recommendation: yes, as references only
   (system, edition, code, URI), attributed, CC BY-ND. Reason: it is free to ship, it is the only
   system a Gulf authority names in writing among the sources read (Qatar's Ashghal [C44]), and it
   costs a data file.
3. **Leave OmniClass and MasterFormat out until a US or Canadian customer asks?** Recommendation:
   yes. Reason: OmniClass's EULA restricts exactly what a hosted product does [C40], and the
   MasterFormat ruling is one district court's, possibly appealed [C42].

---

## 2. IFC 4.3 (ISO 16739-1:2024)

**Status.** ISO 16739-1:2024 was published on 22 Mar 2024 and replaced the 2018 edition. Its scope
includes "the property and quantity set definitions" and adds infrastructure (bridges, roads,
railways, waterways, ports) [C1][C33]. IFC is licensed CC BY-ND 4.0 [C21]. High.

### 2.1 Property sets, templates, type and occurrence

- An `IfcPropertySet` "is a container that holds properties … interpreted according to their name
  attribute". The name `Pset_Xxx` is reserved for sets defined in the standard; "Property sets that are
  not declared as part of the IFC specification shall have a Name value not including the 'Pset_'
  prefix". Property names within a set must be unique (`UniquePropertyNames`) [C3]. High.
- A set can attach to an occurrence (through `IfcRelDefinesByProperties`) or to a type, where it "is
  shared among all occurrences of the same object type". A classification or library can also be
  associated with the set itself [C3]. High.
- Type and occurrence: "If a property having the same name is used within the IfcPropertySet assigned
  to an IfcTypeObject … and to an occurrence of that type, then the occurrence property overrides the
  type property" [C18]. The template type says which is allowed: `PSET_TYPEDRIVENONLY`,
  `PSET_TYPEDRIVENOVERRIDE`, `PSET_OCCURRENCEDRIVEN`, `PSET_PERFORMANCEDRIVEN` and the `QTO_*`
  equivalents [C6]. High.
- **Definitions as data.** `IfcPropertySetTemplate` defines a set's name, the entities it applies to
  (`ApplicableEntity`, e.g. `IfcBoilerType/STEAM`, comma-separated) and its property templates. It is
  declared in a project library [C4]. An `IfcSimplePropertyTemplate` carries a template type (single,
  enumerated, bounded, list, table or reference value; or a length, area, volume, count, weight or
  time quantity), primary and secondary measure types, units, enumerators and, for quantities, "the
  formula to be used to calculate the quantity". It links to property values **by name only**: "There
  is no direct link between an IfcSimplePropertyTemplate and a subtype of … IfcSimpleProperty … The
  definition relationship … is established by the Name attributes" [C5]. High.
  - The implication for us: IFC's own design is "definition as data, value keyed by the
    definition's name". Our Attribute Definition plays the template's role, and the IFC mapping row
    supplies the name.

### 2.2 Quantity sets and the method of measurement

- `IfcElementQuantity` holds "derived measures of an element's physical property". Its
  `MethodOfMeasurement` names the standard used. "Several instances of IfcElementQuantity are
  assignable to an element, thus allowing for an element having quantities generated according to
  several methods of measurement" (the example is the German DIN 277-2 beside a housing regulation).
  Base quantities (`Qto_*BaseQuantities`, method `'BaseQuantities'`) are "independent of a particular
  method of measurement and therefore internationally applicable" [C7]. High.
- For Vextrus this means the export can carry both geometric base quantities and the QS's measured
  quantities, labelled with the Rule Set and its version, as two quantity sets on the same Element.
  That keeps IS 1200 figures honest in IFC. Medium (inference).

### 2.3 What IFC 4.3 defines for our families

Read from buildingSMART's bSDD API for the IFC 4.3 dictionary [C20], and checked against the source
tree [C2]. Every one of these classes also carries about 20 generic sets (environmental, condition,
maintenance, warranty, manufacturer, tolerance, risk) and 218–248 properties in all.

| IFC class (predefined types that fit Dhaka RCC) | `Pset_*Common` | Quantity set | Other sets that matter to us |
|---|---|---|---|
| `IfcColumn` (`COLUMN`) | FireRating, IsExternal, LoadBearing, Roll, Slope, Status, ThermalTransmittance | `Qto_ColumnBaseQuantities`: CrossSectionArea, Gross/NetSurfaceArea, OuterSurfaceArea, Gross/NetVolume, Gross/NetWeight, Length | `Pset_ConcreteElementGeneral` (13: StrengthClass, ExposureClass, ConcreteCover, ConcreteCoverAtMainBars, ConcreteCoverAtLinks, CastingMethod `INSITU`/`PRECAST`…, ReinforcementVolumeRatio, ReinforcementAreaRatio, ReinforcementStrengthClass…); `Pset_ReinforcementBarPitchOfColumn` |
| `IfcBeam` (`BEAM`, `T_BEAM`, `LINTEL`, `EDGEBEAM`) | as column, plus Span | `Qto_BeamBaseQuantities` (same 9 as column) | `Pset_ConcreteElementGeneral`; `Pset_ReinforcementBarPitchOfBeam` |
| `IfcSlab` (`FLOOR`, `ROOF`, `LANDING`, `BASESLAB`) | AcousticRating, Combustible, Compartmentation, FireRating, IsExternal, LoadBearing, PitchAngle, Status, SurfaceSpreadOfFlame, ThermalTransmittance | `Qto_SlabBaseQuantities`: Depth, Gross/NetArea, Gross/NetVolume, Gross/NetWeight, Length, Perimeter, Width | `Pset_ConcreteElementGeneral`; `Pset_ReinforcementBarPitchOfSlab` |
| `IfcWall` (`SHEAR`, `PARTITIONING`, `PARAPET`, `RETAININGWALL`, `SOLIDWALL`) | as slab, plus ExtendToStructure, without PitchAngle | `Qto_WallBaseQuantities`: Gross/NetFootPrintArea, Gross/NetSideArea, Gross/NetVolume, Gross/NetWeight, Height, Length, Width | `Pset_ConcreteElementGeneral` (shear walls); `Pset_ReinforcementBarPitchOfWall` |
| `IfcDoor`, `IfcWindow` | 18 and 16 properties (fire, acoustic, security, glazing fraction, IsExternal, Status…) | `Qto_DoorBaseQuantities`, `Qto_WindowBaseQuantities`: Area, Height, Perimeter, Width | lining and panel property sets |
| `IfcStair` (many shapes), `IfcStairFlight` | `Pset_StairCommon` (18: NumberOfRiser, NumberOfTreads, RiserHeight, TreadLength, WaistThickness, RequiredHeadroom…); `Pset_StairFlightCommon` (11) | **none for `IfcStair`**; `Qto_StairFlightBaseQuantities`: GrossVolume, Length, NetVolume | `Pset_ConcreteElementGeneral` |
| `IfcPile` (`BORED`, `DRIVEN`, `FRICTION`…) | LoadBearing, Status | `Qto_PileBaseQuantities` (8, including Length, CrossSectionArea, Gross/NetVolume) | `Pset_ConcreteElementGeneral` |
| `IfcFooting` (`PILE_CAP`, `PAD_FOOTING`, `STRIP_FOOTING`, `FOOTING_BEAM`) | LoadBearing, Status | `Qto_FootingBaseQuantities` (10, including Height, Length, Width, Gross/NetVolume) | `Pset_ReinforcementBarCountOfIndependentFooting`, `…PitchOfContinuousFooting` |

Predefined types are from the enumerations in the source tree [C2]. Two fits worth noting: IFC names
a pile cap (`IfcFooting` `PILE_CAP`), a grade beam (`FOOTING_BEAM`) and a landing (`IfcSlab`
`LANDING`), all Dhaka staples; and it has no base quantity set for a whole stair, only for a flight.
High.

**The O&M sets, from the same dictionary** [C20], all available on every class above:
`Pset_Warranty` (WarrantyIdentifier, WarrantyStartDate, WarrantyPeriod, IsExtendedWarranty,
PointOfContact, WarrantyContent, Exclusions); `Pset_ServiceLife` (ServiceLifeDuration,
MeanTimeBetweenFailure); `Pset_Condition` (8, assessment date, condition, next assessment…);
`Pset_ManufacturerTypeInformation` (10, Manufacturer, ModelReference, ModelLabel, GlobalTradeItemNumber,
ProductionYear…); `Pset_ManufacturerOccurrence` (SerialNumber, BarCode, BatchReference,
ManufacturingDate, AcquisitionDate, AssemblyPlace); `Pset_InstallationOccurrence` (InstallationDate,
AcceptanceDate, PutIntoOperationDate); `Pset_MaintenanceStrategy` (AssetCriticality, AssetFrailty,
AssetPriority, MonitoringType, AccidentResponse). High.

### 2.4 Classification references

- `IfcClassification` names a system (Source, Edition, EditionDate, Name, Specification URI, and the
  tokens that separate a code's facets). Its note lists "Omniclass, Uniclass, Masterformat, or DIN277"
  as examples [C9]. High.
- `IfcClassificationReference` holds `Identification` (the code), `Name`, and `Location` (a URI into the
  system). It can point straight at the system ("lightweight classification") or at its parent code
  ("full classification"). IFC's own example is Uniclass "L6814" "Tanking" as a lightweight reference
  that "would remove the need for the overhead of the more complete classification structure" [C8].
  High.
- `IfcRelAssociatesClassification` attaches a reference to occurrences or types [C10]. High.

### 2.5 Identity: `GlobalId`

- `IfcRoot.GlobalId`: "Assignment of a globally unique identifier within the entire software world"
  [C11]. It is a 128-bit GUID compressed to 22 characters with IFC's own base-64 alphabet [C12][C14].
- IFC's "Software Identity" concept: "the IFC-GUID is normally generated automatically **and has to be
  persistent**". The STEP file's `#123` instance number "is *not* intended as a stable identifier
  across repeated exchanges or reserializations" [C13]. High.
- `IfcOwnerHistory` keeps only the last change ("Only the last modification is stored") [C11][C15],
  so IFC files are not a history store. That matches keeping history in our tables. High.
- The Revit exporter's source shows what persistence costs a tool whose native ids are not IFC's:
  it derives the GUID from the element, lets the built-in `IFC_GUID` parameter override it, and can
  write the GUID back to the element (`StoreIFCGUID`) [C51]. Vextrus avoids that by making the Element's
  UUID the GUID. High (source code); Medium (the inference).

### 2.6 Life phases in IFC

IFC has no per-value "as designed / as built / as maintained" layer. What it has:
- `IfcContext.Phase` (on the project): "Current project phase, or life-cycle phase of this project.
  Applicable values have to be agreed upon by view definitions or implementer agreements" [C16].
- `Status` in every `Pset_*Common`: NEW, EXISTING, DEMOLISH, TEMPORARY, OTHER, NOTKNOWN, UNSET, "used
  in renovation or retrofitting projects" [C20]. It is not a Life Phase.
- `IfcPerformanceHistory.LifeCyclePhase` (typical values DESIGNDEVELOPMENT, CONSTRUCTIONDOCUMENT,
  CONSTRUCTION, ASBUILT, COMMISSIONING, OPERATION…) for time-series performance data attached to an
  object [C17].
- `Pset_EnvironmentalImpactIndicators.LifeCyclePhase` for LCA data [C20].

So an IFC export states one Life Phase per file, most simply "As designed", or "as built where
recorded" (ADR 0035), named in the project's `Phase`. Our tables keep all three. Medium (inference).

### 2.7 Where IFC is heading (IFC 5, alpha)

The IFC 5 alpha repository (last pushed 8 Sep 2026) calls its examples "preliminary", "not suitable
for production use", and asks readers not to create derivatives [C48]. Its files show the shape:
a `schemas` block declares an attribute key (`bsi::ifc::prop::FireRating`, data type `Enum`, options
`R30`/`R60`), and a `data` block adds `{"path": "<uuid>", "attributes": {"bsi::ifc::prop::FireRating":
"R30"}}` as a layer over an existing object. A classification is an attribute holding a `code` and
a bSDD `uri` [C48]. This is the pattern of §1.3: namespaced keys, definitions as data, values keyed
to a stable UUID. Medium: an alpha.

---

## 3. Attribute definitions as data: bSDD, ISO 23386 / 23387, ISO 12006

| Standard | Status (ISO open data [C33]) | What it gives us |
|---|---|---|
| ISO 23386:2020 | Published 12 Mar 2020; confirmed (90.93) | "rules for defining properties … as a list of attributes" and a methodology for authoring, maintaining and mapping them between interconnected dictionaries; no content [C27] |
| ISO 23387:2025 | Published 22 Sep 2025; the 2020 edition is withdrawn | data templates for any object across the life cycle, implemented per ISO 12006-3, with an XSD, and "guidance for linking between data templates and classification systems" [C28] |
| ISO 12006-3:2022 | Published 15 Jul 2022 | "a language-independent information model … for the development of dictionaries", plus "an API allowing the interconnection of data dictionaries as described in ISO 23386" [C30] |
| ISO 12006-2:2015 | Confirmed; a revision (ISO/DIS 12006-2, "… classification and breakdown structures") is at 40.98, "decision to abandon project" [C29][C34] | a framework and recommended table titles for classification systems, "applies to the complete life cycle"; "does not provide … the content of the tables" [C29] |

**bSDD's data model** (buildingSMART's implementation of ISO 12006-3 and ISO 23386) [C22]:
- A **Property** has `Code` (the identifier used in IFC models), a translatable `Name`, `Definition`
  and `Example`, a `DataType` (Boolean, Character, Integer, Real, String, Time), `Units` (ISO 80000,
  ISO 4217, ISO 8601), a `Dimension` as seven ISO 80000 exponents ("speed (m/s) would be denoted as
  '1 0 -1 0 0 0 0'"), `PhysicalQuantity`, `PropertyValueKind`, `AllowedValues` (each with a `Code`),
  Min/Max, a `Pattern`, `MethodOfMeasurement`, `CountriesOfUse`, `CountryOfOrigin`, `Status`,
  `VersionNumber`, activation and deactivation dates, replaced and replacing codes, and a deprecation
  explanation. High.
- A **ClassProperty** attaches a Property to a Class with a `PropertySet` ("The prefix 'Pset_' is
  reserved for the official IFC"), `IsRequired`, `PredefinedValue`, `Unit`, and overriding allowed
  values and bounds. High.
- A **Dictionary** has a semantic version and a language; "If you want to deliver data in multiple
  languages, use a JSON file per language". A "latest" URI exists, but "it is not an immutable URI …
  For contractual agreements, we suggest using specific version numbers". High.
- The mapping page says ISO versions each concept individually, while bSDD versions the whole
  dictionary on every change, "to support contractual agreements"; and that ISO 12006-3 requires the
  English term. The page marks itself as a draft [C23]. Medium.

**What bSDD holds today** (its dictionary API, 427 dictionaries) [C24]: IFC 4.3 (status Preview,
CC BY-ND 4.0); Uniclass 2015 by NBS (Preview, CC BY-ND 4.0, 14,328 classes: Pr 7,547, Ss 2,272,
EF 81, …); ETIM; Molio's CCI Construction (MIT); Dubai Municipality's permit requirements (§5.3). No
OmniClass or MasterFormat. High.

**IDS** (Information Delivery Specification) states requirements as specifications made of facets
(entity, attribute, classification, property, material, partOf). Numeric values in an IDS are SI, and
its units table converts each IFC measure type by the same seven dimension exponents [C47]. Dubai
publishes its requirements as IDS as well as bSDD [C43]. High. An Attribute Definition with
`dimension` and `ifc` mapping can be written out as an IDS later; nothing in M0 depends on it.

---

## 4. COBie: the minimum O&M data and who fills it

- **Versions.** COBie 2.4 is NBIMS-US V3 §4.2 (2015) [C36]. COBie V3 "was published as part of NIBS
  NBIMS-US V4" in 2023 [C35]. In the UK, BS 1192-4:2014 (COBie code of practice) is listed as
  withdrawn and superseded by BS EN ISO 19650-4:2022 [C37]; Qatar's Ashghal guide (17 Mar 2022) still
  cites it [C44]. High.
- **Purpose.** "a combined set of all space, product, and equipment schedules found on associated
  design drawings as well as a compilation of as-built, operations & maintenance (O&M), and
  commissioning information captured during construction", delivered "at specified milestones …
  culminating in a full delivery at project handover" [C35]. Its scope is the "maintainable assets
  … mechanical equipment, electrical equipment, plumbing fixtures, and other items that require
  maintenance, upkeep, and replacement" [C35]. So a lift, a pump or a door is a COBie asset and a
  column is not (my reading). High (the text).
- **Type (V3)**, a required table; its fields: Name, Description, Category (e.g. OmniClass `23-33 11 22` or Uniclass
  `Pr_60_60_08_27`), AssetType (Fixed/Moveable), Manufacturer, ModelNumber, WarrantyGuarantorParts,
  WarrantyDurationParts, WarrantyGuarantorLabor, WarrantyDurationLabor, WarrantyDurationUnit,
  ModelReference, NominalLength/Width/Height/Weight, PurchaseCost, WarrantyDescription. "Do not add
  custom data fields to this data table … Use the Attribute data table for this" [C35]. High.
- **Component (V3)**: Name, Description, AssetIdentifier, BarCode, SerialNumber, TagNumber, Type.Name,
  Space.Name, InstallationDate, WarrantyStartDate [C35]. High.
- **Job, Resource, Event, Package, Risk (V3)**: a Job is the work "to operate, maintain, start up, shut
  down, or troubleshoot a given Component", with task number, duration, interval, priors and resources.
  V3 removed the Spare, Assembly and Connection tables ("not often used") and Impact ("impacts can be
  transmitted as Attributes") [C35]. COBie 2.4 had
  a Spare sheet (parts, lubricants) and Job categories such as PM, Inspection, Calibration [C36]. High.
- **Expected life and replacement cost** exist in COBie 2.4: `Type.ReplacementCost` is "during
  construction and handover phase: The manufacture's suggested retail price"; `Type.ExpectedLife` is
  "during handover phase: the expected service life … During planning, design, and construction
  phase: left blank unless conducting total cost of ownership studies" [C36]. V3's Type table does not
  list them (§0.8). High for 2.4; Medium for V3's omission.
- **Who fills what, when.** V3 maps tables to OmniClass Table 31 phases: Type from criteria
  definition, Component from design, serial numbers and installation dates in implementation, and
  Resource, Job, Event and Package at handover and in operations [C35]. Its example:
  "the designer is responsible for updating the name, type, and location of equipment during the
  Design Phase at CD-2, while the constructor is responsible for updating the manufacturer, model
  number, and serial number information during the Implementation Phase at 120 days prior to
  substantial completion" [C35]. Field rules say the same: manufacturer, model, warranty and serial
  fields are "not applicable" during planning and design [C35][C36]. High.
- **Identity through the hand-over.** COBie's `ExtIdentifier` "Indicates the GUID of the object …
  mapping to IfcRoot.GlobalId … If merging changes upon import, such identifier shall be used to
  identify an existing object (i.e. this maintains identity if an object is renamed)" [C36]. High.

**For Vextrus:** As designed can supply COBie's space and type skeleton (names, categories, locations,
counts) from the drawings. Everything a manufacturer or installer knows is As built or As maintained,
which ADR 0035 already assigns to recorded acts. This is COBie's own field rule [C35][C36]. The
`life_phases` field of §1.3 is where that rule lives in our data.

---

## 5. Classification systems, licences and markets

### 5.1 The systems

- **ISO 12006-2** is the framework; systems implement it for their region [C29]. The UK BIM Framework's
  guidance: "ISO 19650-1:2018 recommends that classification is in line with ISO 12006-2 … in the UK
  this classification system is Uniclass 2015 … Object information should be in line with ISO
  12006-3" [C45]. High.
- **Uniclass 2015** (NBS): 15 tables: Ac, Co, En, SL, EF, Ss, Pr, TE, PM, Ro, RK, Ma, PC, FI, Zz. Updated
  quarterly; the latest release is 1 Jul 2026 [C38]. Codes are two letters and up to four pairs of
  digits (`Ss_45_40_47_28`); it complies with ISO 12006-2 [C39]. High.
- **OmniClass** (CSI): 15 tables, 13 adopted by NBIMS-US; Table 21 (Elements) draws on UniFormat,
  Table 22 (Work Results) on MasterFormat, Table 23 (Products) on EPIC; based on ISO 12006-2:2001 [C41].
  COBie 2.4 defaults `Type.Category` to OmniClass Table 23 [C36]. High.
- **MasterFormat and UniFormat** (CSI): see licences.

### 5.2 Can a commercial product ship the codes?

| System | Licence (primary source) | For a hosted product like Vextrus |
|---|---|---|
| IFC 4.3 names and sets | CC BY-ND 4.0 [C21] | Using the names in exports is the purpose; we do not republish the standard. High. |
| Uniclass 2015 | CC BY-ND 4.0: "share and apply the tables on any kind of personal or commercial project"; users "should not adapt the tables and add their own codes, but instead contact NBS" [C38][C39] | **Yes**, codes unmodified, attributed, with the edition. Our own codes go in our own system, never inside Uniclass. High. |
| OmniClass | EULA 2019-07-01: commercial use "for classification and other forms of construction documentation" is granted, but without written approval you must never "Redistribute publicly … through a web service or by access to an application programming interface", publish "information that relates or corresponds OmniClass classifications to classifications … in other standards", or "Provide, license or sell commercial … information products that use OmniClass numbers and titles"; show numbers "exactly", with the link, the copyright notice and the version [C40] | **Only with CSI's written approval.** A SaaS that shows codes, offers an API or maps OmniClass to Uniclass is squarely in the list. High (the text); the legal effect is a lawyer's call. |
| MasterFormat | *CSI v. Zerodocs.com*, C.D. Cal. 8:25-cv-00475, order on summary judgment (ECF 74) and judgment (ECF 75), 1 Sep 2026: "the divisions, numbers, and titles of the MasterFormat are short phrases, and, therefore, they are not protected elements"; "CSI's MasterFormat taxonomy is not a protected element"; Zerodocs's use of the CSI mark was nominative fair use; judgment for Zerodocs on every claim [C42] | In the US, the bare numbers and titles look usable after this ruling. It is one district court, possibly appealed, and says nothing of other countries or of CSI's descriptive text. **Wait for a US customer and a lawyer.** High (the order); Low (its reach). |
| Our own Element Family list | ours | The first `ClassificationSystem` row, from M0. |

### 5.3 Do our markets prescribe a system?

- **Dubai.** Dubai Municipality mandated BIM submissions for new building permits from 1 Jan 2024
  (circular 9-1-2, Oct 2023) for government projects, buildings over twenty floors, projects over
  20,000 m² and specialised buildings; CAD drawings are still required; "BIM information requirements
  and quality checks are published as Excel spreadsheets, IDS file and bsDD data dictionary" [C43].
  That dictionary (`dm/DMBIMInfo` 1.0.4) has 273 classes and 135 properties. Its column class maps to
  `IfcColumn` and requires IFC 4.3 properties by their bSDD URIs, plus a "Building Permit" set of its
  own (`CompressiveStrength`, `IfcMaterial`, `RecycledConcreteRatio`, `RecycledSteelRatio`,
  `MaterialPassportCodes`) [C26]. **Dubai prescribes attributes and IFC mapping, not (in what I read)
  a classification system.** High.
- **Qatar (Ashghal, public works).** The ABIMS COBie Template Guide requires Uniclass 2015: Facility
  category "Uniclass 2015 Category En code", Space category Uniclass, "Type.Category Category to follow
  Uniclass 2015(UK)", with Revit's Classification Manager "Uniclass Pr" first and "Uniclass EF" second
  [C44]. It governs Ashghal's own projects, not private developers (my reading). High (the text).
- **Saudi Arabia, India, Bangladesh.** No primary source found that prescribes a classification system
  or an attribute dictionary (§0.5). The mandates playbook has chapters for Australasia, China,
  Czechia, Denmark, Dubai, Japan, Poland, Singapore, Spain, the USA and South Korea only [C43]. China's
  housing ministry began a national "BIM Classification and Coding Standard" among five BIM
  standards in 2012 [C43]; I did not read it. Low (an absence).

**Reading:** where a Gulf authority writes anything, it writes IFC property URIs (Dubai) or Uniclass
(Qatar). An Attribute Definition with IFC mapping rows plus Uniclass references covers both, and a
market's dictionary can be imported from bSDD as definitions with `market_scope`. Medium.

---

## 6. ISO 19650: information requirements and keeping identity

- **Status.** ISO 19650-1 and -2 (Dec 2018) and -3 (Jul 2020) are all at 90.92, "to be revised". The
  drafts are ISO/DIS 19650-1, ISO/DIS 19650-2 "Information management process" (which **replaces both
  19650-2:2018 and 19650-3:2020**) and ISO/DIS 19650-3 "Implementation of the information management
  process", all at 40.93, "decision to redraft" [C31][C34]. ISO 19650-4:2022, -5:2020 and -6:2025 are
  current; ISO 7817-1:2024 (level of information need) is published [C32][C33]. High (status); Medium
  (what the merge will say: the draft's scope text in the open data still reads "delivery phase").
- **The requirement chain.** The UK guidance on ISO 19650-1: three paths, "Project delivery …:
  PIR-EIR-PIM", "Asset management …: OIR-AIR-AIM", and combined "OIR-AIR-EIR-PIM-AIM". The figure's
  key: "A Start of delivery phase – transfer of relevant information from AIM to PIM", "B Progressive
  development of the design intent model into the virtual construction model", "C End of delivery
  phase – transfer of relevant information from PIM to AIM" [C45]. For ISO 19650-3: "B start of
  operational phase — transfer of relevant information from PIM to AIM … Information can be
  transferred between PIM and AIM during the delivery phase as well"; "trigger events" set the tempo
  of operational information [C46]. High (the guidance).
- **Identity.** The operational guidance says an AIR may require "assets and spatial locations to be
  named or tagged using a unique identification code or naming convention, for onward linking or
  importing into an existing enterprise management system (e.g., EDMS, CAFM)" [C46]. High.
- **Level of information need** "should be defined so that information can be read by both people
  and technology for verification … and validation", for example "around a data schema and using
  automated rules" [C45]. High.

**For Vextrus:** ISO 19650 moves information between models (PIM to AIM) at hand-overs. ADR 0035 goes
further: one dataset, one identity, values layered by Life Phase, so there is no transfer to lose
identity in. When a client's AIR asks for their own asset codes, that is an As maintained Attribute
Definition (`t.<client>.asset_code`), not a new identity. The revision in progress, which merges the
delivery and operational processes into one part, points the same way. Medium (inference).

---

## 7. How tools hold custom attributes (documented behaviour only)

- **Revit.** "Shared parameter definitions are stored in a file independent of any family file or
  Revit project"; a parameter must be shared to appear in a tag or in a multi-category schedule
  [C49]. The file is a text file on a network share, organised in groups, one active file per session
  [C50]. That each shared parameter is identified by a GUID is widely stated, but Autodesk's support
  article on it refused access, so it is unverified here (Low). The IFC exporter's source reads and
  writes the built-in `IFC_GUID` parameter to keep an element's IFC GUID [C51]. High for the help text
  and the source.
- **Bentley iTwin (BIS / EC schemas).**
  - Every `Element` may carry a `FederationGuid` that identifies "the real-world Entity that the Element
    represents, not the Element itself"; it lets an element "be deleted and recreated … but it will not
    impact any external systems that reference it"; different granularities and modelling perspectives
    get different FederationGuids [C52].
  - Optional property groups are `ElementAspect`s, owned by exactly one Element: unique or multi, with a
    fixed schema [C53].
  - `KindOfQuantity` sets a property's persistence unit, presentation units and relative error [C54].
  - Schemas are versioned read.write.minor. Adding optional properties or changing labels is minor;
    "Removal of a property", "Renaming", "Changing the type" are major [C55].
  - Ad hoc data goes to `JsonProperties`, whose disadvantages are "No type-safety", "No required data",
    and not being "shown in the User-Interface of generic iTwin.js controls" [C57].
  - Classification is separate from class and type: "Relating an Element to one or more
    Classifications in one or more ClassificationSystems … Examples include Uniclass and OmniClass"
    [C56]. High.
- **Speckle** (specklepy, Apache-2.0): "Objects in Speckle are immutable for storage purposes. When any
  property changes, the object gets a new identity (hash)"; `applicationId` "can store the host
  application's native object ID"; any property can be added dynamically (`obj["custom_prop"] = 42`)
  [C58]. The hash is a SHA-256 of the serialised JSON, cut to 32 hex characters [C58]. Speckle keeps
  two identities: content (hash) and thing (application id). Vextrus has the same two: `facts_hash`
  and `Element.id` (data-model §3.3). High.
- **That Open / web-ifc** (MPL-2.0): properties are read and written through IFC's own relationships
  (`IfcRelDefinesByProperties`, `IfcRelDefinesByType`), addressed by `expressID` [C59]. That is the
  file-local STEP number IFC says is not stable [C13]. So web-ifc is a reader and writer of IFC, not an
  attribute store; the stable key is still `GlobalId`. High.
- **Glodon.** Nothing documented found (§0.9).

**The recurring pattern:** a stable id per thing; a registry of definitions (a file, a schema, a
dictionary) whose entries have permanent ids, types and units; values keyed by those ids; optional
groups; type-level values with occurrence overrides; classification as a separate association; and a
free-form escape hatch that each vendor documents as second-class.

---

## 8. Postgres: what the literature says (measured vs claimed)

| Claim | Source | Kind | Relevance |
|---|---|---|---|
| JSONB is stored decomposed, drops key order and duplicate keys, stores numbers as `numeric`; interchange with double-based systems can lose precision | PostgreSQL 16 docs [C60] | Documented behaviour | Keep decimal strings (data-model §2). |
| "any update acquires a row-level lock on the whole row … keep JSON documents to a manageable size … an atomic datum" | [C60] | Documented advice | Append-only Element States fit; As built and As maintained values go in their own rows. |
| `jsonb_path_ops` GIN is "usually much smaller" and more specific than `jsonb_ops`, supports only `@>`, `@?`, `@@`; targeted expression indexes are "likely to be smaller and faster" than a whole-column GIN | [C60] | Documented | Index shape per query, chosen when a query exists. |
| Expression statistics give "benefits similar to an expression index without the overhead of index maintenance" | PostgreSQL 16 `CREATE STATISTICS` [C61] | Documented (PG 16) | Planner estimates for hot JSONB keys. |
| Index expressions "are relatively expensive to maintain" on insert and non-HOT update | [C62] | Documented | Few, targeted indexes. |
| Rows over about 2 kB are compressed or moved out of line (TOAST); unchanged out-of-line values cost nothing on UPDATE | PostgreSQL 16 TOAST [C63] | Documented | Slab polygons; unmeasured. |
| EAV 6.43 GB vs JSONB 2.08 GB including indexes; `@>` with GIN 0.153 ms, "15000x faster" than EAV; 10 M entities × 5 attributes, PG 9.5, one $80 VM; the author notes it does not cover "entities with a very large number of properties" | coussej blog, 2016 [C64] | Claimed (a blog) | Direction only. |
| "PostgreSQL doesn't know how to keep statistics on the values of fields within JSONB columns"; a hard-coded 0.1 % selectivity led to bad nested-loop plans; pulling 45 common fields out of JSONB saved about 30 % disk | Heap blog, 1 Sep 2016, PG 9.4 [C65] | Claimed (a blog, PG 9.4) | Partly answered by expression statistics [C61]; the "promote hot keys to columns" advice stands. |

**Measured here:** nothing. The sibling prototype's figures on PG 16 decide the index and column
choices.

---

## 9. A sketch for M1's Families (IFC and Uniclass)

Our mapping, for M1 to confirm. IFC classes and predefined types from the IFC 4.3 sources
[C2][C20]; Uniclass codes and names from NBS's bSDD copy, version 1 [C25] (re-check against the
current edition, §0.6). Families are `docs/data-model.md` §3.3's keys.

| Family | IFC entity / predefined type | Uniclass EF | Uniclass Ss (default) | Uniclass Pr (where a product fits) |
|---|---|---|---|---|
| `pile` | `IfcPile` / `BORED` (or `DRIVEN`) | EF_20_05 Substructure | Ss_20_05_65_41 In situ concrete bored piling systems (Ss_20_05_65_24 driven precast) | — |
| `pile_cap` | `IfcFooting` / `PILE_CAP` | EF_20_05 | Ss_20_05_15_71 Reinforced concrete pilecap and ground beam foundation systems | — |
| grade beam (a `beam` at plinth level, or its own Family) | `IfcFooting` / `FOOTING_BEAM` or `IfcBeam` | EF_20_05 | Ss_20_05_15_71 | Pr_20_85_13_35 Concrete ground beams (a product, so precast only; my reading) |
| footing / raft | `IfcFooting` / `PAD_FOOTING`, `STRIP_FOOTING`; `IfcSlab` / `BASESLAB` for a raft | EF_20_05 | Ss_20_05_15_70 RC pad and strip; Ss_20_05_15_72 RC raft | — |
| `column` | `IfcColumn` / `COLUMN` | EF_20_10 Superstructure | Ss_20_30_75_15 Concrete column systems (frame: Ss_20_10_75_70 In situ reinforced concrete framing systems) | Pr_20_85_16_15 Concrete columns |
| `shear_wall`, `lift_core` | `IfcWall` / `SHEAR` | EF_20_10 | Ss_25_11_16 Concrete wall systems | — |
| `beam` | `IfcBeam` / `BEAM` (`T_BEAM`, `LINTEL`, `EDGEBEAM`) | EF_20_10 | Ss_20_20_75_15 Concrete beam systems | — |
| `slab` | `IfcSlab` / `FLOOR`, `ROOF`, `LANDING` | EF_30_20 Floors (EF_30_10 Roofs) | Ss_30_12_85_70 Reinforced concrete floor, roof or balcony deck systems | — |
| `slab_edge` | `IfcBeam` / `EDGEBEAM`, or part of the `IfcSlab` (to decide with the Family) | EF_30_20 | Ss_30_12_85_70 | — |
| `stair` | `IfcStair` + `IfcStairFlight` (+ `IfcSlab` / `LANDING`) | EF_35_10 Stairs | Ss_35_10_85 Structural stair and ramp systems | — |
| `wall` (brick) | `IfcWall` / `PARTITIONING`, `STANDARD`, `PARAPET` | EF_25_10 Walls | Ss_25_13_50 Masonry wall systems | — |
| `opening` (door, window) | `IfcOpeningElement` filled by `IfcDoor` / `IfcWindow` | EF_25_30 Doors and windows | Ss_25_30_20 Door, shutter and hatch systems; Ss_25_30_95 Window systems | — |
| `storey`, `grid_line`, `room` | `IfcBuildingStorey`, `IfcGrid`/`IfcGridAxis`, `IfcSpace` | — | — | (SL table for rooms) |
| Project, Site, Building (ADR 0036) | `IfcProject`, `IfcSite`, `IfcBuilding` | — | Co / En tables | — |

A first set of As designed Attribute Definitions for `column`, as an example of the mapping rows
(IFC names from [C20]):

| Key (ours) | Type, dimension | IFC mapping | Life Phases |
|---|---|---|---|
| `vx.column.section_b`, `vx.column.section_d` | decimal, length (m) | our set `Vextrus_ColumnDesign` (IFC 4.3 has no width or depth property for `IfcColumn` [C20]; in an export the section is the geometry's profile, my reading) | As designed, As built |
| `vx.concrete.strength_class` | enum per market (a label as the design code writes it) | `Pset_ConcreteElementGeneral.StrengthClass` | As designed, As built |
| `vx.concrete.cover_main` | decimal, length | `Pset_ConcreteElementGeneral.ConcreteCoverAtMainBars` | As designed, As built |
| `vx.element.load_bearing` | boolean | `Pset_ColumnCommon.LoadBearing` | As designed |
| `vx.element.is_external` | boolean | `Pset_ColumnCommon.IsExternal` | As designed |
| `vx.concrete.casting_method` | enum (`INSITU`…) | `Pset_ConcreteElementGeneral.CastingMethod` | As designed |
| volume, formwork area | derived; `method_of_measurement` = the Rule Set version | `Qto_ColumnBaseQuantities.NetVolume` (geometric) and our own quantity set with the Rule Set as its method [C7] | — (computed) |
| `vx.site.cast_date` (later) | date | `Pset_InstallationOccurrence.InstallationDate` or our own set | As built |

---

## Sources

IFC (buildingSMART; the rendered site at https://ifc43-docs.standards.buildingsmart.org/ refused
fetches, so the source repository was read)
- [C1] ISO 16739-1:2024 catalogue page (metadata via [C33]): https://www.iso.org/standard/84123.html
- [C2] IFC 4.3 documentation source, branch `ifc4.3-main` at `6754caa287` (24 Sep 2026): https://github.com/buildingSMART/IFC4.x-development/tree/ifc4.3-main
- [C3] IfcPropertySet: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcKernel/Entities/IfcPropertySet.md
- [C4] IfcPropertySetTemplate: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcKernel/Entities/IfcPropertySetTemplate.md
- [C5] IfcSimplePropertyTemplate: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcKernel/Entities/IfcSimplePropertyTemplate.md
- [C6] IfcPropertySetTemplateTypeEnum: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcKernel/Types/IfcPropertySetTemplateTypeEnum.md
- [C7] IfcElementQuantity: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcProductExtension/Entities/IfcElementQuantity.md
- [C8] IfcClassificationReference: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/resource/IfcExternalReferenceResource/Entities/IfcClassificationReference.md
- [C9] IfcClassification: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/resource/IfcExternalReferenceResource/Entities/IfcClassification.md
- [C10] IfcRelAssociatesClassification: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcKernel/Entities/IfcRelAssociatesClassification.md
- [C11] IfcRoot: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcKernel/Entities/IfcRoot.md
- [C12] IfcGloballyUniqueId: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/resource/IfcUtilityResource/Types/IfcGloballyUniqueId.md
- [C13] Concept "Software Identity": https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/templates/Object%20Attributes/Software%20Identity/README.md
- [C14] buildingSMART, IFC GUID: https://github.com/buildingSMART/technical.buildingsmart.org/blob/main/IFC-GUID.md
- [C15] IfcOwnerHistory: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/resource/IfcUtilityResource/Entities/IfcOwnerHistory.md
- [C16] IfcContext (Phase): https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcKernel/Entities/IfcContext.md
- [C17] IfcPerformanceHistory: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcControlExtension/Entities/IfcPerformanceHistory.md
- [C18] IfcTypeObject: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/core/IfcKernel/Entities/IfcTypeObject.md
- [C19] IfcAsset: https://github.com/buildingSMART/IFC4.x-development/blob/ifc4.3-main/docs/schemas/shared/IfcSharedFacilitiesElements/Entities/IfcAsset.md
- [C20] bSDD API, IFC 4.3 dictionary, classes with properties, e.g. https://api.bsdd.buildingsmart.org/api/Class/v1?Uri=https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3/class/IfcColumn&IncludeClassProperties=true (and `IfcBeam`, `IfcSlab`, `IfcWall`, `IfcDoor`, `IfcWindow`, `IfcStair`, `IfcStairFlight`, `IfcPile`, `IfcFooting`), read 27 Sep 2026
- [C21] buildingSMART, IFC introduction and licence (CC BY-ND 4.0): https://github.com/buildingSMART/technical.buildingsmart.org/blob/main/Industry-Foundation-Classes-(IFC).md

bSDD and ISO
- [C22] bSDD JSON import model: https://github.com/buildingSMART/bSDD/blob/master/Documentation/bSDD%20JSON%20import%20model.md
- [C23] bSDD–ISO mapping (marked work in progress): https://github.com/buildingSMART/bSDD/blob/master/Documentation/bSDD-ISO_mapping.md
- [C24] bSDD dictionary list API: https://api.bsdd.buildingsmart.org/api/Dictionary/v1
- [C25] Uniclass 2015 in bSDD (NBS, v1, 16 Aug 2024): https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1 (classes via https://api.bsdd.buildingsmart.org/api/Dictionary/v1/Classes?Uri=https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1)
- [C26] Dubai Municipality, DM BIM Information Requirements 1.0.4 in bSDD: https://identifier.buildingsmart.org/uri/dm/DMBIMInfo/1.0.4 (class `COLUMNType.COLUMN` via https://api.bsdd.buildingsmart.org/api/Class/v1?Uri=https://identifier.buildingsmart.org/uri/dm/DMBIMInfo/1.0.4/class/COLUMNType.COLUMN&IncludeClassProperties=true)
- [C27] ISO 23386:2020: https://www.iso.org/standard/75401.html
- [C28] ISO 23387:2025: https://www.iso.org/standard/85391.html (2020 edition, withdrawn: https://www.iso.org/standard/75403.html)
- [C29] ISO 12006-2:2015: https://www.iso.org/standard/61753.html; ISO/DIS 12006-2: https://www.iso.org/standard/81931.html
- [C30] ISO 12006-3:2022: https://www.iso.org/standard/74932.html
- [C31] ISO 19650-1:2018 https://www.iso.org/standard/68078.html; -2:2018 https://www.iso.org/standard/68080.html; -3:2020 https://www.iso.org/standard/75109.html; ISO/DIS 19650-1 https://www.iso.org/standard/89703.html; ISO/DIS 19650-2 https://www.iso.org/standard/89704.html; ISO/DIS 19650-3 https://www.iso.org/standard/90358.html
- [C32] ISO 7817-1:2024: https://www.iso.org/standard/82914.html; ISO 19650-4:2022: https://www.iso.org/standard/78246.html
- [C33] ISO open data, deliverables metadata (titles, dates, stages, scopes; downloaded 27 Sep 2026): https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl
- [C34] ISO Guide 69:1999, harmonized stage codes (sample pages: xx.93 "Decision to redraft", xx.98 "Decision to abandon project"): https://cdn.standards.iteh.ai/samples/31383/885ae64e40cd49d6a19095fd3439ccfe/ISO-Guide-69-1999.pdf

COBie
- [C35] NIBS, COBie V3 (sections 1–7 and change log): https://nibs.org/nbims/v3/cobie/
- [C36] NBIMS-US V3 §4.2, COBie version 2.4 (2015), pp. 32–39 and 206: https://nibs.org/wp-content/uploads/2025/04/NBIMS-US_V3_4.2_COBie.pdf
- [C37] NBS publication index, BS 1192-4:2014 (withdrawn; superseded by BS EN ISO 19650-4:2022): https://www.thenbs.com/publicationindex/documents/details?Pub=BSI&DocId=307854

Classification and markets
- [C38] NBS, Uniclass download (licence, quarterly updates, release of 1 Jul 2026, tables): https://uniclass.thenbs.com/download
- [C39] NBS, "What is Uniclass?" (30 Mar 2022): https://www.thenbs.com/knowledge/what-is-uniclass
- [C40b] CSI, Single User Access & Download License for OmniClass, Version 4/1/2022: https://www.csiresources.org/csistore/oc-eula
- [C40] CSI, End User License for OmniClass, version 2019-07-01: https://higherlogicdownload.s3.amazonaws.com/CSIRESOURCES/b00cc178-1ca0-4e36-aeae-82edcd55c99c/UploadedImages/PDFs/OmniClass_EULA_2019-07-01.pdf
- [C41] NBIMS-US V3 §2.4, OmniClass introduction: https://nibs.org/wp-content/uploads/2025/04/NBIMS-US_V3_2.4_OmniClass_Intro.pdf
- [C42] *The Construction Specifications Institute, Inc. v. Zerodocs.com, Inc.*, C.D. Cal. No. 8:25-cv-00475, Order on Motions for Summary Judgment (ECF 74), 1 Sep 2026: https://storage.courtlistener.com/recap/gov.uscourts.cacd.961501/gov.uscourts.cacd.961501.74.0.pdf; docket: https://www.courtlistener.com/docket/69727432/the-construction-specifications-institute-incorporated-v-zerodocscom/
- [C43] buildingSMART International, Global openBIM Mandates 2025 Edition (Dubai pp. 11–12; China p. 7): https://www.buildingsmart.org/wp-content/uploads/2025/03/IFC-Mandate_2025.pdf
- [C44] Ashghal, ABIMS COBie Template Guide D1001 V1 (17 Mar 2022): https://www.ashghal.gov.qa/en/Services/GIS%20and%20CAD%20Manuals/ASHGHAL%20BIM%20STANDARD/D1001_COBie%20Template%20Guide_V1.pdf

ISO 19650 guidance and IDS
- [C45] UK BIM Framework, Information management according to BS EN ISO 19650, Guidance Part 1: Concepts, 2nd edition (July 2019), §3.1, §6.5, §6.6: https://imiframework.org/wp-content/uploads/2019/10/Information-Management-according-to-BS-EN-ISO-19650_-Guidance-Part-1_Concepts_2ndEdition.pdf
- [C46] UK BIM Framework, Guidance Part 3: Operational phase of the asset life-cycle, Edition 2 (Feb 2021): https://www.ukbimframework.org/wp-content/uploads/2021/02/Guidance-Part-3_Operational-phase-of-the-asset-life-cycle_Edition-2.pdf
- [C47] buildingSMART IDS user manual and units table: https://github.com/buildingSMART/IDS/blob/development/Documentation/UserManual/README.md; https://github.com/buildingSMART/IDS/blob/development/Documentation/UserManual/units.md
- [C48] buildingSMART IFC 5 development (alpha): https://github.com/buildingSMART/IFC5-development; examples https://github.com/buildingSMART/IFC5-development/blob/main/examples/Hello%20Wall/hello-wall-add-fire-rating-30.ifcx and https://github.com/buildingSMART/IFC5-development/blob/main/examples/PCERT-Sample-Scene/cci@v1.ifcx

Tools
- [C49] Autodesk Revit 2023 help, Shared Parameters: https://help.autodesk.com/cloudhelp/2023/ENU/Revit-Model/files/GUID-E7D12B71-C50D-46D8-886B-8E0C2B285988.htm
- [C50] Autodesk Revit 2026 help, About Setting Up Shared Parameter Files: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-Model/files/GUID-1929027A-B304-401E-BCDC-11ED3D3E67CE.htm
- [C51] Autodesk revit-ifc (open source), `GUIDUtil.cs` and `ExportOptionsCache.cs`: https://github.com/Autodesk/revit-ifc/blob/master/Source/Revit.IFC.Export/Utility/GUIDUtil.cs; https://github.com/Autodesk/revit-ifc/blob/master/Source/Revit.IFC.Export/Utility/ExportOptionsCache.cs
- [C52] iTwin.js BIS, FederationGuids: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/fundamentals/federationGuids.md
- [C53] iTwin.js BIS, ElementAspect fundamentals: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/fundamentals/elementaspect-fundamentals.md
- [C54] iTwin.js EC, KindOfQuantity: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/ec/kindofquantity.md
- [C55] iTwin.js BIS, Schema versioning and generations: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/schema-evolution/schema-versioning-and-generations.md
- [C56] iTwin.js BIS, Classifying Elements: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/fundamentals/data-classification.md
- [C57] iTwin.js BIS, Element fundamentals (JsonProperties) and Properties guidelines: https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/fundamentals/element-fundamentals.md; https://github.com/iTwin/itwinjs-core/blob/master/docs/bis/guide/fundamentals/properties-guidelines.md
- [C58] specklepy (Apache-2.0), `Base` and the serializer: https://github.com/specklesystems/specklepy/blob/main/src/specklepy/objects/base.py; https://github.com/specklesystems/specklepy/blob/main/src/specklepy/serialization/base_object_serializer.py
- [C59] That Open web-ifc (MPL-2.0), properties helper: https://github.com/ThatOpen/engine_web-ifc/blob/main/src/ts/helpers/properties.ts

PostgreSQL
- [C60] PostgreSQL 16, JSON types (§8.14): https://www.postgresql.org/docs/16/datatype-json.html
- [C61] PostgreSQL 16, CREATE STATISTICS: https://www.postgresql.org/docs/16/sql-createstatistics.html
- [C62] PostgreSQL 16, Indexes on expressions: https://www.postgresql.org/docs/16/indexes-expressional.html
- [C63] PostgreSQL 16, TOAST: https://www.postgresql.org/docs/16/storage-toast.html
- [C64] Jeroen Coussement, "Replacing EAV with JSONB in PostgreSQL" (blog, 14 Jan 2016): https://coussej.github.io/2016/01/14/Replacing-EAV-with-JSONB-in-PostgreSQL/
- [C65] Heap, "When To Avoid JSONB In A PostgreSQL Schema" (blog, 1 Sep 2016): https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema

Repository documents: `docs/adr/0031-the-engine-and-the-data-spine.md`, `docs/adr/0034-the-stack.md`,
`docs/adr/0035-the-live-model-is-the-product.md`, `docs/adr/0036-a-project-holds-a-site-and-buildings.md`,
`docs/data-model.md` §2 and §3.3, `docs/research/glodon-bim-2.md`, `docs/research/global-markets-foundation.md`.

**Verified by a refuter (27 Sep 2026, session 02).** Confirmed from primary sources: CSI v. Zerodocs
(ECF 74 and 75, 1 Sep 2026; no notice of appeal on the docket by 25 Sep, the window closing about 1 Oct);
Uniclass CC BY-ND 4.0; Ashghal's ABIMS D1001 COBie guide (Uniclass 2015 categories); IFC 4.3's
PILE_CAP, FOOTING_BEAM, LANDING and SHEAR and the absence of a whole-stair base quantity set; ISO
23387:2025 replacing 2020 and ISO/DIS 19650-2 at 40.93 replacing 19650-2 and -3; the GlobalId "has to be
persistent" and COBie's ExtIdentifier rule. Corrected above: the Dubai dictionary puts IFC properties in
sets IFC does not (not properties IFC lacks); OmniClass's current 2022 licence is stricter than the 2019
EULA; only publishing a crosswalk needs approval. Also note: ADR 0035/0022 (session 02 Q12) rule no IFC
export in the MVP, so §1.5 item 8's export waits; the mapping rows still arrive in M1.
