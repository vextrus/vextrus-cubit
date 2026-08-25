// The Next config. `distDir` is the product's own so the build output never collides with another
// tool's `.next` and stays covered by the repository's `.next*` ignores (C-06). Nothing is typed
// from `next` here: importing even a type from it augments NodeJS.ProcessEnv tree-wide.
const nextConfig = {
  distDir: ".next-cubit",
};

export default nextConfig;
