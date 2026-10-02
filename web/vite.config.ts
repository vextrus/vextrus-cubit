/// <reference types="vitest/config" />
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin'
import { playwright } from '@vitest/browser-playwright'

const MACHINE_CATALOGUES = '/src/messages/'

/**
 * Lingui's Vite plugin serves one config. The chrome's catalogues (hashed ids, extracted) and the
 * machine's (explicit ids: the message codes, worded by hand) need two, so each instance only
 * transforms the `.po` files its config owns. Both fail the build on a message without English.
 */
function linguiFor(owns: (id: string) => boolean, configPath?: string): Plugin[] {
  return lingui({ configPath, failOnMissing: true, failOnCompileError: true }).map((plugin) => {
    const transform = plugin.transform
    if (!transform || typeof transform === 'function') return plugin
    const handler = transform.handler
    return {
      ...plugin,
      name: `${plugin.name}${configPath ? ':messages' : ':chrome'}`,
      transform: {
        ...transform,
        handler(this: ThisParameterType<typeof handler>, code: string, id: string, ...rest: unknown[]) {
          if (!owns(id)) return undefined
          return (handler as (...a: unknown[]) => unknown).call(this, code, id, ...rest)
        },
      },
    } as Plugin
  })
}

/** The local sheets' folder, and where it really is when it is a link (Vite checks real paths). */
function localSheets(): string[] {
  const folder = fileURLToPath(new URL('../.private/work/sheets/', import.meta.url))
  try {
    return [folder, realpathSync(folder)]
  } catch {
    return [folder] // not there yet
  }
}

/**
 * A variable's value, or undefined when it is unset or empty (an empty variable is unset). Only
 * ASCII whitespace is trimmed, as vextrus/settings/auth.py trims VEXTRUS_WEB_PORT, so the two
 * agree on every value.
 */
function fromEnv(name: string): string | undefined {
  const value = process.env[name]?.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, '')
  return value ? value : undefined
}

/**
 * The dev server's port: `VEXTRUS_WEB_PORT`, or 5410. The API reads the same variable for its
 * trusted origins (vextrus/settings/auth.py), so sign-in works on either. A bad value is refused.
 */
function webPort(): number {
  const value = fromEnv('VEXTRUS_WEB_PORT')
  if (value === undefined) return 5410
  const port = /^[0-9]{1,5}$/.test(value) ? Number(value) : NaN
  if (!(port >= 1 && port <= 65535)) {
    throw new Error(`VEXTRUS_WEB_PORT must be a port from 1 to 65535, not ${JSON.stringify(value)}`)
  }
  return port
}

/**
 * Where `/api` goes: `VEXTRUS_API_URL`, or Django's runserver on 8000. Only an http or https
 * origin (scheme, host, port) is taken: the proxy reads its target against a base URL and drops a
 * user and password, so anything it would read differently (`http:/host`, a path, a query, a
 * fragment, credentials, a space or control character) is refused rather than sent elsewhere.
 */
function apiUrl(): string {
  const value = fromEnv('VEXTRUS_API_URL')
  if (value === undefined) return 'http://127.0.0.1:8000'
  const url = URL.parse(value)
  const asTheProxyReadsIt = URL.parse(value, 'http://base.invalid')
  const origin =
    url &&
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    asTheProxyReadsIt?.href === url.href &&
    !url.username &&
    !url.password &&
    url.pathname === '/' &&
    !url.search &&
    !url.hash &&
    !/[?#]/.test(value) &&
    ![...value].some((c) => c <= ' ' || c === '\u007f')
      ? url.origin
      : undefined
  if (!origin) {
    throw new Error(
      `VEXTRUS_API_URL must be an http or https URL of the API's origin (like http://127.0.0.1:8000), not ${JSON.stringify(value)}`,
    )
  }
  return origin
}

export default defineConfig(({ mode }) => {
  const production = mode === 'production'
  const plugins: PluginOption[] = [
    // Must come before react(). The `/dev/*` routes (the specimen) exist only in development
    // builds: a production build's route tree never includes the `dev` folder. Tests mount
    // components directly and need no route tree.
    mode === 'test'
      ? null
      : tanstackRouter({
          target: 'react',
          autoCodeSplitting: true,
          ...(production ? { routeFileIgnorePattern: '^dev$' } : {}),
        }),
    react(),
    babel({ presets: [linguiTransformerBabelPreset()] }),
    ...linguiFor((id) => !id.includes(MACHINE_CATALOGUES)),
    ...linguiFor((id) => id.includes(MACHINE_CATALOGUES), 'lingui.messages.config.ts'),
    tailwindcss(),
  ]

  return {
    plugins,
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '127.0.0.1',
      port: webPort(),
      strictPort: true,
      // The API on Django's runserver (CLAUDE.md), same origin to the browser: the session cookie and
      // CSRF work as deployed, and the request keeps its Origin, which CSRF_TRUSTED_ORIGINS expects
      // to be this server's (vextrus/settings/auth.py).
      proxy: { '/api': { target: apiUrl(), changeOrigin: false } },
      // Outside web/, Vite serves only these: the engine's committed sheet buffers and their rasters
      // (engine/render/fixtures/), which the sheet viewer's pixel test and dev route read, and the
      // buffers written locally for that route (.private/work/sheets/; this server is 127.0.0.1's).
      fs: {
        allow: [
          '.',
          fileURLToPath(new URL('../engine/render/fixtures/', import.meta.url)),
          ...localSheets(),
        ],
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 5411,
      strictPort: true,
    },
    build: {
      target: 'es2023',
      sourcemap: true,
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: ['scripts/**/*.test.ts', 'eslint/**/*.test.ts', 'src/**/*.node.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'browser',
            include: ['src/**/*.test.tsx', 'src/**/*.browser.test.ts'],
            exclude: ['src/**/*.tz.test.tsx'],
            setupFiles: ['./src/test/setup.ts'],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: 'chromium' }],
              viewport: { width: 1440, height: 900 },
            },
          },
        },
        // A date is the Market's, whatever the browser's zone (m0-screens §1.2): the time-zone tests run
        // in a browser set to UTC, as CI runs, and in one west of UTC, never only in the machine's own.
        ...['UTC', 'America/Los_Angeles'].map((timezoneId) => ({
          extends: true as const,
          test: {
            name: `browser ${timezoneId}`,
            include: ['src/**/*.tz.test.tsx'],
            setupFiles: ['./src/test/setup.ts'],
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({ contextOptions: { timezoneId } }),
              instances: [{ browser: 'chromium' as const }],
              viewport: { width: 1440, height: 900 },
            },
          },
        })),
      ],
    },
  }
})
