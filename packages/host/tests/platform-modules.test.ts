import { describe, expect, it } from "vitest";

import {
  resolveVendorSpecifier,
  vendorFileHref,
  vendorIdFromFile,
} from "@monkey-mini-app/host";

describe("platform-modules", () => {
  it("maps lodash specifiers onto /mma/vendors/lodash.js", () => {
    expect(resolveVendorSpecifier("lodash")).toEqual({ href: vendorFileHref("lodash") });
    expect(resolveVendorSpecifier("lodash-es")).toEqual({ href: vendorFileHref("lodash") });
    expect(resolveVendorSpecifier("lodash/groupBy")).toEqual({
      href: vendorFileHref("lodash"),
      deep: "groupBy",
    });
    expect(resolveVendorSpecifier("lodash/fp/get")).toBeNull();
    expect(resolveVendorSpecifier("axios")).toBeNull();
  });

  it("accepts only allowlisted vendor file names", () => {
    expect(vendorIdFromFile("lodash.js")).toBe("lodash");
    expect(vendorIdFromFile("axios.js")).toBeNull();
    expect(vendorIdFromFile("../sdk.js")).toBeNull();
    expect(vendorIdFromFile("lodash")).toBeNull();
  });
});
