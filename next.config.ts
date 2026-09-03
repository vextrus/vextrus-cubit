// The Next config. `distDir` is the product's own so the build output never collides with another
// tool's `.next` and stays covered by the repository's `.next*` ignores (C-06). Nothing is typed
// from `next` here: importing even a type from it augments NodeJS.ProcessEnv tree-wide.
//
// A lane that builds the product for itself states its own directory: `next build` takes an
// exclusive lock on `<distDir>/lock`, so two suites building at once against one directory make the
// second exit rather than wait. The name is the caller's, and the default is the product's own —
// every such name still starts `.next`, so the repository's ignores keep covering it (C-06).
const nextConfig = {
  distDir: process.env["NEXT_DIST_DIR"] ?? ".next-cubit",
  // A screen that requests an ingest puts SEAM-CAD's client (`src/modules/takeoff/ingest`) in the
  // app graph, and that module reads and writes paths it is handed at run time. The bundler answers
  // such a path by walking the tree it calls its filesystem root — which meets `cad/.venv`, the uv
  // environment the CAD lane builds (git-ignored, never source), whose interpreter is a symlink to
  // the machine's Python. A symlink leaving that root is one the walk refuses, so a checkout which
  // has run the CAD lane would fail to build where a fresh one succeeds. Naming the filesystem as
  // the root keeps the link inside it; every specifier is still resolved from the file that wrote
  // it, so what is bundled does not change (AS-01).
  turbopack: { root: "/" },
};

export default nextConfig;
