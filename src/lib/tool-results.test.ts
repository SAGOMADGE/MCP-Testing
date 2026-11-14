import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CartResultSchema,
  ProductDetailsResultSchema,
  ProductsResultSchema,
  RemovedCartItemResultSchema,
  SavedCartItemResultSchema,
  readToolResult,
} from "./tool-results.js";

const safeError={
  name: "Error",
  message: "Не удалось получить корректный ответ сервиса.",
};

const product={
  id: 1,
  title: "Product",
  price: 12.34,
  image: "https://example.com/product.png",
  category: "Category",
};

const cartItem={
  product_id: 1,
  quantity: 2,
  products: {
    id: product.id,
    title: product.title,
    price: product.price,
    image: product.image,
  },
};

const details={
  product: { ...product,description: "Product description" },
  relatedProducts: [product],
};

test("reads valid catalog data and an empty catalog",() => {
  for(const products of [[product],[]]) {
    assert.deepEqual(
      readToolResult({ structuredContent: { products } },ProductsResultSchema),
      { products },
    );
  }
});

test("rejects malformed envelopes and missing structured content",() => {
  for(const result of [
    undefined,null,"response",42,[],{},
    { structuredContent: undefined },
    { structuredContent: null },
    { content: [{ type: "text",text: "raw internal error" }] },
  ]) {
    assert.throws(() => readToolResult(result,ProductsResultSchema),safeError);
  }
});

test("rejects tool errors and invalid isError flags without exposing raw errors",() => {
  for(const isError of [true,"false",0,null]) {
    assert.throws(() => readToolResult({
      isError,
      structuredContent: { products: [product] },
      content: [{ type: "text",text: "private database details" }],
    },ProductsResultSchema),safeError);
  }
  assert.deepEqual(readToolResult({
    isError: false,
    structuredContent: { products: [] },
  },ProductsResultSchema),{ products: [] });
});

test("rejects malformed product arrays and incomplete nested products",() => {
  for(const products of [null,{},"products",[null],[{}],[{ id: 1 }]]) {
    assert.throws(() => readToolResult({
      structuredContent: { products },
    },ProductsResultSchema),safeError);
  }
});

test("rejects invalid identifiers and nonfinite, negative or nonnumeric prices",() => {
  for(const invalidProduct of [
    ...[0,-1,1.5,"1"].map((id) => ({ ...product,id })),
    ...[NaN,Infinity,-Infinity,-0.01,"12.34"].map((price) => ({ ...product,price })),
  ]) {
    assert.throws(() => readToolResult({
      structuredContent: { products: [invalidProduct] },
    },ProductsResultSchema),safeError);
  }
  const freeProduct={ ...product,price: 0 };
  assert.deepEqual(readToolResult({
    structuredContent: { products: [freeProduct] },
  },ProductsResultSchema),{ products: [freeProduct] });
});

test("reads a valid cart and treats an empty cart as success",() => {
  for(const items of [[cartItem],[]]) {
    assert.deepEqual(
      readToolResult({ structuredContent: { items } },CartResultSchema),
      { items },
    );
  }
});

test("rejects malformed carts, null joins and invalid quantities",() => {
  for(const items of [
    null,{},[null],[{}],
    [{ ...cartItem,products: null }],
    [{ ...cartItem,products: { id: 1 } }],
    [{ ...cartItem,product_id: 0 }],
    ...[0,-1,1.5,"2"].map((quantity) => [{ ...cartItem,quantity }]),
  ]) {
    assert.throws(() => readToolResult({
      structuredContent: { items },
    },CartResultSchema),safeError);
  }
});

test("reads product details with populated or empty related products",() => {
  for(const relatedProducts of [[product],[]]) {
    const content={ ...details,relatedProducts };
    assert.deepEqual(
      readToolResult({ structuredContent: content },ProductDetailsResultSchema),
      content,
    );
  }
});

test("rejects incomplete details or malformed related products",() => {
  for(const content of [
    { ...details,product: null },
    { ...details,product },
    { product: details.product },
    { ...details,relatedProducts: null },
    { ...details,relatedProducts: [{ id: 2,title: "Incomplete" }] },
  ]) {
    assert.throws(() => readToolResult({
      structuredContent: content,
    },ProductDetailsResultSchema),safeError);
  }
});

test("reads valid save and remove acknowledgements",() => {
  const saved={ productId: 1,quantity: 2,saved: true };
  const removed={ productId: 1,removed: true };
  assert.deepEqual(
    readToolResult({ structuredContent: saved },SavedCartItemResultSchema),
    saved,
  );
  assert.deepEqual(
    readToolResult({ structuredContent: removed },RemovedCartItemResultSchema),
    removed,
  );
});

test("requires explicit success flags and complete mutation acknowledgements",() => {
  for(const content of [
    { productId: 1,quantity: 2 },
    { productId: 1,quantity: 2,saved: false },
    { productId: 1,quantity: 2,saved: "true" },
    { productId: 1,quantity: 0,saved: true },
    { quantity: 2,saved: true },
  ]) {
    assert.throws(() => readToolResult({
      structuredContent: content,
    },SavedCartItemResultSchema),safeError);
  }
  for(const content of [
    { productId: 1 },{ productId: 1,removed: false },
    { productId: 1,removed: "true" },{ productId: -1,removed: true },
    { removed: true },
  ]) {
    assert.throws(() => readToolResult({
      structuredContent: content,
    },RemovedCartItemResultSchema),safeError);
  }
});
