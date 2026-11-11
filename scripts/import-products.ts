/// <reference types='node' />

import "dotenv/config";
import { env } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const ProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  price: z.number(),
  description: z.string(),
  category: z.string(),
  image: z.string(),
});

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error(`Supabase URL или ключи не найдены`);
}

const supabase = createClient(url, key);

async function main() {
  const response = await fetch("https://fakestoreapi.com/products");

  if (!response.ok) {
    throw new Error(`API ERROR : ${response.status}`);
  }

  const products = z.array(ProductSchema).parse(await response.json());

  if (products.length === 0) {
    throw new Error(`API вернул пустой каталог`);
  }

  const rows = products.map((product) => ({
    source_id: product.id,
    title: product.title,
    price: product.price,
    description: product.description,
    category: product.category,
    image: product.image,
  }));

  const { error } = await supabase
    .from("products")
    .upsert(rows, { onConflict: "source_id" });

  if (error) {
    throw error;
  }

  console.log(`Импортировано товаров: ${rows.length}`);
}

main().catch((error) => {
  console.error("Ошибка импорта:", error);
  process.exitCode = 1;
});
