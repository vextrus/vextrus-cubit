// The Next config. `distDir` is the product's own so the build output never collides with another
// tool's `.next` and stays covered by the repository's `.next*` ignores (C-06). Nothing is typed
// from `next` here: importing even a type from it augments NodeJS.ProcessEnv tree-wide.
//
// A lane that builds the product for itself states its own directory: `next build` takes an
// exclusive lock on `<distDir>/lock`, so two suites building at once against one directory make the
// second exit rather than wait. The name is the caller's, and the default is the product's own —
// every such name still starts `.next`, so the repository's ignores keep covering it (C-06).
/**
 * The five security headers that carry no per-request value, on every answer the product serves
 * (Q-12). This is their one home (B-17): a static rule is the only place they can reach
 * `/_next/static` and `/_next/image` too, which the proxy deliberately skips.
 *
 * `Content-Security-Policy` is NOT here and never can be — it carries a per-response nonce, so its
 * one home is `src/proxy.ts`.
 */
async function headers() {
  return [
    {
      source: "/:path*",
      headers: [
        // Two years of HTTPS-only, subdomains included. No `preload`: submitting to the browsers'
        // preload list is a deployment act, not a build's, and the journeys drive http://127.0.0.1.
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        // Belt to the policy's `frame-ancestors 'none'`, for UAs that read only this one.
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // The product asks for none of these, so it grants itself none of them.
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    },
  ];
}

const nextConfig = {
  distDir: process.env["NEXT_DIST_DIR"] ?? ".next-cubit",
  headers,
};

export default nextConfig;
