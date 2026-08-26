/**
 * `bun build` resuelve `import './styles/ui.css'` (lo emite como artefacto CSS aparte),
 * pero `tsc --noEmit` —que corre en el pre-commit sobre TODO el repo— no conoce ese
 * módulo y falla con TS2882. Esta declaración solo le dice a TypeScript que existe.
 */
declare module '*.css' {
  const content: string
  export default content
}
