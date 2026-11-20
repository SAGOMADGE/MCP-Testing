// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Products from "../src/views/products.js";

type Result = { isError?: boolean; structuredContent?: { saved: boolean } };
type Effects = {
  onSuccess: (result: Result) => void;
  onError: (error: Error) => void;
  onSettled: () => void;
};
const mock = vi.hoisted(() => ({
  requests: [] as { productId: number; effects: Effects }[],
  getCart: vi.fn(),
}));
vi.mock("skybridge/web", () => ({ useUser: () => ({ theme: "light" }) }));
vi.mock("@/helpers.js", () => ({
  useToolInfo: () => ({ output: { products: [1, 2].map(id => ({
    id, title: `Product ${id}`, price: 10, category: "bags", image: "",
  })) }, isPending: false }),
  useCallTool: (name: string) => name === "add-to-cart" ? {
    // A shared pending flag must never be passed to every card again.
    isPending: mock.requests.length > 0,
    callTool: ({ productId }: { productId: number }, effects: Effects) => {
      mock.requests.push({ productId, effects });
    },
  } : { callTool: mock.getCart, isPending: false },
}));

let root: Root;
let container: HTMLDivElement;
const buttons = () => [...container.querySelectorAll<HTMLButtonElement>(".shop-button--primary")];
const expectBusy = (expected: boolean[]) => {
  expect(buttons().map(b => b.disabled)).toEqual(expected);
  expect(buttons().map(b => b.textContent)).toEqual(expected.map(b => b ? "Добавляем..." : "Добавить в корзину"));
};
function complete(index: number, outcome: Result | Error) {
  const { effects } = mock.requests[index];
  act(() => {
    if (outcome instanceof Error) effects.onError(outcome);
    else effects.onSuccess(outcome);
    effects.onSettled();
  });
}
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mock.requests.length = 0;
  mock.getCart.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(Products)));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it("locks only the selected product, blocks immediate duplicates and settles concurrent additions independently", () => {
  expectBusy([false, false]);
  act(() => { buttons()[0].click(); buttons()[0].click(); });
  expect(mock.requests.map(r => r.productId)).toEqual([1]);
  expectBusy([true, false]);
  act(() => buttons()[1].click());
  expect(mock.requests.map(r => r.productId)).toEqual([1, 2]);
  expectBusy([true, true]);
  complete(1, { structuredContent: { saved: true } });
  expectBusy([true, false]);
  expect(mock.getCart).toHaveBeenCalledTimes(1);
  complete(0, { structuredContent: { saved: true } });
  expectBusy([false, false]);
  expect(mock.getCart).toHaveBeenCalledTimes(2);
  act(() => buttons()[0].click());
  expect(mock.requests.map(r => r.productId)).toEqual([1, 2, 1]);
});

it.each(["MCP error", "transport error"])("releases the failed product after %s while another request remains pending", kind => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  act(() => { buttons()[0].click(); buttons()[1].click(); });
  complete(0, kind === "MCP error" ? { isError: true } : new Error("offline"));
  expectBusy([false, true]);
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    kind === "MCP error" ? "Не удалось добавить товар" : "Добавление не подтверждено",
  );
  expect(mock.getCart).not.toHaveBeenCalled();
  act(() => buttons()[0].click());
  expect(mock.requests.map(r => r.productId)).toEqual([1, 2, 1]);
  complete(1, { structuredContent: { saved: true } });
  expectBusy([true, false]);
  complete(2, { structuredContent: { saved: true } });
  expectBusy([false, false]);
  expect(mock.getCart).toHaveBeenCalledTimes(2);
});
