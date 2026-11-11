import { useToolInfo, useCallTool } from "@/helpers.js";

import { useState } from "react";

export default function Products() {
  // 1. Получаем каталог товаров
  const { output, isPending } = useToolInfo<"get-products">();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");

  // 2. Инструмент добавления товара
  const { callTool: addToCart, isPending: isAdding } =
    useCallTool("add-to-cart");

  // 3. Инструмент получения корзины
  const {
    callTool: getCart,
    data: cartData,
    isPending: isLoadingCart,
  } = useCallTool("get-cart");

  const { callTool: updateCartItem, isPending: isUpdating } =
    useCallTool("update-cart-item");

  const { callTool: removeFromCart, isPending: isRemoving } =
    useCallTool("remove-from-cart");

  const products = output?.products ?? [];

  const categories = [
    ...new Set(products.map((product) => product.category)),
  ].sort();

  const filteredProducts = products.filter((product) => {
    const matchSearch = product.title
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || product.category === selectedCategory;

    const matchesPrice = maxPrice === "" || product.price <= Number(maxPrice);

    return matchSearch && matchesCategory && matchesPrice;
  });

  function handleQuantityChange(productId: number, newQuantity: number) {
    if (newQuantity < 1) return;

    updateCartItem(
      {
        productId,
        quantity: newQuantity,
      },
      {
        onSuccess: (result) => {
          if (!result.isError && result.structuredContent?.saved) {
            getCart();
          }
        },
        onError: (error) => {
          console.error(`Ошибка количества: ${error}`);
        },
      },
    );
  }

  if (isPending) {
    return <p>Загрузка товаров...</p>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Каталог товаров</h2>

      <input
        type="text"
        placeholder="Поиск товаров..."
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        style={{
          padding: 10,
          width: "100%",
          maxWidth: 350,
          marginBottom: 16,
        }}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <select
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
        >
          <option value="all">Все категории</option>

          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="0"
          placeholder="Цена до ($)"
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          style={{ padding: 8, width: 140 }}
        />
      </div>

      <p>Найдено товаров: {filteredProducts.length}</p>

      {/* Кнопка просмотра корзины */}
      <button onClick={() => getCart()} disabled={isLoadingCart}>
        {isLoadingCart ? "Загрузка корзины..." : "Посмотреть корзину"}
      </button>

      {/* Содержимое корзины */}
      {cartData && (
        <div>
          <h2>Моя корзина</h2>

          {cartData.structuredContent.items.length === 0 && (
            <p>Корзина пуста</p>
          )}

          {cartData.structuredContent.items.map((item) => (
            <div key={item.product_id}>
              <h3>{item.products.title}</h3>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  disabled={isUpdating || item.quantity <= 1}
                  onClick={() =>
                    handleQuantityChange(item.product_id, item.quantity - 1)
                  }
                >
                  −
                </button>

                <span>{item.quantity}</span>

                <button
                  disabled={isUpdating}
                  onClick={() =>
                    handleQuantityChange(item.product_id, item.quantity + 1)
                  }
                >
                  +
                </button>
              </div>

              <button
                disabled={isRemoving}
                onClick={() =>
                  removeFromCart(
                    { productId: item.product_id },
                    {
                      onSuccess: (result) => {
                        if (
                          !result.isError &&
                          result.structuredContent?.removed
                        ) {
                          getCart();
                        }
                      },
                      onError: (error) => {
                        console.error("Ошибка удаления:", error);
                      },
                    },
                  )
                }
              >
                {isRemoving ? "Удаляем..." : "Удалить из корзины"}
              </button>

              <p>Цена: ${item.products.price}</p>

              <p>Сумма: ${(item.products.price * item.quantity).toFixed(2)}</p>
            </div>
          ))}

          <h3>
            Итого: $
            {cartData.structuredContent.items
              .reduce(
                (sum, item) => sum + item.products.price * item.quantity,
                0,
              )
              .toFixed(2)}
          </h3>
        </div>
      )}

      {/* Каталог товаров */}
      {filteredProducts.map((product) => (
        <div
          key={product.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            marginTop: 12,
          }}
        >
          <img
            src={product.image}
            alt={product.title}
            style={{
              width: 120,
              height: 120,
              objectFit: "contain",
            }}
          />

          <h3>{product.title}</h3>

          <p>Цена: ${product.price}</p>

          <button
            disabled={isAdding}
            onClick={() =>
              addToCart(
                {
                  productId: product.id,
                  quantity: 1,
                },
                {
                  onSuccess: (result) => {
                    if (!result.isError && result.structuredContent?.saved) {
                      getCart();
                    }
                  },
                  onError: (error) => {
                    console.error("Ошибка добавления:", error);
                  },
                },
              )
            }
          >
            {isAdding ? "Добавляем..." : "Добавить в корзину"}
          </button>
        </div>
      ))}
    </div>
  );
}
