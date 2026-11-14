import { useId, useMemo, useState } from "react";

import {
  calculateScenarios,
  parseBudget,
  toCents,
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

const strategyDescriptions: Record<Strategy, string> = {
  economy: "Самый дешёвый товар в каждой категории.",
  balanced:
    "Средний товар по порядку цен в каждой категории. При чётном количестве — более дешёвый из двух средних.",
  premium: "Самый дорогой товар в каждой категории.",
};

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ScenarioPlanner({ products }: Props) {
  const budgetErrorId = useId();
  const [budgetInput, setBudgetInput] = useState("500");
  const budgetCents = parseBudget(budgetInput);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  // null означает, что выбраны все категории загруженного каталога.
  const [chosenCategories, setChosenCategories] = useState<string[] | null>(null);
  const selectedCategories = chosenCategories ?? categories;
  // Исчезнувшую из каталога выбранную категорию можно снять вручную.
  const categoryOptions = [
    ...new Set([...categories, ...selectedCategories]),
  ].sort();

  const { scenarios, missingCategories, recommendedStrategy } = useMemo(
    () => calculateScenarios(products, selectedCategories, budgetCents),
    [products, selectedCategories, budgetCents],
  );
  const isComplete = missingCategories.length === 0;

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
      <p className="shop-muted">
        Сравните три набора: по одному товару из каждой выбранной категории.
      </p>

      <label className="shop-field">
        Ваш бюджет ($):
        <input
          type="text"
          inputMode="decimal"
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          aria-invalid={budgetCents === null}
          aria-describedby={budgetCents === null ? budgetErrorId : undefined}
          className="shop-input"
        />
      </label>

      {budgetCents === null && (
        <p id={budgetErrorId} className="shop-notice shop-notice--danger">
          Введите положительный бюджет, например 500 или 500,50 (не более двух
          знаков после запятой).
        </p>
      )}

      <fieldset className="shop-fieldset">
        <legend className="shop-label">Категории товаров</legend>
        <div className="shop-checkbox-group">
          {categoryOptions.map((category) => (
            <label key={category} className="shop-checkbox">
              <input
                type="checkbox"
                checked={selectedCategories.includes(category)}
                onChange={() => toggleCategory(category)}
              />{" "}
              {category}
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite">
        {products.length === 0 && (
          <p className="shop-empty">В каталоге пока нет товаров для сравнения.</p>
        )}
        {selectedCategories.length === 0 && products.length > 0 && (
          <p className="shop-empty">Выберите хотя бы одну категорию.</p>
        )}
        {!isComplete && (
          <p className="shop-notice shop-notice--danger">
            Нет товаров в категориях: {missingCategories.join(", ")}. Наборы
            неполные: ниже указана только стоимость найденных товаров. Оценка
            бюджета и рекомендация недоступны.
          </p>
        )}
        {recommendedStrategy !== null && (
          <p className="shop-notice shop-notice--accent">
            <strong>Рекомендуем: {strategyNames[recommendedStrategy]}.</strong>{" "}
            Это самый дорогой из трёх наборов, который укладывается в бюджет.
            При равной стоимости выбираем более экономную стратегию. Более
            высокая цена не означает более высокое качество.
          </p>
        )}
        {isComplete &&
          budgetCents !== null &&
          scenarios.length > 0 &&
          recommendedStrategy === null && (
            <p className="shop-notice shop-notice--danger">
              Ни один полный набор не укладывается в бюджет. Даже для экономного
              нужно {formatMoney(scenarios[0].totalCents)} — не хватает{" "}
              {formatMoney(scenarios[0].totalCents - budgetCents)}. Увеличьте бюджет
              или сократите число категорий.
            </p>
          )}
      </div>

      {scenarios.length > 0 && (
        <div className="shop-scenario-grid">
          {scenarios.map((scenario) => (
            <div
              key={scenario.strategy}
              className={`shop-scenario-card${scenario.strategy === recommendedStrategy ? " shop-scenario-card--recommended" : ""}`}
            >
              <h3 className="shop-card-title">{strategyNames[scenario.strategy]}</h3>
              {scenario.strategy === recommendedStrategy && (
                <span className="shop-badge">Рекомендуем</span>
              )}
              <p className="shop-muted">{strategyDescriptions[scenario.strategy]}</p>

              {scenario.products.length === 0 ? (
                <p className="shop-empty">В выбранных категориях нет товаров.</p>
              ) : (
                <ul className="shop-scenario-items">
                  {scenario.products.map((product) => (
                    <li key={product.id}>
                      <strong>{product.category}:</strong> {product.title} —{" "}
                      {formatMoney(toCents(product.price))}
                    </li>
                  ))}
                </ul>
              )}

              <hr />
              <p className="shop-scenario-total">
                <strong>
                  {isComplete ? "Стоимость" : "Стоимость найденных товаров"}:{" "}
                  {formatMoney(scenario.totalCents)}
                </strong>
              </p>

              {scenario.remainingCents !== null && (
                <p
                  className={`shop-status ${scenario.remainingCents >= 0 ? "shop-status--success" : "shop-status--danger"}`}
                >
                  {scenario.remainingCents >= 0
                    ? `В бюджете. Останется: ${formatMoney(scenario.remainingCents)}`
                    : `Сверх бюджета. Не хватает: ${formatMoney(-scenario.remainingCents)}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
