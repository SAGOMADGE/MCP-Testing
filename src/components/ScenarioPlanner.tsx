import { useMemo, useState } from "react";

import {
  calculateScenarios,
  type Product,
  type Strategy,
} from "../lib/scenario-modeler.js";

type Props = {
  products: Product[];
};

const strategyNames: Record<Strategy, string> = {
  economy: "Экономный",
  balanced: "Сбалансированный",
  premium: "Премиальный",
};

export default function ScenarioPlanner({ products }: Props) {
  // 1. Бюджет пользователя
  const [budgetInput, setBudgetInput] = useState("500");

  // 2. Категории из загруженного каталога
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  // null означает, что выбраны все категории
  const [chosenCategories, setChosenCategories] = useState<string[] | null>(
    null,
  );

  const selectedCategories = chosenCategories ?? categories;

  // 3. Рассчитываем три сценария
  const scenarios = useMemo(
    () => calculateScenarios(products, selectedCategories),
    [products, selectedCategories],
  );

  // 4. Проверяем бюджет
  const budget = Number(budgetInput);

  const isValidBudget =
    budgetInput.trim() !== "" && Number.isFinite(budget) && budget > 0;

  // 5. Выбор категории
  function toggleCategory(category: string) {
    setChosenCategories(
      selectedCategories.includes(category)
        ? selectedCategories.filter((c) => c !== category)
        : [...selectedCategories, category],
    );
  }

  return (
    <section
      style={{
        padding: 20,
        marginTop: 24,
        border: "1px solid #ddd",
        borderRadius: 12,
      }}
    >
      <h2>Планировщик покупок</h2>

      <p>Сравните три варианта покупок.</p>

      <label>
        Ваш бюджет ($):
        <input
          type="number"
          min="0"
          step="any"
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          style={{
            display: "block",
            padding: 8,
            marginTop: 8,
          }}
        />
      </label>

      {!isValidBudget && (
        <p style={{ color: "crimson" }}>Введите положительный бюджет.</p>
      )}

      <h3>Категории товаров</h3>

      {categories.map((category) => (
        <label key={category} style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={selectedCategories.includes(category)}
            onChange={() => toggleCategory(category)}
          />{" "}
          {category}
        </label>
      ))}

      {selectedCategories.length === 0 ? (
        <p>Выберите хотя бы одну категорию.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
            marginTop: 20,
          }}
        >
          {scenarios.map((scenario) => {
            const remaining = budget - scenario.total;

            return (
              <div
                key={scenario.strategy}
                style={{
                  padding: 12,
                  border: "1px solid #ccc",
                  borderRadius: 8,
                }}
              >
                <h3>{strategyNames[scenario.strategy]}</h3>

                {scenario.products.map((product) => (
                  <p key={product.id}>
                    {product.title} — ${product.price.toFixed(2)}
                  </p>
                ))}

                <hr />

                <p>
                  <strong>Стоимость: ${scenario.total.toFixed(2)}</strong>
                </p>

                {isValidBudget && (
                  <p
                    style={{
                      color: remaining >= 0 ? "green" : "crimson",
                    }}
                  >
                    {remaining >= 0
                      ? `Останется: $${remaining.toFixed(2)}`
                      : `Не хватает: $${Math.abs(remaining).toFixed(2)}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
