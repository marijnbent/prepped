import assert from "node:assert/strict";
import test from "node:test";
import { scaleAmount } from "../src/lib/scale-amount";

test("preserves written quantities at the original serving count", () => {
  for (const amount of ["1,5", "480-600", "1/2", "1 1/2", "a pinch", "1 cup"]) {
    assert.equal(scaleAmount(amount, 1), amount);
  }
});

test("scales decimals, ranges and fractions without dropping parts of the quantity", () => {
  assert.equal(scaleAmount("1,5", 2), "3");
  assert.equal(scaleAmount("1,5", 0.5), "0,75");
  assert.equal(scaleAmount("480-600", 0.5), "240-300");
  assert.equal(scaleAmount("1–2", 2), "2–4");
  assert.equal(scaleAmount("1/2", 2), "1");
  assert.equal(scaleAmount("1 1/2", 2), "3");
  assert.equal(scaleAmount("a pinch", 2), "a pinch");
  assert.equal(scaleAmount("1 cup", 2), "1 cup");
  assert.equal(scaleAmount("1/0", 2), "1/0");
});
