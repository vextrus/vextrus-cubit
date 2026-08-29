"use client";
/**
 * S-Design, the living gallery (R-UI-011, docs/design/s-design.md): every component the barrels
 * publish, in every state it can be mounted in, with sample data — in both themes, because the
 * token values flip beneath it and nothing here branches on the theme.
 *
 * The structure is the derivation's structure. Barrels, entries and states are read off
 * `src/ui/gallery-derivation`; the page holds no roster of its own, so a component added later
 * appears here the moment its entry does, and one without an entry fails a test instead.
 */
import { galleryBarrels, galleryEntries } from "../../../ui/gallery-derivation";
import { galleryChrome } from "../../../ui/gallery-derivation/chrome";
import "./design.css";

/** The barrel an entry key belongs to: the key is `"<barrelId>/<ExportName>"` and names carry no slash. */
function barrelOf(key: string): string {
  return key.slice(0, key.lastIndexOf("/"));
}

/** The export an entry catalogues — rendered verbatim, because the identifier is the copy (I-17). */
function exportNameOf(key: string): string {
  return key.slice(key.lastIndexOf("/") + 1);
}

/**
 * The id the entry's heading carries so its `<section>` can borrow it as a name. A family part
 * renders its family's whole composition (I-16), so the page mounts the same sample once per part
 * and the same control names repeat down the page; a named region is what tells a reader browsing
 * by control that this "Rename project" is DialogTrigger's and that one is DialogClose's. Derived
 * from the entry key — unique by construction — with the separators an id may not carry folded out.
 */
function headingIdOf(key: string): string {
  return `gallery-entry-${key.replace(/[^A-Za-z0-9]+/g, "-")}`;
}

export default function DesignGalleryPage() {
  const barrelIds = Object.keys(galleryBarrels).sort();
  const entryKeys = Object.keys(galleryEntries).sort();

  return (
    <main className="cx-gallery">
      <header className="cx-gallery-shell" data-testid="gallery-shell">
        <h1 className="cx-gallery-title">{galleryChrome.heading}</h1>
        <p className="cx-gallery-caption">{galleryChrome.caption}</p>
      </header>

      {barrelIds.map((barrelId) => (
        <section className="cx-gallery-barrel" data-testid="gallery-barrel" data-barrel={barrelId} key={barrelId}>
          <h2 className="cx-gallery-barrel-name">{barrelId}</h2>

          {entryKeys
            .filter((key) => barrelOf(key) === barrelId)
            .map((key) => (
              <section aria-labelledby={headingIdOf(key)} className="cx-gallery-entry" data-testid="gallery-entry" data-entry={key} key={key}>
                <h3 className="cx-gallery-entry-name" id={headingIdOf(key)}>
                  {exportNameOf(key)}
                </h3>

                <div className="cx-gallery-states">
                  {(galleryEntries[key]?.states ?? []).map((state) => (
                    <div className="cx-gallery-state" data-testid="gallery-state" data-state={state.name} key={state.name}>
                      <p className="cx-gallery-state-label">{state.name}</p>
                      {state.render()}
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </section>
      ))}
    </main>
  );
}
