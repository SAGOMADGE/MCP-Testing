import { useState } from "react";
import type { ToolOutput } from "skybridge/server";
import type { AppType } from "@/server.js";

type CartItem = ToolOutput<AppType, "get-cart">["items"][number];

type Props = {
  items: CartItem[] | undefined;
  isLoading: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  onRefresh: () => void;
  onQuantityChange: (productId: number, newQuantity: number) => void;
  onRemoveFromCart: (productId: number) => void;
};

export default function CartPanel({
  items,
  isLoading,
  isUpdating,
  isRemoving,
  onRefresh,
  onQuantityChange,
  onRemoveFromCart,
}: Props) {
  const [failedImages, setFailedImages] = useState<Record<number, string>>({});

  return (
    <section className="shop-panel shop-cart">
      <div className="shop-cart-header">
        <h2 className="shop-section-title">Моя корзина</h2>
      </div>

      {isLoading ? (
        <p className="shop-empty" role="status">
          Загрузка корзины...
        </p>
      ) : !items ? (
        <div className="shop-empty shop-cart-header" role="alert">
          <p>Не удалось загрузить корзину.</p>
          <button className="shop-button" type="button" onClick={onRefresh}>
            Повторить запрос
          </button>
        </div>
      ) : (
        items.length === 0 && <p className="shop-empty">Корзина пуста</p>
      )}

      {!isLoading &&
        items?.map((item) => (
          <div className="shop-cart-item" key={item.product_id}>
            <div className="shop-cart-image">
              {item.products.image &&
              failedImages[item.product_id] !== item.products.image ? (
                <img
                  src={item.products.image}
                  alt={item.products.title}
                  width={72}
                  height={72}
                  onError={() =>
                    setFailedImages((current) => ({
                      ...current,
                      [item.product_id]: item.products.image,
                    }))
                  }
                />
              ) : (
                <span className="shop-cart-image-placeholder">Нет фото</span>
              )}
            </div>

            <div className="shop-cart-content">
              <h3 className="shop-cart-title">{item.products.title}</h3>

              <div className="shop-quantity">
                <button
                  className="shop-button"
                  aria-label={`Уменьшить количество: ${item.products.title}`}
                  disabled={isUpdating || item.quantity <= 1}
                  onClick={() =>
                    onQuantityChange(item.product_id, item.quantity - 1)
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
                    onQuantityChange(item.product_id, item.quantity + 1)
                  }
                >
                  +
                </button>
              </div>

              <button
                className="shop-button shop-button--danger"
                disabled={isRemoving}
                onClick={() => onRemoveFromCart(item.product_id)}
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
          </div>
        ))}

      {!isLoading && items && (
        <h3 className="shop-cart-total">
          Итого: $
          {items
            .reduce(
              (sum, item) => sum + item.products.price * item.quantity,
              0,
            )
            .toFixed(2)}
        </h3>
      )}
    </section>
  );
}
