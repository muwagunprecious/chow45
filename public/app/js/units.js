/* ----------------------------------------------------------------
   Pricing units and size variants (shared by vendor, customer, state)

   A food item is sold either by portion (rice, soups, swallow) or by
   piece (drinks, snacks, grills, shawarma, others). Some by-piece items
   are also sold in sizes, in which case the size price replaces the
   per-piece price whenever the customer picks one.
   ---------------------------------------------------------------- */

(function () {
  "use strict";

  // Categories sold by piece rather than by scoop/plate.
  const PIECE_CATEGORIES = ["drinks", "snacks", "grills", "shawarma", "others"];

  // Categories that keep the scoop/plate portion model.
  const PORTION_CATEGORIES = ["rice", "soups", "swallows"];

  const PIECE = "PIECE";

  function normaliseCategory(category) {
    return String(category || "").trim().toLowerCase();
  }

  // 'portion' -> scoop / plate / both, 'piece' -> per piece
  function unitModelFor(category) {
    return PIECE_CATEGORIES.indexOf(normaliseCategory(category)) >= 0 ? "piece" : "portion";
  }

  function isPieceCategory(category) {
    return unitModelFor(category) === "piece";
  }

  function isPortionCategory(category) {
    return unitModelFor(category) === "portion";
  }

  // Human label for the unit, used in prices and quantity subtitles.
  function unitLabel(priceType) {
    switch (String(priceType || "").toUpperCase()) {
      case "SCOOP":
        return "scoop";
      case "PLATE":
        return "plate";
      case PIECE:
        return "piece";
      default:
        return "piece";
    }
  }

  function pluralUnitLabel(priceType, qty) {
    const label = unitLabel(priceType);
    if (Number(qty) === 1) return label;
    return label === "piece" ? "pieces" : label + "s";
  }

  // Sizes are only meaningful for by-piece items, so this is also the
  // guard the vendor UI uses to decide whether to ask the question.
  function supportsSizes(category) {
    return isPieceCategory(category);
  }

  function hasSizes(dish) {
    return Boolean(dish && Array.isArray(dish.sizes) && dish.sizes.length > 0);
  }

  // Cheapest available size, used for the "From ..." menu card label.
  function lowestSizePrice(dish) {
    const prices = (dish.sizes || [])
      .map((s) => Number(s.price))
      .filter((n) => Number.isFinite(n) && n > 0);
    return prices.length ? Math.min.apply(null, prices) : null;
  }

  // The price a customer actually pays for one unit, before extras.
  // For a BOTH dish the customer picks scoop or plate, so the caller passes
  // that choice; otherwise the cheapest listed price is used as a fallback.
  function baseUnitPrice(dish, selectedSizeId, selectedPortionType) {
    if (!dish) return 0;

    if (hasSizes(dish)) {
      const chosen = (dish.sizes || []).find((s) => s.id === selectedSizeId);
      if (chosen) return Number(chosen.price) || 0;
    }

    const type = String(dish.priceType || "").toUpperCase();
    const portion = String(selectedPortionType || "").toUpperCase();

    // A dish offering both scoop and plate bills for the portion chosen.
    if (type === "BOTH") {
      if (portion === "SCOOP") return Number(dish.scoopPrice) || 0;
      if (portion === "PLATE") return Number(dish.platePrice) || 0;
      return Number(dish.scoopPrice) || Number(dish.platePrice) || Number(dish.price) || 0;
    }

    switch (type) {
      case "SCOOP":
        return Number(dish.scoopPrice) || Number(dish.price) || 0;
      case "PLATE":
        return Number(dish.platePrice) || Number(dish.price) || 0;
      case PIECE:
        return Number(dish.piecePrice) || Number(dish.price) || 0;
      default:
        return Number(dish.price) || 0;
    }
  }

  // Suggests the three sizes vendors reach for most, so the builder is not
  // an empty text box. Only offered for by-piece categories.
  const SIZE_PRESETS = ["Small", "Medium", "Large"];

  function newSizeId() {
    return "sz-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  window.ChowUnits = {
    PIECE: PIECE,
    PIECE_CATEGORIES: PIECE_CATEGORIES,
    PORTION_CATEGORIES: PORTION_CATEGORIES,
    SIZE_PRESETS: SIZE_PRESETS,
    unitModelFor: unitModelFor,
    isPieceCategory: isPieceCategory,
    isPortionCategory: isPortionCategory,
    unitLabel: unitLabel,
    pluralUnitLabel: pluralUnitLabel,
    supportsSizes: supportsSizes,
    hasSizes: hasSizes,
    lowestSizePrice: lowestSizePrice,
    baseUnitPrice: baseUnitPrice,
    newSizeId: newSizeId,
  };
})();
