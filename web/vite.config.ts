/// <reference types="vitest/config" />
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
      port: 5410,
      strictPort: true,
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
      ],
    },
  }
})
