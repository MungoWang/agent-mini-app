export {};

declare global {
  interface Window {
    __mmaOpenBound?: boolean;
    __mmaRailWatch?: boolean;
    __ModuleLoader__?: { load: (opts: unknown) => void };
  }
}
