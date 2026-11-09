import {test} from "node:test";
import assert from "node:assert/strict";
import {paymentSummary} from "../src/lib/payment-summary";
const row = (status: string, amount = "10.00") => ({status,amount,currency:"USD",last_verified_at:"2026-11-09",reconciliation_status:"SYNCED"}) as Parameters<typeof paymentSummary>[0][number];
test("financial summary separates paid, open and all invoice face values",()=>{
 assert.deepEqual(paymentSummary([row("PAID"),row("UNPAID"),row("PAYMENT_PENDING"),row("DRAFT"),row("REFUNDED"),row("CANCELLED"),row("NOT_STARTED","123123123")]),{paid:10,open:20,invoiced:60});
});
test("unverified and unavailable payment totals never become confirmed zero or earnings",()=>{
 for(const r of [{...row("PAID"),last_verified_at:null},{...row("PAID"),reconciliation_status:"ERROR"},row("REQUIRES_ATTENTION"),{...row("PAID"),currency:"EUR"},row("PAID","invalid")])assert.equal(paymentSummary([r]),null);
 assert.deepEqual(paymentSummary([]),{paid:0,open:0,invoiced:0});
});
test("summary sums minor units and never includes cancelled or refunded invoices in paid",()=>{
 assert.deepEqual(paymentSummary([row("PAID","0.10"),row("PAID","0.20"),row("REFUNDED","50.00")]),{paid:0.3,open:0,invoiced:50.3});
});
