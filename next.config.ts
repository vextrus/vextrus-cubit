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
  // SEAM-CAD's client resolves the checkout it spawns `uv run --project cad` from, so the build's
  // file tracing walks `cad/` looking for that project. `cad/.venv` is uv's own environment — it is
  // ignored by git, it is not the product's code, and its interpreter is a symlink out of the tree
  // that the tracer cannot follow. It is excluded here so that a checkout which has run the CAD lane
  // builds exactly like one which has not (AS-01).
  // SEAM-CAD's client resolves the checkout it spawns `uv run --project cad` from, so once a screen
  // reaches that seam the build's file tracing walks the tree looking for `cad/pyproject.toml`. That
  // walk meets `cad/.venv` — uv's own environment, git-ignored, whose interpreter is a symlink to
  // the machine's Python — and a symlink leaving the project root is one the tracer refuses to
  // follow, so a checkout that has run the CAD lane would fail to build where a fresh one succeeds.
  // Naming the filesystem as the root keeps that link inside it; nothing else about resolution
  // changes, since every specifier is still resolved from the file that wrote it (AS-01).
  turbopack: { root: "/" },
};

export default nextConfig;
