import { useToolInfo,useCallTool } from "@/helpers.js";
import "@/index.css";

import { useId,useMemo,useRef,useState } from "react";
import { useUser } from "skybridge/web";

import ScenarioPlanner from "@/components/ScenarioPlanner.js";
import {
  CartResultSchema,
  ProductDetailsResultSchema,
  ProductsResultSchema,
  RemovedCartItemResultSchema,
  SavedCartItemResultSchema,
  readToolResult,
  type CartItem,
  type CatalogProduct,
  type ProductDetails,
} from "@/lib/tool-results.js";

type CartAction={ kind: "add"|"update"|"remove"; productId: number; };

export default function Products() {
  // 1. Получаем каталог товаров
  const { output,isPending }=useToolInfo<"get-products">();
  const { theme }=useUser();

  const [searchQuery,setSearchQuery]=useState("");

  const [selectedProductId,setSelectedProductId]=useState<number|null>(
    null,
  );

  const [expandedCardId,setExpandedCardId]=useState<number|null>(null);

  const [selectedCategory,setSelectedCategory]=useState("all");
  const [maxPrice,setMaxPrice]=useState("");
  const [isPlannerOpen,setIsPlannerOpen]=useState(false);
  const plannerId=useId();

  const { callToolAsync: getProducts,isPending: isReloadingProducts }=useCallTool("get-products");
  const { callToolAsync: addToCart }=useCallTool("add-to-cart");
  const { callToolAsync: getCart,isPending: isLoadingCart }=useCallTool("get-cart");
  const { callToolAsync: updateCartItem }=useCallTool("update-cart-item");
  const { callToolAsync: removeFromCart }=useCallTool("remove-from-cart");
  const { callToolAsync: getProductDetails,isPending: isLoadingDetails }=useCallTool("get-product-details");

  const catalog=useMemo(() => ProductsResultSchema.safeParse(output),[output]);
  const [reloadedProducts,setReloadedProducts]=useState<CatalogProduct[]|null>(null);
  const [catalogError,setCatalogError]=useState<string|null>(null);
  const products=reloadedProducts??(catalog.success? catalog.data.products:[]);

  const [cartItems,setCartItems]=useState<CartItem[]|null>(null);
  const [isCartVisible,setIsCartVisible]=useState(false);
  const [cartError,setCartError]=useState<string|null>(null);
  const [cartActionError,setCartActionError]=useState<string|null>(null);
  const [pendingAction,setPendingAction]=useState<CartAction|null>(null);
  const cartActionLock=useRef(false);
  const cartRequestId=useRef(0);
  const isCartBusy=pendingAction!==null||isLoadingCart;

  const [details,setDetails]=useState<ProductDetails|null>(null);
  const [detailsError,setDetailsError]=useState<string|null>(null);
  const detailsRequestId=useRef(0);

  const categories=[
    ...new Set(products.map((product) => product.category)),
  ].sort();

  const filteredProducts=products.filter((product) => {
    const matchSearch=product.title
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());

    const matchesCategory=
      selectedCategory==="all"||product.category===selectedCategory;

    const matchesPrice=maxPrice===""||product.price<=Number(maxPrice);

    return matchSearch&&matchesCategory&&matchesPrice;
  });

  async function reloadProducts() {
    setCatalogError(null);
    try {
      const result=readToolResult(await getProducts(),ProductsResultSchema);
      setReloadedProducts(result.products);
    } catch {
      setCatalogError("Не удалось загрузить каталог. Попробуйте ещё раз.");
    }
  }

  async function refreshCart() {
    const requestId=++cartRequestId.current;
    setIsCartVisible(true);
    setCartError(null);
    try {
      const result=readToolResult(await getCart(),CartResultSchema);
      // Поздний ответ старого запроса не должен заменить свежую корзину.
      if(requestId===cartRequestId.current) setCartItems(result.items);
    } catch {
      if(requestId===cartRequestId.current) {
        setCartError("Не удалось обновить корзину. Последние загруженные данные могут быть неактуальны.");
      }
    }
  }

  async function runCartAction(action: CartAction,operation: () => Promise<void>) {
    if(cartActionLock.current||isLoadingCart) return;
    cartActionLock.current=true;
    setPendingAction(action);
    setCartActionError(null);
    try {
      await operation();
      await refreshCart();
    } catch {
      const actionNames={ add: "добавление товара",update: "изменение количества",remove: "удаление товара" };
      setCartActionError(`Не удалось подтвердить ${actionNames[action.kind]}. Обновите корзину и проверьте результат перед повтором действия.`);
    } finally {
      cartActionLock.current=false;
      setPendingAction(null);
    }
  }

  function handleAddToCart(productId: number) {
    void runCartAction({ kind: "add",productId },async () => {
      const result=readToolResult(await addToCart({ productId,quantity: 1 }),SavedCartItemResultSchema);
      if(result.productId!==productId) throw new Error("Ответ содержит другой товар.");
    });
  }

  function handleQuantityChange(productId: number,quantity: number) {
    if(quantity<1) return;
    void runCartAction({ kind: "update",productId },async () => {
      const result=readToolResult(await updateCartItem({ productId,quantity }),SavedCartItemResultSchema);
      if(result.productId!==productId||result.quantity!==quantity) throw new Error("Количество не подтверждено.");
    });
  }

  function handleRemoveFromCart(productId: number) {
    void runCartAction({ kind: "remove",productId },async () => {
      const result=readToolResult(await removeFromCart({ productId }),RemovedCartItemResultSchema);
      if(result.productId!==productId) throw new Error("Ответ содержит другой товар.");
    });
  }

  async function loadProductDetails(productId: number) {
    const requestId=++detailsRequestId.current;
    setSelectedProductId(productId);
    setDetails(null);
    setDetailsError(null);
    try {
      const result=readToolResult(await getProductDetails({ productId }),ProductDetailsResultSchema);
      if(result.product.id!==productId) throw new Error("Ответ содержит другой товар.");
      if(requestId===detailsRequestId.current) setDetails(result);
    } catch {
      if(requestId===detailsRequestId.current) setDetailsError("Не удалось загрузить подробности товара. Попробуйте ещё раз.");
    }
  }

  if(isPending&&reloadedProducts===null) {
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
      {(catalogError||(!catalog.success&&reloadedProducts===null))&&(
        <div className="shop-notice shop-notice--danger" role="alert">
          <p>{catalogError??"Не удалось получить каталог товаров."}</p>
          <button className="shop-button" type="button" disabled={isReloadingProducts} onClick={() => void reloadProducts()}>
            {isReloadingProducts? "Загрузка каталога...":"Повторить загрузку каталога"}
          </button>
        </div>
      )}
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
          {isPlannerOpen? "Скрыть планировщик":"Спланировать покупки"}
        </button>
        {/* Кнопка просмотра корзины */}
        <button className="shop-button" type="button" onClick={() => void refreshCart()} disabled={isCartBusy}>
          {isLoadingCart? "Загрузка корзины...":isCartVisible? "Обновить корзину":"Посмотреть корзину"}
        </button>
      </div>
      {cartActionError&&<p className="shop-notice shop-notice--danger" role="alert">{cartActionError}</p>}
      {pendingAction&&<p className="shop-muted" role="status">Сохраняем изменения корзины...</p>}
      {/* Не размонтируем планировщик, чтобы сохранить бюджет и категории. */}
      <div className="shop-planner-region" id={plannerId} hidden={!isPlannerOpen}>
        <ScenarioPlanner products={products} />
      </div>
      {/* Содержимое корзины */}
      {isCartVisible&&(
        <section className="shop-panel shop-cart" aria-label="Моя корзина" aria-busy={isCartBusy}>
          <h2 className="shop-section-title">Моя корзина</h2>
          {isLoadingCart&&<p className="shop-muted" role="status">Обновляем корзину...</p>}
          {cartError&&(
            <div className="shop-notice shop-notice--danger" role="alert">
              <p>{cartError}</p>
              <button className="shop-button" type="button" onClick={() => void refreshCart()} disabled={isCartBusy}>Повторить загрузку корзины</button>
            </div>
          )}

          {cartItems?.length===0&&(
            <p className="shop-empty">Корзина пуста. Добавьте товары из каталога.</p>
          )}

          <div className="shop-cart-items">
            {(cartItems??[]).map((item) => (
              <div className="shop-cart-item" key={item.product_id}>
                <div className="shop-cart-info">
                  <h3 className="shop-card-title">{item.products.title}</h3>
                  <p className="shop-muted">Цена: ${item.products.price.toFixed(2)}</p>
                  <p className="shop-cart-price">Сумма: ${(item.products.price*item.quantity).toFixed(2)}</p>
                </div>

                <div className="shop-cart-controls">
                  <div className="shop-quantity" role="group" aria-label={`Количество: ${item.products.title}`}>
                    <button
                      className="shop-button shop-button--small"
                      type="button"
                      aria-label={`Уменьшить количество: ${item.products.title}`}
                      disabled={isCartBusy||cartError!==null||item.quantity<=1}
                      onClick={() =>
                        handleQuantityChange(item.product_id,item.quantity-1)
                      }
                    >
                      −
                    </button>

                    <span aria-live="polite">{item.quantity}</span>

                    <button
                      className="shop-button shop-button--small"
                      type="button"
                      aria-label={`Увеличить количество: ${item.products.title}`}
                      disabled={isCartBusy||cartError!==null}
                      onClick={() =>
                        handleQuantityChange(item.product_id,item.quantity+1)
                      }
                    >
                      +
                    </button>
                  </div>

                  <button
                    className="shop-button shop-button--danger"
                    type="button"
                    disabled={isCartBusy||cartError!==null}
                    onClick={() => handleRemoveFromCart(item.product_id)}
                  >
                    {pendingAction?.kind==="remove"&&pendingAction.productId===item.product_id? "Удаляем...":"Удалить из корзины"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {cartItems!==null&&<p className="shop-cart-total">
            Итого: $
            {cartItems
              .reduce(
                (sum,item) => sum+item.products.price*item.quantity,
                0,
              )
              .toFixed(2)}
          </p>}
        </section>
      )}

      {/* Каталог товаров */}
      {filteredProducts.length===0&&(catalog.success||reloadedProducts!==null)&&(
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
              aria-expanded={expandedCardId===product.id}
              disabled={isLoadingDetails}
              onClick={() => {
                if(expandedCardId===product.id) {
                  setExpandedCardId(null);
                  setSelectedProductId(null);
                  ++detailsRequestId.current;
                  return;
                }

                setExpandedCardId(product.id);
                void loadProductDetails(product.id);
              }}
            >
              {expandedCardId===product.id
                ? "Скрыть подробности"
                :"Подробнее"}
            </button>

            {expandedCardId===product.id&&(
              <div
                className="shop-product-details"
              >
                {isLoadingDetails? (
                  <p className="shop-muted" role="status">Загрузка информации...</p>
                ):details&&details.product.id===
                  selectedProductId? (
                  <>
                    <h3 className="shop-card-title">{details.product.title}</h3>

                    <p>{details.product.description}</p>

                    <p className="shop-muted">
                      Категория: {details.product.category}
                    </p>

                    <h3 className="shop-card-title">Похожие товары</h3>

                    {details.relatedProducts.length===
                      0? (
                      <p className="shop-muted">Похожих товаров нет.</p>
                    ):(
                      details.relatedProducts.map(
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
                              onClick={() => void loadProductDetails(related.id)}
                            >
                              Изучить товар
                            </button>
                          </div>
                        ),
                      )
                    )}
                  </>
                ):(
                  <div className="shop-notice shop-notice--danger" role="alert">
                    <p>{detailsError??"Не удалось показать информацию о товаре."}</p>
                    <button className="shop-button" type="button" disabled={isLoadingDetails} onClick={() => void loadProductDetails(selectedProductId??product.id)}>Повторить загрузку подробностей</button>
                  </div>
                )}
              </div>
            )}

            <button
              className="shop-button shop-button--primary shop-button--wide"
              type="button"
              disabled={isCartBusy}
              onClick={() => handleAddToCart(product.id)}
            >
              {pendingAction?.kind==="add"&&pendingAction.productId===product.id? "Добавляем...":"Добавить в корзину"}
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
