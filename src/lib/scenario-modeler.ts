export type Product = {
  id: number;
  title: string;
  price: number;
  category: string;
};

export type Strategy = "economy" | "balanced" | "premium";

export type Scenario = {
  strategy: Strategy;
  products: Product[];
  totalCents: number;
  // Без корректного бюджета или полного набора оценка недоступна.
  remainingCents: number | null;
};

export type ScenarioComparison = {
  scenarios: Scenario[];
  missingCategories: string[];
  recommendedStrategy: Strategy | null;
};

/** Разбираем доллары в целые центы без округления введённого бюджета. */
export function parseBudget(input: string): number | null {
  const value = input.trim();
  if (!/^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(value)) return null;

  const [dollars, fraction = ""] = value.replace(",", ".").split(".");
  const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** Цены каталога приводим к ближайшему центу до суммирования. */
export function toCents(amount: number): number {
  // Десятичный сдвиг избегает ошибки 10.075 * 100 = 1007.4999999999999.
  const [coefficient, exponent = "0"] = amount.toString().split("e");
  return Math.round(Number(`${coefficient}e${Number(exponent) + 2}`));
}

export function calculateScenarios(
  products: readonly Product[],
  selectedCategories: readonly string[],
  budgetCents: number | null = null,
): ScenarioComparison {
  const categories = [...new Set(selectedCategories)];
  if (categories.length === 0) {
    return { scenarios: [], missingCategories: [], recommendedStrategy: null };
  }

  // filter создаёт новые массивы: сортировка не меняет исходный каталог.
  const groupedProducts = categories.map((category) =>
    products
      .filter((product) => product.category === category)
      .sort((a, b) => a.price - b.price || a.id - b.id),
  );
  const missingCategories = categories.filter(
    (_, index) => groupedProducts[index].length === 0,
  );
  const canCompareBudget =
    budgetCents !== null &&
    Number.isSafeInteger(budgetCents) &&
    budgetCents > 0 &&
    missingCategories.length === 0;

  function createScenario(strategy: Strategy): Scenario {
    const selectedProducts = groupedProducts.flatMap((items) => {
      if (items.length === 0) return [];

      // При чётном числе товаров balanced берёт нижний из двух средних.
      const index =
        strategy === "economy"
          ? 0
          : strategy === "premium"
            ? items.length - 1
            : Math.floor((items.length - 1) / 2);
      return [items[index]];
    });

    const totalCents = selectedProducts.reduce(
      (sum, product) => sum + toCents(product.price),
      0,
    );

    return {
      strategy,
      products: selectedProducts,
      totalCents,
      remainingCents:
        canCompareBudget && budgetCents !== null ? budgetCents - totalCents : null,
    };
  }

  const scenarios = [
    createScenario("economy"),
    createScenario("balanced"),
    createScenario("premium"),
  ];

  // Самый дорогой доступный набор; при равенстве сохраняем раннюю стратегию.
  let recommended: Scenario | null = null;
  for (const scenario of scenarios) {
    if (
      scenario.remainingCents !== null &&
      scenario.remainingCents >= 0 &&
      (recommended === null || scenario.totalCents > recommended.totalCents)
    ) {
      recommended = scenario;
    }
  }

  return {
    scenarios,
    missingCategories,
    recommendedStrategy: recommended?.strategy ?? null,
  };
}
