import { useToolInfo, useCallTool } from "@/helpers.js";

import { useState } from "react";
import { useUser } from "skybridge/web";

import CatalogFilters from "@/components/CatalogFilters.js";
import ProductCard from "@/components/ProductCard.js";
import CartPanel from "@/components/CartPanel.js";
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
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  function handleToggleCart() {
    if (!isCartOpen) {
      getCart();
    }

    setIsCartOpen(!isCartOpen);
  }

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

  function handleAddToCart(productId: number) {
    addToCart(
      {
        productId,
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
    );
  }

  function handleRemoveFromCart(productId: number) {
    removeFromCart(
      { productId },
      {
        onSuccess: (result) => {
          if (!result.isError && result.structuredContent?.removed) {
            getCart();
          }
        },
        onError: (error) => {
          console.error("Ошибка удаления:", error);
        },
      },
    );
  }

  function handleToggleDetails(productId: number) {
    if (expandedCardId === productId) {
      setExpandedCardId(null);
      setSelectedProductId(null);
      return;
    }

    setExpandedCardId(productId);
    setSelectedProductId(productId);

    getProductDetails({ productId });
  }

  function handleSelectRelatedProduct(productId: number) {
    setSelectedProductId(productId);

    getProductDetails({ productId });
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
      <CatalogFilters
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
        maxPrice={maxPrice}
        categories={categories}
        onSearchChange={setSearchQuery}
        onCategoryChange={setSelectedCategory}
        onMaxPriceChange={setMaxPrice}
      />

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
        type="button"
        onClick={handleToggleCart}
        aria-expanded={isCartOpen}
      >
        {isCartOpen ? "Скрыть корзину" : "Посмотреть корзину"}
      </button>
      {/* Содержимое корзины */}
      {isCartOpen && (
        <CartPanel
          items={cartData?.structuredContent?.items}
          isLoading={isLoadingCart}
          isUpdating={isUpdating}
          isRemoving={isRemoving}
          onRefresh={() => getCart()}
          onQuantityChange={handleQuantityChange}
          onRemoveFromCart={handleRemoveFromCart}
        />
      )}

      {/* Каталог товаров */}
      <div className="shop-product-grid">
        {filteredProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            isExpanded={expandedCardId === product.id}
            selectedProductId={selectedProductId}
            details={detailsData?.structuredContent}
            isLoadingDetails={isLoadingDetails}
            isAdding={isAdding}
            onToggleDetails={handleToggleDetails}
            onSelectRelatedProduct={handleSelectRelatedProduct}
            onAddToCart={handleAddToCart}
          />
        ))}
      </div>
    </main>
  );
}
