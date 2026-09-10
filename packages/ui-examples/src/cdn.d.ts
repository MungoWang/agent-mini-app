/** Ambient for the UI kit’s on-demand esm.sh imports (see packages/ui/src/cdn-modules.d.ts). */
declare module "https://esm.sh/*";

/** Vite's raw-text import, used by the look fixtures to read a Look's own `theme.css`. */
declare module "*.css?raw" {
  const source: string;
  export default source;
}
