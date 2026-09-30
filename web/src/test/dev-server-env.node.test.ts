/*
 * The dev server's environment beyond ticket 169's acceptance tests: the orchestrator's rulings on
 * what they leave open (an empty variable is unset; a malformed API URL is refused; the port's
 * refusal names the variable, the value and the range; the rest of the server stays as it was).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigEnv, UserConfig } from "vite";

const SERVE: ConfigEnv = {
  command: "serve",
  mode: "development",
  isSsrBuild: false,
  isPreview: false,
};

async function resolveConfig(): Promise<UserConfig> {
  vi.resetModules();
  const module = (await import("../../vite.config")) as {
    default: (env: ConfigEnv) => UserConfig;
  };
  return module.default(SERVE);
}

function apiProxy(config: UserConfig) {
  const proxy = config.server?.proxy?.["/api"];
  if (!proxy || typeof proxy === "string")
    throw new Error("no /api proxy object");
  return proxy;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the dev server from the environment (rulings)", () => {
  it("treats empty variables as unset", async () => {
    vi.stubEnv("VEXTRUS_WEB_PORT", "");
    vi.stubEnv("VEXTRUS_API_URL", " ");
    const config = await resolveConfig();
    expect(config.server?.port).toBe(5410);
    expect(apiProxy(config).target).toBe("http://127.0.0.1:8000");
  });

  it("names the variable, the value and the range when refusing a port", async () => {
    vi.stubEnv("VEXTRUS_WEB_PORT", "65536");
    vi.stubEnv("VEXTRUS_API_URL", undefined);
    await expect(resolveConfig()).rejects.toThrow(
      'VEXTRUS_WEB_PORT must be a port from 1 to 65535, not "65536"',
    );
  });

  it.each([
    "127.0.0.1:8000",
    "not a url",
    "ftp://127.0.0.1:8000",
    "file:///etc/passwd",
    "javascript:alert(1)",
    // Read by the proxy against its base URL, these would go to another host than the one named.
    "http:/127.0.0.1:8013",
    "http:127.0.0.1:8013",
    // The proxy would drop or rewrite these parts rather than honour them.
    "http://user:pass@127.0.0.1:8013",
    "http://127.0.0.1:8013/prefix",
    "http://127.0.0.1:8013/?x=1",
    "http://127.0.0.1:8013#frag",
    "http://127.0.0.1:80\t13",
    "http://127.0.0.1:80 13",
  ])(
    "refuses a malformed VEXTRUS_API_URL (%j) naming the variable",
    async (bad) => {
      vi.stubEnv("VEXTRUS_WEB_PORT", undefined);
      vi.stubEnv("VEXTRUS_API_URL", bad);
      await expect(resolveConfig()).rejects.toThrow(
        /^VEXTRUS_API_URL must be an http or https URL/,
      );
    },
  );

  it("refuses a port padded with anything but ASCII whitespace, as the API does", async () => {
    for (const bad of [
      "5410\ufeff",
      "\ufeff5410",
      "\u001c5410",
      "5410\u001f",
      "5410\u00a0",
    ]) {
      vi.stubEnv("VEXTRUS_WEB_PORT", bad);
      await expect(resolveConfig()).rejects.toThrow(/VEXTRUS_WEB_PORT/);
    }
    vi.stubEnv("VEXTRUS_WEB_PORT", " \t5423\n");
    expect((await resolveConfig()).server?.port).toBe(5423);
  });

  it("takes the API origin with or without its trailing slash", async () => {
    vi.stubEnv("VEXTRUS_WEB_PORT", undefined);
    vi.stubEnv("VEXTRUS_API_URL", "http://127.0.0.1:8013/");
    expect(apiProxy(await resolveConfig()).target).toBe(
      "http://127.0.0.1:8013",
    );
  });

  it("accepts an https API", async () => {
    vi.stubEnv("VEXTRUS_WEB_PORT", undefined);
    vi.stubEnv("VEXTRUS_API_URL", "https://api.vextrus.example");
    expect(apiProxy(await resolveConfig()).target).toBe(
      "https://api.vextrus.example",
    );
  });

  it("keeps the host, strict port, origin and preview port", async () => {
    vi.stubEnv("VEXTRUS_WEB_PORT", "5423");
    vi.stubEnv("VEXTRUS_API_URL", "http://127.0.0.1:8013");
    const config = await resolveConfig();
    expect(config.server?.host).toBe("127.0.0.1");
    expect(config.server?.strictPort).toBe(true);
    expect(apiProxy(config).changeOrigin).toBe(false);
    expect(config.preview).toMatchObject({
      host: "127.0.0.1",
      port: 5411,
      strictPort: true,
    });
  });
});
