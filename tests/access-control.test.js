import test from "node:test";
import assert from "node:assert/strict";
import { normalizePermissions, permissionAllows, redactTradeForMarginScope } from "../lib/access-control.js";

test("permission levels are monotonic and unknown values fail closed", () => {
  const permissions = normalizePermissions({ trade: "edit", finance: "view", comments: "bogus" });
  assert.equal(permissionAllows(permissions, "trade", "view"), true);
  assert.equal(permissionAllows(permissions, "trade", "approve"), false);
  assert.equal(permissionAllows(permissions, "comments", "view"), false);
});

test("buyer view hides seller economics and total profit", () => {
  const redacted = redactTradeForMarginScope({
    reference: "FT-1", buyPrice: 500, sellPrice: 610, netProfit: 110,
    nested: { productCost: 50, route: "ARA-Lagos" },
  }, "buyer");
  assert.equal(redacted.buyPrice, null);
  assert.equal(redacted.netProfit, null);
  assert.equal(redacted.sellPrice, 610);
  assert.equal(redacted.nested.productCost, null);
  assert.equal(redacted.nested.route, "ARA-Lagos");
});

test("owner view is never redacted", () => {
  const trade = { buyPrice: 500, sellPrice: 610, netProfit: 110 };
  assert.deepEqual(redactTradeForMarginScope(trade, "none", true), trade);
});
