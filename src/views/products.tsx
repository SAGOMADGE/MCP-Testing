import { useToolInfo, useCallTool } from "@/helpers.js";

import { useState } from "react";
import { useUser } from "skybridge/web";

import ScenarioPlanner from "@/components/ScenarioPlanner.js";
import "../index.css";

export default function Products() {
  const { theme } = useUser();

  // 1. Получаем каталог товаров
  const { output, isPending } = useToolInfo<"get-products">();

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );

  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);

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

  const {
    callTool: getProductDetails,
    data: detailsData,
    isPending: isLoadingDetails,
  } = useCallTool("get-product-details");

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
    return (
      <div className="shopping-app" data-theme={theme}>
        <p className="shop-empty">Загрузка товаров...</p>
      </div>
    );
  }

  return (
    <main className="shopping-app" data-theme={theme}>
      <h2 className="shop-title">Каталог товаров</h2>
      <div className="shop-panel shop-filters">
        <label className="shop-field">
          Поиск товаров
          <input
            type="text"
            placeholder="Поиск товаров..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="shop-input"
          />
        </label>
        <label className="shop-field">
          Категория
          <select
            className="shop-input"
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
        </label>
        <label className="shop-field">
          Цена до ($)
          <input
            type="number"
            min="0"
            placeholder="Цена до ($)"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            className="shop-input"
          />
        </label>
      </div>

      <p className="shop-results">Найдено товаров: {filteredProducts.length}</p>

      <button
        className="shop-button shop-planner-toggle"
        type="button"
        onClick={() => setIsPlannerOpen(!isPlannerOpen)}
        aria-expanded={isPlannerOpen}
      >
        {isPlannerOpen ? "Скрывать планировщик" : "Спланировать покупки"}
      </button>

      <div className="shop-planner-region" hidden={!isPlannerOpen}>
        <ScenarioPlanner products={products} />
      </div>

      {/* Кнопка просмотра корзины */}
      <button
        className="shop-button shop-cart-toggle"
        onClick={() => getCart()}
        disabled={isLoadingCart}
      >
        {isLoadingCart ? "Загрузка корзины..." : "Посмотреть корзину"}
      </button>
      {/* Содержимое корзины */}
      {cartData && (
        <section className="shop-panel shop-cart">
          <h2 className="shop-section-title">Моя корзина</h2>

          {cartData.structuredContent.items.length === 0 && (
            <p className="shop-empty">Корзина пуста</p>
          )}

          {cartData.structuredContent.items.map((item) => (
            <div className="shop-cart-item" key={item.product_id}>
              <h3 className="shop-cart-title">{item.products.title}</h3>

              <div className="shop-quantity">
                <button
                  className="shop-button"
                  aria-label={`Уменьшить количество: ${item.products.title}`}
                  disabled={isUpdating || item.quantity <= 1}
                  onClick={() =>
                    handleQuantityChange(item.product_id, item.quantity - 1)
                  }
                >
                  −
                </button>

                <span>{item.quantity}</span>

                <button
                  className="shop-button"
                  aria-label={`Увеличить количество: ${item.products.title}`}
                  disabled={isUpdating}
                  onClick={() =>
                    handleQuantityChange(item.product_id, item.quantity + 1)
                  }
                >
                  +
                </button>
              </div>

              <button
                className="shop-button shop-button--danger"
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

              <p className="shop-muted shop-cart-unit-price">
                Цена: ${item.products.price}
              </p>

              <p className="shop-cart-line-total">
                Сумма: ${(item.products.price * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}

          <h3 className="shop-cart-total">
            Итого: $
            {cartData.structuredContent.items
              .reduce(
                (sum, item) => sum + item.products.price * item.quantity,
                0,
              )
              .toFixed(2)}
          </h3>
        </section>
      )}
      {/*
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////
      */}

      {/* Каталог товаров */}
      <div className="shop-product-grid">
        {filteredProducts.map((product) => (
          <article key={product.id} className="shop-product-card">
            <div className="shop-product-image">
              <img src={product.image} alt={product.title} />
            </div>

            <p className="shop-product-category">{product.category}</p>
            <h3 className="shop-card-title">{product.title}</h3>

            <p className="shop-product-price">Цена: ${product.price}</p>

            <button
              className="shop-button"
              disabled={isLoadingDetails}
              onClick={() => {
                if (expandedCardId === product.id) {
                  setExpandedCardId(null);
                  setSelectedProductId(null);
                  return;
                }

                setExpandedCardId(product.id);
                setSelectedProductId(product.id);

                getProductDetails({
                  productId: product.id,
                });
              }}
            >
              {expandedCardId === product.id
                ? "Скрывать подробности"
                : "Подробнее"}
            </button>

            {expandedCardId === product.id && (
              <div className="shop-product-details">
                {isLoadingDetails ? (
                  <p>Загрузка информации...</p>
                ) : detailsData?.structuredContent?.product?.id ===
                  selectedProductId ? (
                  <>
                    <h4>{detailsData.structuredContent.product.title}</h4>

                    <p>{detailsData.structuredContent.product.description}</p>

                    <p>
                      Категория: {detailsData.structuredContent.product.category}
                    </p>

                    <h4>Похожие товары</h4>

                    {detailsData.structuredContent.relatedProducts.length ===
                    0 ? (
                      <p>Похожих товаров нет.</p>
                    ) : (
                      detailsData.structuredContent.relatedProducts.map(
                        (related) => (
                          <div
                            key={related.id}
                            className="shop-related-item"
                          >
                            <span>
                              {related.title} - ${related.price}
                            </span>

                            <button
                              className="shop-button"
                              disabled={isLoadingDetails}
                              onClick={() => {
                                setSelectedProductId(related.id);

                                getProductDetails({
                                  productId: related.id,
                                });
                              }}
                            >
                              Изучить товар
                            </button>
                          </div>
                        ),
                      )
                    )}
                  </>
                ) : (
                  <p>Не удалось показать информацию о товаре</p>
                )}
              </div>
            )}

            <button
              className="shop-button shop-button--primary"
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
          </article>
        ))}
      </div>
    </main>
  );
}
