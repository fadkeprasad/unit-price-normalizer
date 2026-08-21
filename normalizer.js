(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.UnitPriceNormalizer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MASS_TO_GRAMS = {
    mg: 0.001,
    g: 1,
    kg: 1000,
    oz: 28.349523125,
    lb: 453.59237
  };

  const VOLUME_TO_ML = {
    ml: 1,
    l: 1000,
    floz: 29.5735295625,
    pt: 473.176473,
    qt: 946.352946,
    gal: 3785.411784
  };

  const UNIT_ALIASES = {
    milligram: "mg", milligrams: "mg", mg: "mg",
    gram: "g", grams: "g", g: "g",
    kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg", kg: "kg",
    ounce: "oz", ounces: "oz", oz: "oz",
    pound: "lb", pounds: "lb", lbs: "lb", lb: "lb",
    milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml", ml: "ml",
    liter: "l", liters: "l", litre: "l", litres: "l", l: "l",
    pint: "pt", pints: "pt", pt: "pt",
    quart: "qt", quarts: "qt", qt: "qt",
    gallon: "gal", gallons: "gal", gal: "gal"
  };

  const NUMBER = "(\\d+(?:[.,]\\d+)?)";
  const UNIT = "(mg|milligrams?|kg|kilograms?|kilos?|g|grams?|fl\\.?\\s*oz|fluid\\s+ounces?|oz|ounces?|lbs?|pounds?|ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|pts?|pints?|qts?|quarts?|gal|gallons?)";

  function cleanNumber(value) {
    return Number.parseFloat(String(value).replace(",", "."));
  }

  function canonicalUnit(rawUnit) {
    const compact = String(rawUnit).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
    if (compact === "fl oz" || compact.startsWith("fluid ounce")) return "floz";
    return UNIT_ALIASES[compact] || UNIT_ALIASES[compact.replace(/s$/, "")] || null;
  }

  function parsePrice(text) {
    if (!text) return null;
    const normalized = String(text).replace(/\u00a0/g, " ");
    const matches = [...normalized.matchAll(/(?:US\s*)?\$\s*([0-9]{1,4}(?:,[0-9]{3})*(?:\.\d{1,2})?)/gi)];
    for (const match of matches) {
      const before = normalized.slice(Math.max(0, match.index - 20), match.index).toLowerCase();
      const after = normalized.slice(match.index + match[0].length, match.index + match[0].length + 18).toLowerCase();
      if (/list price|was\s*$|reg(?:ular)?\.?\s*$/.test(before) || /^\s*\/(?:oz|lb|kg|g|ml|l)\b/.test(after)) continue;
      const price = Number.parseFloat(match[1].replace(/,/g, ""));
      if (Number.isFinite(price) && price > 0) return price;
    }
    return null;
  }

  function quantityFromMatch(amount, rawUnit, multiplier, source) {
    const unit = canonicalUnit(rawUnit);
    const value = cleanNumber(amount) * multiplier;
    if (!unit || !Number.isFinite(value) || value <= 0) return null;
    if (MASS_TO_GRAMS[unit]) {
      return { kind: "mass", baseAmount: value * MASS_TO_GRAMS[unit], baseUnit: "g", amount: cleanNumber(amount), unit, multiplier, source };
    }
    if (VOLUME_TO_ML[unit]) {
      return { kind: "volume", baseAmount: value * VOLUME_TO_ML[unit], baseUnit: "ml", amount: cleanNumber(amount), unit, multiplier, source };
    }
    return null;
  }

  function parseQuantity(text) {
    if (!text) return null;
    const value = String(text)
      .replace(/\u00d7/g, "x")
      .replace(/\u00a0/g, " ")
      .replace(/(\d)\s*[-–]\s*(pack|count|ct)\b/gi, "$1 $2")
      .replace(/\s+/g, " ");

    // "6 x 5.3 oz", "6pk x 200 ml", or "6 count, 5.3 oz each".
    const leadingPack = new RegExp("\\b(\\d{1,3})\\s*(?:x|pk|pack|count|ct)(?:\\s*(?:of|x|,))?\\s*" + NUMBER + "\\s*" + UNIT + "\\b", "i");
    let match = value.match(leadingPack);
    if (match) return quantityFromMatch(match[2], match[3], Number(match[1]), match[0]);

    // "5.3 oz x 4", "200 ml, pack of 6".
    const trailingPack = new RegExp(NUMBER + "\\s*" + UNIT + "(?:\\s*(?:each|bottles?|cups?|cans?))?\\s*(?:x|,?\\s*pack\\s+of)\\s*(\\d{1,3})\\b", "i");
    match = value.match(trailingPack);
    if (match) return quantityFromMatch(match[1], match[2], Number(match[3]), match[0]);

    // Walmart-style "5.3 oz 4PK" or "5.3 oz cups, 6 count".
    const compactTrailingPack = new RegExp(NUMBER + "\\s*" + UNIT + "(?:\\s*(?:each|bottles?|cups?|cans?|tubs?))?\\s*[,]?\\s*(\\d{1,3})\\s*(?:pk|pack|count|ct)\\b", "i");
    match = value.match(compactTrailingPack);
    if (match) return quantityFromMatch(match[1], match[2], Number(match[3]), match[0]);

    // "pack of 6, 5.3 oz each".
    const packOf = new RegExp("\\b(?:pack|case)\\s+of\\s+(\\d{1,3})\\D{0,20}?" + NUMBER + "\\s*" + UNIT + "\\b", "i");
    match = value.match(packOf);
    if (match) return quantityFromMatch(match[2], match[3], Number(match[1]), match[0]);

    // A simple package quantity. Skip text that explicitly describes an existing unit price.
    const simple = new RegExp(NUMBER + "\\s*" + UNIT + "\\b", "ig");
    for (const candidate of value.matchAll(simple)) {
      const prefix = value.slice(Math.max(0, candidate.index - 12), candidate.index).toLowerCase();
      if (/\$\s*\d*(?:\.\d+)?\s*\/\s*$|per\s*$/.test(prefix)) continue;
      return quantityFromMatch(candidate[1], candidate[2], 1, candidate[0]);
    }
    return null;
  }

  function normalize(price, quantity) {
    if (!Number.isFinite(price) || price <= 0 || !quantity || !Number.isFinite(quantity.baseAmount) || quantity.baseAmount <= 0) return null;
    return {
      value: price / quantity.baseAmount,
      kind: quantity.kind,
      unit: quantity.baseUnit,
      totalAmount: quantity.baseAmount
    };
  }

  function formatUnitPrice(value, unit, decimals) {
    if (!Number.isFinite(value)) return "";
    const selectedDecimals = decimals === "smart"
      ? (value >= 1 ? 2 : value >= 0.1 ? 3 : value >= 0.01 ? 4 : 5)
      : Math.max(2, Math.min(6, Number(decimals) || 4));
    return `$${value.toFixed(selectedDecimals)}/${unit}`;
  }

  return { parsePrice, parseQuantity, normalize, formatUnitPrice, canonicalUnit };
});
