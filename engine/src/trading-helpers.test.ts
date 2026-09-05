import assert from "node:assert/strict";
import test from "node:test";
import { collateralRequired, chooseVenue } from "./trading-helpers.js";

test("shared trading helpers choose the busiest venue and calculate complementary collateral", () => {
  const markets = [
    { venueId: "0xvenue-a" },
    { venueId: "0xvenue-b" },
    { venueId: "0xvenue-b" },
  ];

  assert.equal(chooseVenue(markets), "0xvenue-b");
  assert.equal(chooseVenue(markets, "0xvenue-a"), "0xvenue-a");
  assert.equal(collateralRequired("BUY_YES", 1_000_000n, 250_000n, 4_000n), 1_000n);
  assert.equal(collateralRequired("BUY_NO", 1_000_000n, 250_000n, 4_000n), 3_000n);
});
