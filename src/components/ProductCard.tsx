import type { ToolOutput } from "skybridge/server";
import type { AppType } from "@/server.js";

type Product = ToolOutput<AppType, "get-products">["products"][number];
type ProductDetails = ToolOutput<AppType, "get-product-details">;

type Props = {
  product: Product;
  isExpanded: boolean;
  selectedProductId: number | null;
  details: ProductDetails | undefined;
  isLoadingDetails: boolean;
  isAdding: boolean;
  onToggleDetails: (productId: number) => void;
  onSelectRelatedProduct: (productId: number) => void;
  onAddToCart: (productId: number) => void;
};

export default function ProductCard({
  product,
  isExpanded,
  selectedProductId,
  details,
  isLoadingDetails,
  isAdding,
  onToggleDetails,
  onSelectRelatedProduct,
  onAddToCart,
}: Props) {
  return (
    <article className="shop-product-card">
      <div className="shop-product-image">
        <img src={product.image} alt={product.title} />
      </div>

      <p className="shop-product-category">{product.category}</p>
      <h3 className="shop-card-title">{product.title}</h3>

      <p className="shop-product-price">Цена: ${product.price}</p>

      <button
        className="shop-button"
        disabled={isLoadingDetails}
        onClick={() => onToggleDetails(product.id)}
      >
        {isExpanded ? "Скрывать подробности" : "Подробнее"}
      </button>

      {isExpanded && (
        <div className="shop-product-details">
          {isLoadingDetails ? (
            <p>Загрузка информации...</p>
          ) : details?.product?.id === selectedProductId ? (
            <>
              <h4>{details.product.title}</h4>

              <p>{details.product.description}</p>

              <p>Категория: {details.product.category}</p>

              <h4>Похожие товары</h4>

              {details.relatedProducts.length === 0 ? (
                <p>Похожих товаров нет.</p>
              ) : (
                details.relatedProducts.map((related) => (
                  <div key={related.id} className="shop-related-item">
                    <span>
                      {related.title} - ${related.price}
                    </span>

                    <button
                      className="shop-button"
                      disabled={isLoadingDetails}
                      onClick={() => onSelectRelatedProduct(related.id)}
                    >
                      Изучить товар
                    </button>
                  </div>
                ))
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
        aria-busy={isAdding}
        onClick={() => onAddToCart(product.id)}
      >
        {isAdding ? "Добавляем..." : "Добавить в корзину"}
      </button>
    </article>
  );
}
