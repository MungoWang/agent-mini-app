import { describe, expect, it } from "vitest";

import {
  resolveVendorSpecifier,
  VENDOR_IDS,
  vendorFileHref,
  vendorIdFromFile,
  vendorSpecifierFilter,
} from "@monkey-mini-app/host";

describe("platform-modules", () => {
  it("maps lodash specifiers onto /mma/vendors/lodash.js", () => {
    expect(resolveVendorSpecifier("lodash", "ui")).toEqual({
      id: "lodash",
      href: vendorFileHref("lodash"),
    });
    expect(resolveVendorSpecifier("lodash-es", "ui")).toEqual({
      id: "lodash",
      href: vendorFileHref("lodash"),
    });
    expect(resolveVendorSpecifier("lodash/groupBy", "ui")).toEqual({
      id: "lodash",
      href: vendorFileHref("lodash"),
      deep: "groupBy",
    });
    expect(resolveVendorSpecifier("lodash/fp/get", "ui")).toBeNull();
    expect(resolveVendorSpecifier("axios", "ui")).toBeNull();
  });

  it("serves motion under both author spellings, iframe only", () => {
    for (const spec of ["motion", "motion/react"]) {
      expect(resolveVendorSpecifier(spec, "ui")).toEqual({
        id: "motion",
        href: vendorFileHref("motion"),
      });
    }
    // The backend runtime has no React: `motion` must not resolve there, and must not
    // silently fall through to the lodash module the way a hardcoded vendor did.
    expect(resolveVendorSpecifier("motion", "backend")).toBeNull();
    expect(resolveVendorSpecifier("motion/react", "backend")).toBeNull();
  });

  it("keeps isomorphic vendors reachable from the backend", () => {
    expect(resolveVendorSpecifier("lodash", "backend")).toEqual({
      id: "lodash",
      href: vendorFileHref("lodash"),
    });
    expect(resolveVendorSpecifier("lodash/merge", "backend")).toEqual({
      id: "lodash",
      href: vendorFileHref("lodash"),
      deep: "merge",
    });
  });

  it("accepts only allowlisted vendor file names", () => {
    expect(vendorIdFromFile("lodash.js")).toBe("lodash");
    expect(vendorIdFromFile("motion.js")).toBe("motion");
    expect(vendorIdFromFile("axios.js")).toBeNull();
    expect(vendorIdFromFile("../sdk.js")).toBeNull();
    expect(vendorIdFromFile("lodash")).toBeNull();
  });

  it("claims only real vendor specifiers in the compiler filter", () => {
    const f = vendorSpecifierFilter();
    for (const spec of ["lodash", "lodash-es", "lodash/groupBy", "motion", "motion/react"]) {
      expect(f.test(spec), spec).toBe(true);
    }
    // react/sdk/relative belong to their own hooks; a typo must not be "resolved" here.
    for (const spec of ["react", "@monkey-mini-app/ui", "./x", "lodash-es-x", "framer-motion"]) {
      expect(f.test(spec), spec).toBe(false);
    }
  });

  it("exposes every vendor id as a servable file", () => {
    for (const id of VENDOR_IDS) {
      expect(vendorIdFromFile(`${id}.js`)).toBe(id);
    }
  });
});
