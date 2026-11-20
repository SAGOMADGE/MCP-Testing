import { Skybridge } from "skybridge/server";
import { z } from "zod";
import "dotenv/config";
import { env } from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error(`Supabase URL или ключ не найдены`);
}

const supabase = createClient(url, key);

const ProductSchema = z.object({
  id: z.number(),
  title: z.string(),
  price: z.number(),
  image: z.string(),
  category: z.string(),
});

const CartItemSchema = z.object({
  product_id: z.number(),
  quantity: z.number(),
  products: z.object({
    id: z.number(),
    title: z.string(),
    price: z.number(),
    image: z.string(),
  }),
});

export const app = new Skybridge({
  name: "alpic-openai-app",
  version: "0.0.1",
  skills: true,
  instructions:
    "Shopping Cart is a shared demo cart, not a private user cart. Use the installed shopping-assistant skill when available. Browse and compare without changing the cart. Only perform cart writes explicitly requested by the user. Verify writes with get-cart. Scenario Modeler is a React UI preview, not an MCP tool.",
  handler: (server) =>
    server
      .registerTool(
        {
          name: "get-products",
          description:
            "Browse up to 20 catalog products with current prices and categories. Opens the React catalog in supported hosts. Use for shopping recommendations; does not change the shared demo cart.",
          annotations: {
            readOnlyHint: true,
          },
          view: {
            component: "products",
            csp: {
              resourceDomains: ["https://fakestoreapi.com"],
            },
          },
        },
        async () => {
          const { data, error } = await supabase
            .from("products")
            .select("id, title, price, image, category")
            .order("id", { ascending: true })
            .limit(20);

          if (error) {
            throw new Error(`Supabase error: ${error.message}`);
          }

          const products = z.array(ProductSchema).parse(data);

          return {
            structuredContent: { products },
            content: [
              {
                type: "text",
                text: JSON.stringify(products),
              },
            ],
          };
        },
      )
      /**
       * /////////////////////////////////
       */
      .registerTool(
        {
          name: "add-to-cart",
          description: "Add the requested quantity to a product in the shared demo cart. Increments an existing quantity; use only for an explicit addition request. Verify with get-cart.",
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
          },
          inputSchema: {
            productId: z.number().int().positive(),
            quantity: z.number().int().min(1),
          },
        },

        async ({ productId, quantity }) => {
          // 1. Получаем ID нашей демонстрационной корзины
          const cartId = env.DEMO_CART_ID;

          if (!cartId) {
            throw new Error("DEMO_CART_ID не найден в .env");
          }

          // 2. Проверяем, есть ли уже товар в корзине
          const { data: existingItem, error: readError } = await supabase
            .from("cart_items")
            .select("quantity")
            .eq("cart_id", cartId)
            .eq("product_id", productId)
            .maybeSingle();

          if (readError) {
            throw new Error(readError.message);
          }

          // 3. Вычисляем новое количество
          const newQuantity = (existingItem?.quantity ?? 0) + quantity;

          // 4. Сохраняем товар в Supabase
          const { data: savedItem, error: saveError } = await supabase
            .from("cart_items")
            .upsert(
              {
                cart_id: cartId,
                product_id: productId,
                quantity: newQuantity,
              },
              {
                onConflict: "cart_id,product_id",
              },
            )
            .select("product_id, quantity")
            .single();

          if (saveError) {
            throw new Error(saveError.message);
          }

          // 5. Возвращаем результат React-интерфейсу
          return {
            structuredContent: {
              productId: savedItem.product_id,
              quantity: savedItem.quantity,
              saved: true,
            },
            content: [
              {
                type: "text",
                text: `Товар ${productId} добавлен. Количество: ${savedItem.quantity}`,
              },
            ],
          };
        },
      )
      /**
       * //////////////////////////////
       */
      .registerTool(
        {
          name: "get-cart",
          description: "Read the shared demo cart with product prices and quantities. Use to show the cart, calculate totals, or verify a requested write.",
          annotations: {
            readOnlyHint: true,
          },
        },
        async () => {
          const cartId = env.DEMO_CART_ID;

          if (!cartId) {
            throw new Error("DEMO_CART_ID не найден");
          }

          const { data, error } = await supabase
            .from("cart_items")
            .select("product_id, quantity, products (id, title, price, image)")
            .eq("cart_id", cartId);

          if (error) {
            throw new Error(error.message);
          }

          const items = z.array(CartItemSchema).parse(data ?? []);

          return {
            structuredContent: { items },
            content: [
              {
                type: "text",
                text: JSON.stringify(items),
              },
            ],
          };
        },
      )

      .registerTool(
        {
          name: "update-cart-item",
          description: "Set the final positive quantity of an existing product in the shared demo cart. This replaces the quantity; it does not increment it. Use remove-from-cart for removal. Verify with get-cart.",
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
          },
          inputSchema: {
            productId: z.number().int().positive(),
            quantity: z.number().int().min(1),
          },
        },
        async ({ productId, quantity }) => {
          const cartId = env.DEMO_CART_ID;

          if (!cartId) {
            throw new Error("DEMO_CART_ID не найден");
          }

          const { data, error } = await supabase
            .from("cart_items")
            .update({ quantity })
            .eq("cart_id", cartId)
            .eq("product_id", productId)
            .select("product_id, quantity")
            .single();

          if (error) {
            throw new Error(error.message);
          }

          return {
            structuredContent: {
              productId: data.product_id,
              quantity: data.quantity,
              saved: true,
            },
            content: [
              {
                type: "text",
                text: `Количество товара ${productId}: ${data.quantity}`,
              },
            ],
          };
        },
      )

      .registerTool(
        {
          name: "remove-from-cart",
          description: "Remove a specific existing product from the shared demo cart, only when explicitly requested. Verify with get-cart. An absent product returns an error.",
          inputSchema: {
            productId: z.number().int().positive(),
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
          },
        },
        async ({ productId }) => {
          const cartId = env.DEMO_CART_ID;

          if (!cartId) {
            throw new Error("DEMO_CART_ID не найден");
          }

          const { data: deletedItem, error } = await supabase
            .from("cart_items")
            .delete()
            .eq("cart_id", cartId)
            .eq("product_id", productId)
            .select("product_id")
            .single();

          if (error) {
            throw new Error(error.message);
          }

          return {
            structuredContent: {
              productId: deletedItem.product_id,
              removed: true,
            },
            content: [
              {
                type: "text",
                text: `Товар ${productId} удалён из корзины`,
              },
            ],
          };
        },
      )
      .registerTool(
        {
          name: "get-product-details",
          description: "Read details for a catalog productId and up to three related products in the same category. Use before comparing or describing a specific product.",
          inputSchema: {
            productId: z.number().int().positive(),
          },
          annotations: {
            readOnlyHint: true,
          },
        },
        async ({ productId }) => {
          const { data: product, error: productError } = await supabase
            .from("products")
            .select("id, title, price, image, description, category")
            .eq("id", productId)
            .maybeSingle();

          if (productError) {
            throw new Error(productError.message);
          }

          if (!product) {
            throw new Error(`Товар с ID ${productId} не найден`);
          }

          const { data: related, error: relatedError } = await supabase
            .from("products")
            .select("id, title, price, image, category")
            .eq("category", product.category)
            .neq("id", productId)
            .limit(3);

          if (relatedError) {
            throw new Error(relatedError.message);
          }

          const ProductDetailsSchema = z.object({
            id: z.number(),
            title: z.string(),
            price: z.number(),
            image: z.string(),
            description: z.string(),
            category: z.string(),
          });

          const validatedProduct = ProductDetailsSchema.parse(product);

          const relatedProducts = z.array(ProductSchema).parse(related ?? []);

          return {
            structuredContent: {
              product: validatedProduct,
              relatedProducts,
            },
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  product: validatedProduct,
                  relatedProducts,
                }),
              },
            ],
          };
        },
      ),
});

export type AppType = typeof app;
