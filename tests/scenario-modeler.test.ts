import { expect, it } from "vitest";
import { calculateScenarios } from "../src/lib/scenario-modeler.js";

it("compares actual products without altering the catalog or double-counting categories", () => {
  const products = [
    { id: 1, title: "A", price: 0.1, category: "a" },
    { id: 2, title: "B", price: 0.2, category: "b" },
    { id: 3, title: "C", price: 0.9, category: "a" },
  ];
  const before = structuredClone(products);
  const scenarios = calculateScenarios(products, ["a", "b", "a", "absent"]);
  expect(scenarios[0].total).toBe(0.3);
  expect(scenarios[2].total).toBe(1.1);
  expect(scenarios[0].products.map(p => p.id)).toEqual([1, 2]);
  expect(products).toEqual(before);
});
it("returns zero totals for an empty selection", () => {
  expect(calculateScenarios([], []).map(s => s.total)).toEqual([0, 0, 0]);
});
