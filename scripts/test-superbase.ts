/// <reference types="node" />

import "dotenv/config";
import { env } from "node:process";
import { createClient } from "@supabase/supabase-js";

// 1. Получаем настройки из .env
const url = env.SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;

// 2. Проверяем наличие настроек
if (!url || !key) {
  throw new Error("Supabase URL или ключ не найдены");
}

// 3. Создаём подключение к Supabase
const supabase = createClient(url, key);

// 4. Проверяем получение товаров
async function main() {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price")
    .limit(3);

  if (error) {
    throw error;
  }

  console.log("Подключение успешно!");
  console.log("Товары:", data);
}

// 5. Запускаем функцию
main().catch((error) => {
  console.error("Ошибка Supabase:", error);
  process.exitCode = 1;
});
