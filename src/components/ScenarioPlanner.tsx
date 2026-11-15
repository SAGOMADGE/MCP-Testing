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

  const budgetCents = Math.round(budget * 100);

  const isValidBudget =
    /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(budgetInput) &&
    budget > 0 &&
    Number.isSafeInteger(budgetCents);
  const recommendedScenario =
    isValidBudget && selectedCategories.length > 0
      ? [...scenarios]
          .reverse()
          .find(
            (scenario) =>
              scenario.products.length === selectedCategories.length &&
              Math.round(scenario.total * 100) <= budgetCents,
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
          type="text"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          className="shop-input"
        />
      </label>

      {!isValidBudget && (
        <p className="shop-status shop-status--danger">
          Введите корректный положительный бюджет
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
            const remainingCents =
              budgetCents - Math.round(scenario.total * 100);

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
                    className={`shop-status ${remainingCents >= 0 ? "shop-status--success" : "shop-status--danger"}`}
                  >
                    {remainingCents >= 0
                      ? `Останется: $${(remainingCents / 100).toFixed(2)}`
                      : `Не хватает: $${Math.abs(remainingCents / 100).toFixed(2)}`}
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
