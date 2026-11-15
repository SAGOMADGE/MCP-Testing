type CartExpenseItem = {
  quantity: number;
  products: {
    category: string;
    price: number;
  };
};

export function calculateSpentByCategory(items: CartExpenseItem[]) {
  const totals: Record<string, number> = {};

  for (const item of items) {
    const category = item.products.category;
    const priceCents = Math.round(item.products.price * 100);

    totals[category] = (totals[category] ?? 0) + priceCents * item.quantity;
  }

  return totals;
}
