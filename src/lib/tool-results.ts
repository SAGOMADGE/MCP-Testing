import { z } from "zod";

const ProductSummarySchema=z.object({
  id: z.number().int().positive(),
  title: z.string(),
  price: z.number().finite().nonnegative(),
  image: z.string(),
});

const CatalogProductSchema=ProductSummarySchema.extend({
  category: z.string(),
});

export const ProductsResultSchema=z.object({
  products: z.array(CatalogProductSchema),
});

export const CartResultSchema=z.object({
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
    products: ProductSummarySchema,
  })),
});

export const ProductDetailsResultSchema=z.object({
  product: CatalogProductSchema.extend({ description: z.string() }),
  relatedProducts: z.array(CatalogProductSchema),
});

export const SavedCartItemResultSchema=z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  saved: z.literal(true),
});

export const RemovedCartItemResultSchema=z.object({
  productId: z.number().int().positive(),
  removed: z.literal(true),
});

export type CatalogProduct=z.infer<typeof ProductsResultSchema>["products"][number];
export type CartItem=z.infer<typeof CartResultSchema>["items"][number];
export type ProductDetails=z.infer<typeof ProductDetailsResultSchema>;

const ToolResultEnvelopeSchema=z.object({
  isError: z.boolean().optional(),
  structuredContent: z.unknown(),
});

const invalidResponseMessage="Не удалось получить корректный ответ сервиса.";

/** Проверяем данные MCP на границе UI, не показывая пользователю сырой ответ. */
export function readToolResult<T>(result: unknown,schema: z.ZodType<T>): T {
  const envelope=ToolResultEnvelopeSchema.safeParse(result);
  if(
    !envelope.success||
    envelope.data.isError===true||
    envelope.data.structuredContent==null
  ) {
    throw new Error(invalidResponseMessage);
  }

  const content=schema.safeParse(envelope.data.structuredContent);
  if(!content.success) throw new Error(invalidResponseMessage);
  return content.data;
}
