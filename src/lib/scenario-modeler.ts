export type Product = {
  id: number;
  title: string;
  price: number;
  category: string;
};

export type Strategy = "economy" | "balanced" | "premium";

export function calculateScenarios(
  products: Product[],
  selectedCategories: string[],
) {
  const categories = [...new Set(selectedCategories)];

  function createScenario(strategy: Strategy) {
    const selectedProducts = categories.flatMap((category) => {
      const items = products
        .filter((product) => product.category === category)
        .sort((a, b) => a.price - b.price);

      if (items.length === 0) return [];

      let selected: Product | undefined;

      if (strategy === "economy") {
        selected = items[0];
      } else if (strategy === "premium") {
        selected = items[items.length - 1];
      } else {
        const middle = Math.floor((items.length - 1) / 2);

        selected = items[middle];
      }

      return selected ? [selected] : [];
    });

    const total = selectedProducts.reduce(
      (sum, product) => sum + product.price,
      0,
    );

    return {
      strategy,
      products: selectedProducts,
      total: Math.floor(total * 100) / 100,
    };
  }

  return [
    createScenario("economy"),
    createScenario("balanced"),
    createScenario("premium"),
  ];
}
