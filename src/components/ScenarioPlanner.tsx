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

  const recommendedScenario =
    isValidBudget && selectedCategories.length > 0
      ? [...scenarios]
          .reverse()
          .find(
            (scenario) =>
              scenario.products.length === selectedCategories.length &&
              scenario.total <= budget,
          )
      : undefined;

  // 5. Выбор категории
  function toggleCategory(category: string) {
    setChosenCategories(
      selectedCategories.includes(category)
        ? selectedCategories.filter((c) => c !== category)
        : [...selectedCategories, category],
    );
  }

  return (
    <section className="shop-panel shop-planner">
      <h2 className="shop-section-title">Планировщик покупок</h2>

      <p className="shop-muted">Сравните три варианта покупок.</p>

      <label className="shop-field shop-budget">
        Ваш бюджет ($):
        <input
          type="number"
          min="0"
          step="any"
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          className="shop-input"
        />
      </label>

      {!isValidBudget && (
        <p className="shop-status shop-status--danger">
          Введите положительный бюджет.
        </p>
      )}

      <fieldset className="shop-categories">
        <legend className="shop-label">Категории товаров</legend>

        {isValidBudget && selectedCategories.length > 0 && (
          <p>
            {recommendedScenario
              ? `Рекомендуем: ${
                  strategyNames[recommendedScenario.strategy]
                } — $${recommendedScenario.total.toFixed(2)}`
              : "Ни один полный набор не укладывается в бюджет."}
          </p>
        )}

        <div className="shop-checkbox-group">
          {categories.map((category) => (
            <label key={category} className="shop-checkbox">
              <input
                type="checkbox"
                checked={selectedCategories.includes(category)}
                onChange={() => toggleCategory(category)}
              />{" "}
              <span>{category}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {selectedCategories.length === 0 ? (
        <p className="shop-empty">Выберите хотя бы одну категорию.</p>
      ) : (
        <div className="shop-scenario-grid">
          {scenarios.map((scenario) => {
            const remaining = budget - scenario.total;

            return (
              <div key={scenario.strategy} className="shop-scenario-card">
                <h3 className="shop-card-title">
                  {strategyNames[scenario.strategy]}
                </h3>

                <div className="shop-scenario-items">
                  {scenario.products.map((product) => (
                    <p key={product.id}>
                      {product.title} — ${product.price.toFixed(2)}
                    </p>
                  ))}
                </div>

                <hr />

                <p className="shop-scenario-total">
                  <strong>Стоимость: ${scenario.total.toFixed(2)}</strong>
                </p>

                {isValidBudget && (
                  <p
                    className={`shop-status ${remaining >= 0 ? "shop-status--success" : "shop-status--danger"}`}
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
