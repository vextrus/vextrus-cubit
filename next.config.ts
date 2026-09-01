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
};

export default nextConfig;
