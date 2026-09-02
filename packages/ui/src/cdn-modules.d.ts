/**
 * Heavy editors load CodeMirror / shiki from esm.sh on demand (not npm peers).
 * Ambient so `import("https://esm.sh/...")` type-checks in the IDE.
 */
declare module "https://esm.sh/*";
