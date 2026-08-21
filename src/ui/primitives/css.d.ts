/**
 * A stylesheet is a side effect, not a value.
 *
 * `src/ui/primitives/index.ts` imports `./primitives.css` so that a consumer of the barrel
 * gets the focus ring and the surfaces with the components. The bundler understands that
 * import; TypeScript needs to be told that a `.css` specifier resolves to a module with
 * nothing in it, or the barrel does not compile.
 */
declare module '*.css';
