import assert from "node:assert/strict";
import { test } from "node:test";

import { incrementCartQuantity,type CartQuantityStore } from "./cart-quantity.js";

// Both callers read the same snapshot before either can write.
function concurrentStore(initialQuantity: number|null) {
  let quantity=initialQuantity;
  let reads=0;
  let inserts=0;
  let updates=0;
  let releaseReads=() => { };
  const readBarrier=new Promise<void>((resolve) => { releaseReads=resolve; });
  const store: CartQuantityStore={
    async readQuantity() {
      const snapshot=quantity;
      reads++;
      if(reads===2) releaseReads();
      if(reads<=2) await readBarrier;
      return snapshot;
    },
    async insert(value) {
      inserts++;
      if(quantity!==null) return null;
      quantity=value;
      return quantity;
    },
    async compareAndSet(expected,value) {
      updates++;
      if(quantity!==expected) return null;
      quantity=value;
      return quantity;
    },
  };
  return { store,state: () => ({ quantity,reads,inserts,updates }) };
}

test("concurrent additions to an existing row preserve both increments",async () => {
  const { store,state }=concurrentStore(4);
  const results=await Promise.all([
    incrementCartQuantity(store,2),incrementCartQuantity(store,3),
  ]);
  assert.deepEqual(results,[6,9]);
  assert.deepEqual(state(),{ quantity: 9,reads: 3,inserts: 0,updates: 3 });
});

test("concurrent additions to a missing row retry the losing insert",async () => {
  const { store,state }=concurrentStore(null);
  const results=await Promise.all([
    incrementCartQuantity(store,2),incrementCartQuantity(store,3),
  ]);
  assert.deepEqual(results,[2,5]);
  assert.deepEqual(state(),{ quantity: 5,reads: 3,inserts: 2,updates: 1 });
});

test("persistent conflicts stop after five attempts",async () => {
  for(const existing of [null,1]) {
    let reads=0;
    let writes=0;
    const conflict=async () => { writes++; return null; };
    const store: CartQuantityStore={
      async readQuantity() { reads++; return existing; },
      insert: conflict,
      compareAndSet: conflict,
    };
    await assert.rejects(incrementCartQuantity(store,1),/Корзина изменяется/);
    assert.equal(reads,5);
    assert.equal(writes,5);
  }
});

test("read failures are propagated without writes or retries",async () => {
  let reads=0;
  const failure=new Error("Read failed");
  const store: CartQuantityStore={
    async readQuantity() { reads++; throw failure; },
    async insert() { assert.fail("must not write after a failed read"); },
    async compareAndSet() { assert.fail("must not write after a failed read"); },
  };
  await assert.rejects(incrementCartQuantity(store,1),(error) => error===failure);
  assert.equal(reads,1);
});

test("ambiguous write failures are never automatically retried",async () => {
  for(const existing of [null,4]) {
    let quantity=existing;
    let reads=0;
    let writes=0;
    const failure=new Error("Response lost after the write");
    async function writeThenFail(value: number): Promise<number|null> {
      writes++;
      quantity=value;
      throw failure;
    }
    const store: CartQuantityStore={
      async readQuantity() { reads++; return quantity; },
      insert: writeThenFail,
      async compareAndSet(_expected,value) { return writeThenFail(value); },
    };
    await assert.rejects(incrementCartQuantity(store,2),(error) => error===failure);
    assert.equal(quantity,(existing??0)+2);
    assert.equal(reads,1);
    assert.equal(writes,1);
  }
});

test("invalid and overflowing increments are rejected before writing",async () => {
  const store: CartQuantityStore={
    async readQuantity() { return Number.MAX_SAFE_INTEGER; },
    async insert() { assert.fail("must not write invalid quantity"); },
    async compareAndSet() { assert.fail("must not write invalid quantity"); },
  };
  for(const quantity of [0,-1,1.5,NaN,Infinity]) {
    await assert.rejects(incrementCartQuantity(store,quantity),/положительным целым/);
  }
  await assert.rejects(incrementCartQuantity(store,1),/Слишком большое/);
});
