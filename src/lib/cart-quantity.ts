/** null from a write means a proven conflict; other failures must throw. */
export type CartQuantityStore={
  readQuantity(): Promise<number|null>;
  insert(quantity: number): Promise<number|null>;
  compareAndSet(expectedQuantity: number,quantity: number): Promise<number|null>;
};

/** Add once, retrying only writes known not to have changed a row. */
export async function incrementCartQuantity(
  store: CartQuantityStore,
  quantity: number,
): Promise<number> {
  if(!Number.isSafeInteger(quantity)||quantity<1) {
    throw new Error("Количество должно быть положительным целым числом");
  }

  for(let attempt=0;attempt<5;attempt++) {
    const currentQuantity=await store.readQuantity();
    const newQuantity=(currentQuantity??0)+quantity;
    if(!Number.isSafeInteger(newQuantity)) {
      throw new Error("Слишком большое количество товара");
    }

    const savedQuantity=currentQuantity===null
      ? await store.insert(newQuantity)
      :await store.compareAndSet(currentQuantity,newQuantity);

    if(savedQuantity!==null) return savedQuantity;
  }

  throw new Error("Корзина изменяется другим запросом. Повторите добавление товара.");
}
