import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateScenarios,
  parseBudget,
  type Product,
} from "./scenario-modeler.js";

function product(id: number, price: number, category = "A"): Product {
  return { id, title: `Product ${id}`, price, category };
}

// A has an odd number of products; B has an even number.
const catalog = [
  product(3, 30), product(1, 10), product(2, 20),
  product(7, 70, "B"), product(4, 40, "B"),
  product(6, 60, "B"), product(5, 50, "B"),
  product(8, 1, "Unselected"),
];

test("selects cheapest, lower median and most expensive per category", () => {
  const result = calculateScenarios(catalog, ["A", "B"], 10000);

  assert.deepEqual(result.scenarios.map((scenario) => ({
    strategy: scenario.strategy,
    ids: scenario.products.map((item) => item.id),
    totalCents: scenario.totalCents,
  })), [
    { strategy: "economy", ids: [1, 4], totalCents: 5000 },
    { strategy: "balanced", ids: [2, 5], totalCents: 7000 },
    { strategy: "premium", ids: [3, 7], totalCents: 10000 },
  ]);
  assert.deepEqual(result.missingCategories, []);
});

test("updates the recommendation at exact budget thresholds, in either direction", () => {
  const cases = [
    [4999, null], [5000, "economy"], [6999, "economy"],
    [7000, "balanced"], [9999, "balanced"], [10000, "premium"],
    [10001, "premium"], [7000, "balanced"], [5000, "economy"],
    [4999, null],
  ] as const;

  for (const [budgetCents, expected] of cases) {
    const result = calculateScenarios(catalog, ["A", "B"], budgetCents);
    assert.equal(result.recommendedStrategy, expected, `budget ${budgetCents}`);
    assert.deepEqual(
      result.scenarios.map((scenario) => scenario.remainingCents),
      [budgetCents - 5000, budgetCents - 7000, budgetCents - 10000],
    );
  }
});

test("keeps every selected purchase visible when no scenario is affordable", () => {
  const result = calculateScenarios(catalog, ["A", "B"], 1);
  assert.equal(result.recommendedStrategy, null);
  for (const scenario of result.scenarios) {
    assert.equal(scenario.products.length, 2);
    assert.ok(scenario.remainingCents !== null && scenario.remainingCents < 0);
  }
});

test("returns an empty state when no categories are selected", () => {
  for (const products of [catalog, []]) {
    assert.deepEqual(calculateScenarios(products, [], 10000), {
      scenarios: [], missingCategories: [], recommendedStrategy: null,
    });
  }
});

test("does not label an empty or incomplete selection as affordable", () => {
  for (const products of [[], [product(1, 10)]]) {
    const result = calculateScenarios(products, ["A", "Missing"], 10000);
    assert.deepEqual(result.missingCategories, products.length ? ["Missing"] : ["A", "Missing"]);
    assert.equal(result.recommendedStrategy, null);
    for (const scenario of result.scenarios) {
      assert.deepEqual(scenario.products, products);
      assert.equal(scenario.totalCents, products.length ? 1000 : 0);
      assert.equal(scenario.remainingCents, null);
    }
  }
});

test("deduplicates selected categories, including missing categories", () => {
  assert.deepEqual(
    calculateScenarios(catalog, ["A", "B", "A", "B"], 10000),
    calculateScenarios(catalog, ["A", "B"], 10000),
  );
  assert.deepEqual(
    calculateScenarios([], ["Missing", "Missing"]).missingCategories,
    ["Missing"],
  );
});

test("sums cents without floating-point loss or rounding the total down", () => {
  const products = [product(1, 0.1), product(2, 0.2, "B"), product(3, 0.29, "C")];
  const exact = calculateScenarios(products, ["A", "B", "C"], 59);
  for (const scenario of exact.scenarios) {
    assert.equal(scenario.totalCents, 59);
    assert.equal(scenario.remainingCents, 0);
  }
  const short = calculateScenarios(products, ["A", "B", "C"], 58);
  assert.equal(short.recommendedStrategy, null);
  assert.ok(short.scenarios.every((scenario) => scenario.remainingCents === -1));
});

test("rounds each price to the nearest cent before summing", () => {
  const result = calculateScenarios(
    [product(1, 1.005), product(2, 0.295, "B"), product(3, 1e-7, "C")],
    ["A", "B", "C"],
    131,
  );
  assert.ok(result.scenarios.every((scenario) => scenario.totalCents === 131));

  // Adding Number.EPSILON before multiplying would still round this down.
  const short = calculateScenarios([product(1, 10.075)], ["A"], 1007);
  assert.equal(short.recommendedStrategy, null);
  assert.ok(short.scenarios.every((scenario) => scenario.remainingCents === -1));

  const exact = calculateScenarios([product(1, 10.075)], ["A"], 1008);
  assert.equal(exact.recommendedStrategy, "economy");
  for (const scenario of exact.scenarios) {
    assert.equal(scenario.totalCents, 1008);
    assert.equal(scenario.remainingCents, 0);
  }
});

test("breaks equal-price ties by ID and prefers economy for equal totals", () => {
  const products = [product(3, 10), product(1, 10), product(2, 10)];
  const result = calculateScenarios(products, ["A"], 1000);
  assert.deepEqual(result.scenarios.map((scenario) => scenario.products[0].id), [1, 2, 3]);
  assert.equal(result.recommendedStrategy, "economy");
  assert.deepEqual(result, calculateScenarios([...products].reverse(), ["A"], 1000));
});

test("does not mutate product objects, the catalog or selected categories", () => {
  const products = Object.freeze(catalog.map((item) => Object.freeze({ ...item })));
  const categories = Object.freeze(["B", "A", "B"]);
  const before = structuredClone({ products, categories });

  calculateScenarios(products, categories, 7000);
  assert.deepEqual({ products, categories }, before);
});

test("omits budget evaluation for invalid budgets while preserving selections", () => {
  for (const budget of [null, 0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const result = calculateScenarios(catalog, ["A", "B"], budget);
    assert.equal(result.recommendedStrategy, null);
    assert.ok(result.scenarios.every((scenario) => scenario.remainingCents === null));
    assert.deepEqual(result.scenarios.map((scenario) => scenario.totalCents), [5000, 7000, 10000]);
  }
});

test("parses positive decimal budgets into exact integer cents", () => {
  for (const [input, cents] of [
    ["500", 50000], [" 12.34 ", 1234], ["12,34", 1234],
    [".50", 50], [",50", 50], ["0.01", 1], ["0.29", 29], ["1.2", 120],
  ] as const) {
    assert.equal(parseBudget(input), cents, input);
  }
});

test("rejects empty, nonpositive, nondecimal, overprecise and unsafe budgets", () => {
  for (const input of [
    "", "  ", "0", "0.00", "-1", "-0.01", "hello", "NaN", "Infinity",
    "1e2", "0x10", "1.234", "0.001", "1,2.3", "9007199254740992",
  ]) {
    assert.equal(parseBudget(input), null, input);
  }
});
