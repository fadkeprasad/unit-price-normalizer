const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePrice, parseQuantity, normalize, formatUnitPrice } = require("../normalizer.js");

test("parses current product prices and ignores explicit unit prices", () => {
  assert.equal(parsePrice("$5.98 ($0.19/oz)"), 5.98);
  assert.equal(parsePrice("List price $8.99 Now $6.49"), 6.49);
});

test("parses common mass package sizes", () => {
  assert.deepEqual(parseQuantity("Plain Greek Yogurt, 32 oz").baseUnit, "g");
  assert.ok(Math.abs(parseQuantity("Plain Greek Yogurt, 32 oz").baseAmount - 907.18474) < 0.001);
  assert.equal(parseQuantity("Flour 2 kg").baseAmount, 2000);
  assert.equal(parseQuantity("Rice, 5 lb").baseUnit, "g");
});

test("parses volume package sizes", () => {
  assert.equal(parseQuantity("Sparkling Water 1 L").baseAmount, 1000);
  assert.ok(Math.abs(parseQuantity("Juice 64 fl oz").baseAmount - 1892.705892) < 0.001);
  assert.ok(Math.abs(parseQuantity("Milk 1 gallon").baseAmount - 3785.411784) < 0.001);
});

test("multiplies multi-pack quantities", () => {
  assert.ok(Math.abs(parseQuantity("Greek Yogurt 6 x 5.3 oz cups").baseAmount - 901.514835) < 0.001);
  assert.equal(parseQuantity("Water 12 pack 500 ml bottles").baseAmount, 6000);
  assert.ok(Math.abs(parseQuantity("Pack of 4, 8 oz each").baseAmount - 907.18474) < 0.001);
  assert.ok(Math.abs(parseQuantity("Greek Yogurt 5.3 oz 4PK").baseAmount - 601.00989) < 0.001);
  assert.ok(Math.abs(parseQuantity("Greek Yogurt 5.3 oz Cups, 6 Count").baseAmount - 901.514835) < 0.001);
});

test("normalizes and formats unit price", () => {
  const quantity = parseQuantity("Greek Yogurt 32 oz");
  const result = normalize(5.98, quantity);
  assert.ok(Math.abs(result.value - 0.006591819) < 0.000001);
  assert.equal(formatUnitPrice(result.value, result.unit, "smart"), "0.659¢/g");
  assert.equal(formatUnitPrice(result.value, result.unit, 4), "0.6592¢/g");
});

test("uses cents only below the one-cent boundary", () => {
  assert.equal(formatUnitPrice(0.00999, "g", "smart"), "0.999¢/g");
  assert.equal(formatUnitPrice(0.01, "g", "smart"), "$0.0100/g");
  assert.equal(formatUnitPrice(0.0038, "ml", "smart"), "0.380¢/ml");
});

test("rejects unsupported counts and invalid inputs", () => {
  assert.equal(parseQuantity("Yogurt, 12 count"), null);
  assert.equal(normalize(null, parseQuantity("500 g")), null);
});
