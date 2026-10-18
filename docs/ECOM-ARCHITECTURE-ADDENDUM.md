# E-commerce architecture addendum (LOCKED)

This overrides any part of the October Build Brief that assumes one Shopify store per product. Judgment calls are logged in `BUILD_DECISIONS.md` items 68–80.

```
 Car-charger site     Halloween-decor site     Product-X site   …   (Cloudflare Pages, one per product/brand)
        │                     │                      │
        └── Buy → Shopify cart permalink (variant + qty + mm_site/mm_brand + utm) ──┘
                              │
                ONE Shopify store (Basic plan)
     all products · checkout · payments · orders · fulfillment
```

## How it's built

| Brief § | What it says | Where it lives |
|---|---|---|
| 1 | One store per owner; one site per product; Admin API only, never the theme | `worker/lib/launcher.ts` creates or updates the product in the shared store, publishes it to the Online Store, and deploys the site to Pages |
| 2 | `ecom_sites`, `ecom_orders.site_id` + `attribution`; Stores → Sites; sites per product | `supabase/schema_127_ecom_sites.sql`; `SitesPanel.tsx`; HQ "Sites per approved product" |
| 3 | Buy = cart permalink with attribution; variant picker; gate | `buildCheckoutUrl`, `pointBuyButtons`, `siteScript`, `checkoutGate` in `worker/lib/sites.ts` |
| 4 | Webhook reads `mm_site`; revenue and funnel per site; beacon; unattributed flag | `attributeOrder` (sites.ts); `recordShopifyOrder` (ecomOctober.ts); `POST /api/ecom/beacon` → `ecom_site_hit()`; `unattributed_orders` rule (flags.ts) |
| 5 | Domain through checkSpend; pages.dev until bought; connect via the Pages API | `worker/lib/siteDomains.ts`; `buy_domain` approval; Sites card buttons |
| 6 | Shared checkout branding, shared policies, one support address, prohibited filter | `siteFooter` (sites.ts); Store Builder prompt rule; Setup step 1; `prohibitedReason` in Scout and Pitch |
| 7 | Dev Dashboard app: Client ID + Secret, client credentials grant, one token helper | `worker/lib/shopify.ts` (`getShopifyToken`, `withShopify`); Setup → Shopify card |
| 8 | Docs | This file; Phase 2 note in `OCTOBER-BUILD-BRIEF.md`; decisions 68–80 |

Tests: `tests/shopify-auth.test.ts` (token fetch, cache, refresh, 401) and `tests/ecom-sites.test.ts` (permalink, gate, footer, script, attribution, flag, slugs, prohibited filter, per-site stats, domains).

## What Marq does for a new store

1. Create the Shopify store (Basic). Name it a neutral parent brand, e.g. "MARQ Goods". Set the checkout and email logo to it.
2. Fill in its Refund, Shipping and Privacy policies in Shopify (Settings → Policies). Every site links to these.
3. In the Dev Dashboard, create the app and give it the scopes `read_orders, read_products, write_products, write_publications, read_analytics`. Install it on the store, then copy the Client ID and Secret into Setup → Shopify with the store domain.
4. Remove the storefront password before the first launch.
5. When a site is worth a real domain, use Sites → Buy domain → approve in Inbox → buy it at Cloudflare → I bought it → Connect.
