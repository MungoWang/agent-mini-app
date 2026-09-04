/**
 * jest-dom v6 augments `vitest`'s `Assertion`, but vitest 2.x only **re-exports** that name
 * from `@vitest/expect` — and TypeScript cannot merge a declaration through a re-export. The
 * matchers therefore landed on an interface nothing uses, so every `toBeInTheDocument()` was a
 * TS2339. (The tests still ran because `pnpm typecheck` never covered this package.)
 *
 * Augment the interface `expect()` actually returns. The matcher signatures come from jest-dom
 * itself via its public `./matchers` subpath, so there is no hand-written list here to drift.
 */
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"

declare module "@vitest/expect" {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
