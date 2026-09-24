export const permissionRanks = Object.freeze({ none: 0, view: 1, edit: 2, approve: 3 });

export function normalizePermissions(value) {
  const source = value && typeof value === "object" ? value : {};
  return ["trade", "documents", "finance", "insurance", "logistics", "approvals", "comments"]
    .reduce((result, key) => {
      result[key] = Object.hasOwn(permissionRanks, source[key]) ? source[key] : "none";
      return result;
    }, {});
}

export function permissionAllows(permissions, key, required = "view") {
  return (permissionRanks[permissions?.[key]] ?? 0) >= (permissionRanks[required] ?? 1);
}

export function redactTradeForMarginScope(trade, marginScope, isOwner = false) {
  if (!trade || typeof trade !== "object" || isOwner || marginScope === "all") return trade;
  const result = structuredClone(trade);
  const hidden = new Set([
    "buyPrice", "sellPrice", "buyPriceCents", "sellPriceCents", "productCost",
    "freight", "insurance", "inspection", "portCharges", "storage", "finance",
    "bankFees", "bankFeesPct", "taxes", "losses", "lossesPct", "commission",
    "otherCosts", "netProfit", "grossProfit", "netMargin", "netMarginPct",
    "buyerMargin", "sellerMargin", "retailMargin", "wholesaleMargin",
  ]);
  const buyerHidden = new Set(["buyPrice", "buyPriceCents", "productCost", "sellerMargin"]);
  const sellerHidden = new Set(["sellPrice", "sellPriceCents", "buyerMargin", "retailMargin"]);

  const visit = (value) => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, child]) => {
      const shouldHide = marginScope === "none" || marginScope === "summary"
        ? hidden.has(key)
        : marginScope === "buyer"
          ? buyerHidden.has(key) || ["netProfit", "grossProfit", "sellerMargin"].includes(key)
          : marginScope === "seller"
            ? sellerHidden.has(key) || ["netProfit", "grossProfit", "buyerMargin"].includes(key)
            : hidden.has(key);
      return [key, shouldHide ? null : visit(child)];
    }));
  };
  return visit(result);
}
