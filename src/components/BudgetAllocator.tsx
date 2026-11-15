import { useState } from "react";

import type { ToolOutput } from "skybridge/server";
import type { AppType } from "@/server.js";
import { calculateSpentByCategory } from "@/lib/budget-allocator.js";

type CartItem = ToolOutput<AppType, "get-cart">["items"][number];

type Props = {
  items: CartItem[];
};

export default function BudgetAllocator({ items }: Props) {
  const totals = calculateSpentByCategory(items);
  const categories = Object.entries(totals);

  const [budget, setBudget] = useState("300");
  const [limits, setLimits] = useState<Record<string, number>>({});

  const isValidBudget =
    /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(budget) &&
    Number.isSafeInteger(Math.round(Number(budget) * 100));

  const budgetCents = isValidBudget ? Math.round(Number(budget) * 100) : null;

  const totalSpentCents = Object.values(totals).reduce(
    (sum, amount) => sum + amount,
    0,
  );

  const remainingCents =
    budgetCents === null ? null : budgetCents - totalSpentCents;

  const allocations = categories.map(([category, spentCents]) => ({
    category,
    spentCents,
    limitCents: limits[category] ?? spentCents,
  }));

  const allocatedCents = allocations.reduce(
    (sum, item) => sum + item.limitCents,
    0,
  );

  const unallocatedCents =
    budgetCents === null ? null : budgetCents - allocatedCents;

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="shop-panel shop-allocator">
      <h2 className="shop-section-title">Расходы по категориям</h2>

      <div className="shop-field shop-budget">
        <label htmlFor="allocator-budget">Общий бюджет</label>

        <input
          id="allocator-budget"
          className="shop-input"
          type="text"
          inputMode="decimal"
          aria-invalid={!isValidBudget}
          aria-describedby={!isValidBudget ? "allocator-budget-error" : undefined}
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
        />

        {!isValidBudget && (
          <p
            id="allocator-budget-error"
            className="shop-status shop-status--danger"
            role="alert"
          >
            Введите корректный бюджет
          </p>
        )}
      </div>

      <div className="allocator-categories">
        {allocations.map(({ category, spentCents, limitCents }) => (
          <div key={category} className="allocator-category">
            <p className="shop-card-title">
              <strong>{category}</strong>
            </p>

            <p className="allocator-allocation">
              <span>Выделено</span>
              <strong className="allocator-amount">
                ${(limitCents / 100).toFixed(2)}
              </strong>
            </p>

            <input
              type="range"
              min={0}
              max={Math.max(budgetCents ?? 0, spentCents, limitCents, 1)}
              step={1}
              value={limitCents}
              disabled={budgetCents === null}
              aria-label={`Бюджет категории ${category}`}
              className="allocator-range"
              onChange={(event) => {
                setLimits((previous) => ({
                  ...previous,
                  [category]: Number(event.target.value),
                }));
              }}
            />

            <p className="allocator-spent">
              <span>В корзине</span>
              <strong>${(spentCents / 100).toFixed(2)}</strong>
            </p>

            {limitCents < spentCents && (
              <p className="shop-status shop-status--danger" role="status">
                Превышение лимита на $
                {((spentCents - limitCents) / 100).toFixed(2)}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="allocator-summary">
        {unallocatedCents !== null && (
          <p
            className={`allocator-summary-item ${unallocatedCents >= 0 ? "shop-status--success" : "shop-status--danger"}`}
            role="status"
          >
            <span className="allocator-summary-label">
              {unallocatedCents >= 0
                ? "Не распределено"
                : "Распределено сверх бюджета"}
            </span>
            <strong className="allocator-summary-value">
              ${(Math.abs(unallocatedCents) / 100).toFixed(2)}
            </strong>
            <span className="allocator-summary-caption">По лимитам категорий</span>
          </p>
        )}

        <p className="allocator-summary-item">
          <span className="allocator-summary-label">Всего в корзине</span>
          <strong className="allocator-summary-value">
            ${(totalSpentCents / 100).toFixed(2)}
          </strong>
        </p>

        {remainingCents !== null && (
          <p
            className={`allocator-summary-item ${remainingCents >= 0 ? "shop-status--success" : "shop-status--danger"}`}
          >
            <span className="allocator-summary-label">
              {remainingCents >= 0 ? "Остаток" : "Превышение"}
            </span>
            <strong className="allocator-summary-value">
              ${(Math.abs(remainingCents) / 100).toFixed(2)}
            </strong>
            <span className="allocator-summary-caption">По расходам корзины</span>
          </p>
        )}
      </div>
    </section>
  );
}
