/**
 * Iframe platform modules + the author specifiers that map onto them.
 *
 *   /mma/runtime.js        — React (complete, not curated)
 *   /mma/sdk.js            — @monkey-mini-app/ui
 *   /mma/vendors/<id>.js   — platform libraries the compiler allowlists
 *
 * Adding a vendor is a row in `VENDORS` plus a build step in `scripts/build/sdk.mjs` —
 * never a concatenated /mma/vendors.js (lodash and date-fns both export
 * min/max/isEqual, and motion needs React while lodash must not).
 */
export const RUNTIME_HREF = "/mma/runtime.js";
export const SDK_HREF = "/mma/sdk.js";
export const VENDORS_HREF_PREFIX = "/mma/vendors";

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Where an author is allowed to write the specifier. */
export type VendorTarget = "ui" | "backend";

export type VendorId = "lodash" | "motion";

export type Vendor = {
  id: VendorId;
  /**
   * Author specifiers that resolve to this file, in the shape the model already types.
   * `motion/react` is the package's own React entry; bare `motion` is its vanilla entry,
   * which is the one thing authors must not receive, so it is mapped here deliberately.
   */
  specifiers: readonly string[];
  /** `lodash/groupBy` — a member re-exported as the module default. */
  deepMember?: boolean;
  /**
   * `ui` = iframe only, `backend` = also injectable into `main.api.ts`.
   * A React-coupled library must never resolve on the backend: the backend runtime has
   * no React, and pretending otherwise hands the app a broken module.
   */
  targets: readonly VendorTarget[];
};

export const VENDORS: readonly Vendor[] = [
  {
    id: "lodash",
    specifiers: ["lodash", "lodash-es"],
    deepMember: true,
    targets: ["ui", "backend"],
  },
  {
    id: "motion",
    specifiers: ["motion", "motion/react"],
    targets: ["ui"],
  },
];

export const VENDOR_IDS: readonly VendorId[] = VENDORS.map((v) => v.id);

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
  | { id: VendorId; href: string }
  | { id: VendorId; href: string; deep: string };

/**
 * The vendor a specifier names, ignoring where it is allowed. Used only to phrase a
 * better error: `motion` in `main.api.ts` must not be reported as "not a platform
 * package, go install it" — it *is* one, it just has no meaning without React.
 */
export function findVendor(spec: string): Vendor | null {
  for (const v of VENDORS) {
    if (v.specifiers.includes(spec)) return v;
    if (v.deepMember && spec.startsWith(`${v.id}/`)) return v;
  }
  return null;
}

/**
 * Map a bare author specifier onto a platform file for one side of the app.
 * Returns null when nothing is allowed there — the caller keeps its own
 * "cannot import" error, so `lodash/fp/get` and `axios` fail the same way they
 * did before the table existed.
 */
export function resolveVendorSpecifier(
  spec: string,
  target: VendorTarget,
): VendorResolve | null {
  for (const v of VENDORS) {
    if (!v.targets.includes(target)) continue;
    if (v.specifiers.includes(spec)) {
      return { id: v.id, href: vendorFileHref(v.id) };
    }
    if (v.deepMember && spec.startsWith(`${v.id}/`)) {
      const deep = spec.slice(v.id.length + 1);
      if (IDENT.test(deep)) return { id: v.id, href: vendorFileHref(v.id), deep };
      return null;
    }
  }
  return null;
}

/** Bare specifiers a vendor might claim — the esbuild filter for the vendor hook. */
export function vendorSpecifierFilter(): RegExp {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts: string[] = [];
  for (const v of VENDORS) {
    for (const s of v.specifiers) parts.push(escape(s));
    if (v.deepMember) parts.push(`${escape(v.id)}/[^/]+`);
  }
  return new RegExp(`^(?:${parts.join("|")})$`);
}
