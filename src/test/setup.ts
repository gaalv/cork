import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = globalThis.ResizeObserver ?? ResizeObserverMock;
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => undefined);

afterEach(() => {
  cleanup();
});
