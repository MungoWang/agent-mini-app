import "@testing-library/jest-dom/vitest";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;

// jsdom ships neither observer, and kit blocks construct both (`Scrollspy` anchors a viewport
// band). The example harness had been stubbing IntersectionObserver locally; the kit harness
// needs it too, or any test rendering `Scrollspy` dies before it can assert anything. Typed to
// the real interface rather than cast, so the assignment stays honest if the members drift.
class IntersectionObserverStub {
  root: Element | Document | null = null;
  rootMargin = "0px";
  thresholds: number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = IntersectionObserverStub;

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function setPointerCapture() {};
  Element.prototype.releasePointerCapture = function releasePointerCapture() {};
  Element.prototype.hasPointerCapture = function hasPointerCapture() {
    return false;
  };
}
