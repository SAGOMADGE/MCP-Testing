import { useToolInfo, useCallTool } from "@/helpers.js";
import "@/index.css";

import { useId, useState } from "react";
import { useUser } from "skybridge/web";

import ScenarioPlanner from "@/components/ScenarioPlanner.js";

export default function Products() {
  // 1. Получаем каталог товаров
  const { output, isPending } = useToolInfo<"get-products">();
  const { theme } = useUser();

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );

  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const plannerId = useId();

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
        <p className="shop-empty" role="status">Загрузка товаров...</p>
      </div>
    );
  }

  return (
    <main className="shopping-app" data-theme={theme}>
      <header className="shop-header">
        <h1 className="shop-title">Каталог товаров</h1>
        <p className="shop-muted">Выбирайте товары и планируйте покупки в рамках бюджета.</p>
      </header>
      <div className="shop-panel shop-toolbar">
        <label className="shop-field shop-field--search">
          <span className="shop-label">Поиск товаров</span>
          <input
        className="shop-input"
        type="text"
        placeholder="Поиск товаров..."
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
      />
        </label>
        <label className="shop-field">
          <span className="shop-label">Категория</span>
          <select
          className="shop-select"
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
          <span className="shop-label">Цена до ($)</span>
          <input
          className="shop-input"
          type="number"
          min="0"
          placeholder="Цена до ($)"
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
        />
        </label>
      </div>

      <p className="shop-results" role="status">Найдено товаров: {filteredProducts.length}</p>

      <div className="shop-actions">
        <button
          className="shop-button shop-planner-toggle"
          type="button"
          aria-expanded={isPlannerOpen}
          aria-controls={plannerId}
          onClick={() => setIsPlannerOpen((isOpen) => !isOpen)}
        >
          {isPlannerOpen ? "Скрыть планировщик" : "Спланировать покупки"}
        </button>
      {/* Кнопка просмотра корзины */}
      <button className="shop-button" type="button" onClick={() => getCart()} disabled={isLoadingCart}>
        {isLoadingCart ? "Загрузка корзины..." : "Посмотреть корзину"}
      </button>
      </div>
      {/* Не размонтируем планировщик, чтобы сохранить бюджет и категории. */}
      <div className="shop-planner-region" id={plannerId} hidden={!isPlannerOpen}>
        <ScenarioPlanner products={products} />
      </div>
      {/* Содержимое корзины */}
      {cartData && (
        <section className="shop-panel shop-cart" aria-label="Моя корзина">
          <h2 className="shop-section-title">Моя корзина</h2>

          {cartData.structuredContent.items.length === 0 && (
            <p className="shop-empty">Корзина пуста. Добавьте товары из каталога.</p>
          )}

          <div className="shop-cart-items">
          {cartData.structuredContent.items.map((item) => (
            <div className="shop-cart-item" key={item.product_id}>
              <div className="shop-cart-info">
                <h3 className="shop-card-title">{item.products.title}</h3>
                <p className="shop-muted">Цена: ${item.products.price.toFixed(2)}</p>
                <p className="shop-cart-price">Сумма: ${(item.products.price * item.quantity).toFixed(2)}</p>
              </div>

              <div className="shop-cart-controls">
              <div className="shop-quantity" role="group" aria-label={`Количество: ${item.products.title}`}>
                <button
                  className="shop-button shop-button--small"
                  type="button"
                  aria-label={`Уменьшить количество: ${item.products.title}`}
                  disabled={isUpdating || item.quantity <= 1}
                  onClick={() =>
                    handleQuantityChange(item.product_id, item.quantity - 1)
                  }
                >
                  −
                </button>

                <span aria-live="polite">{item.quantity}</span>

                <button
                  className="shop-button shop-button--small"
                  type="button"
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
                type="button"
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
              </div>
            </div>
          ))}
          </div>

          <p className="shop-cart-total">
            Итого: $
            {cartData.structuredContent.items
              .reduce(
                (sum, item) => sum + item.products.price * item.quantity,
                0,
              )
              .toFixed(2)}
          </p>
        </section>
      )}

      {/* Каталог товаров */}
      {filteredProducts.length === 0 && (
        <p className="shop-empty">Товары не найдены. Попробуйте изменить поиск или фильтры.</p>
      )}
      <div className="shop-product-grid">
      {filteredProducts.map((product) => (
        <article
          className="shop-product-card"
          key={product.id}
        >
          <div className="shop-product-image">
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
          />
          </div>

          <p className="shop-product-category">{product.category}</p>
          <h2 className="shop-product-title">{product.title}</h2>

          <p className="shop-product-price">${product.price.toFixed(2)}</p>

          <button
            className="shop-button"
            type="button"
            aria-expanded={expandedCardId === product.id}
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
              ? "Скрыть подробности"
              : "Подробнее"}
          </button>

          {expandedCardId === product.id && (
            <div
              className="shop-product-details"
            >
              {isLoadingDetails ? (
                <p className="shop-muted" role="status">Загрузка информации...</p>
              ) : detailsData?.structuredContent?.product?.id ===
                selectedProductId ? (
                <>
                  <h3 className="shop-card-title">{detailsData.structuredContent.product.title}</h3>

                  <p>{detailsData.structuredContent.product.description}</p>

                  <p className="shop-muted">
                    Категория: {detailsData.structuredContent.product.category}
                  </p>

                  <h3 className="shop-card-title">Похожие товары</h3>

                  {detailsData.structuredContent.relatedProducts.length ===
                  0 ? (
                    <p className="shop-muted">Похожих товаров нет.</p>
                  ) : (
                    detailsData.structuredContent.relatedProducts.map(
                      (related) => (
                        <div
                          className="shop-related-item"
                          key={related.id}
                        >
                          <span>
                            {related.title} — ${related.price.toFixed(2)}
                          </span>

                          <button
                            className="shop-button shop-button--small"
                            type="button"
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
                <p className="shop-status shop-status--danger">Не удалось показать информацию о товаре</p>
              )}
            </div>
          )}

          <button
            className="shop-button shop-button--primary shop-button--wide"
            type="button"
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
