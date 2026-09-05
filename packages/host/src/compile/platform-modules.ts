/**
 * Iframe platform modules + the author specifiers that map onto them.
 *
 *   /mma/runtime.js        — React (complete, not curated)
 *   /mma/sdk.js            — @monkey-mini-app/ui
 *   /mma/vendors/<id>.js   — isomorphic libs the compiler allowlists
 *
 * Adding a vendor is a new file under vendors/ plus a row here — not a concatenated
 * /mma/vendors.js (lodash and date-fns both export min/max/isEqual).
 */
export const RUNTIME_HREF = "/mma/runtime.js";
export const SDK_HREF = "/mma/sdk.js";
export const VENDORS_HREF_PREFIX = "/mma/vendors";

export const VENDOR_IDS = ["lodash"] as const;
export type VendorId = (typeof VENDOR_IDS)[number];

const IDENT = /^[A-Za-z_$][\w$]*$/;

export function vendorFileHref(id: VendorId): string {
  return `${VENDORS_HREF_PREFIX}/${id}.js`;
}

/** `lodash.js` → `lodash`; anything else (incl. path traversal) → null. */
export function vendorIdFromFile(file: string): VendorId | null {
  const m = /^([a-z0-9-]+)\.js$/.exec(file);
  if (!m) return null;
  return (VENDOR_IDS as readonly string[]).includes(m[1]) ? (m[1] as VendorId) : null;
}

export type VendorResolve =
  | { href: string }
  | { href: string; deep: string };

/**
 * Map a bare author specifier onto a vendor iframe file.
 * `lodash/groupBy` is a default-export deep path; `lodash/fp/get` is not v1.
 */
export function resolveVendorSpecifier(spec: string): VendorResolve | null {
  if (spec === "lodash" || spec === "lodash-es") {
    return { href: vendorFileHref("lodash") };
  }
  const deep = /^lodash\/([^/]+)$/.exec(spec);
  if (deep && IDENT.test(deep[1] ?? "")) {
    return { href: vendorFileHref("lodash"), deep: deep[1] };
  }
  return null;
}
