# Neon validation

[Back to Neon](README.md) · [Reproduce the browser workflow](docs/testnet.md) · [GitHub verification](https://github.com/agammann/neon/actions/workflows/verify.yml)

## Release decision

Neon is deployed publicly at [neon.alx21.chatgpt.site](https://neon.alx21.chatgpt.site) with Ethereum Mainnet trading enabled. **A real money mainnet validation transaction was intentionally skipped by the project owner.** That decision does not convert it into a completed test.

The recorded application release was Sites version 7, source commit [4c257db](https://github.com/agammann/neon/commit/4c257db17ea6a0137e32605fa6808358dd64233e). Its [GitHub verification run](https://github.com/agammann/neon/actions/runs/35177838151) succeeded. Documentation may advance independently of that unchanged application build.

## Recorded verification

Results below were recorded September 17, 2026 UTC, September 16 Pacific. Market quotes and balances are snapshots, not current prices.

| Area | Evidence and result |
| --- | --- |
| Automated suites | 25 passed, 0 failed: 23 offline tests and two contract fork integrations |
| Contract behavior | ETH / USDT swaps; signed partial and full fills; signature tampering, replay, cancellation, revoked approval, and expiry checks |
| Reorganization handling | Filled or cancelled orders recovered after simulated chain reversals; orphaned receipts suppressed |
| Fresh browser workflow | Seven successful local transactions; Alice received 2 USDT, Bob acquired and unwrapped 0.001 WETH |
| Browser failure handling | Rejected signature published nothing; stale cancelled fill rejected before submission; account change disabled actions |
| Permissions after cleanup | Both wallets had zero USDT and WETH allowances to 0x |
| Mainnet reads | Chain 1, expected contracts, signing domain match, zero 0x fee multiplier, and quotes in both directions |
| Published assets | Four JavaScript/CSS asset hashes matched the tested build; rendered interface checked separately |
| Dependency and CI checks | Production advisory check and the release GitHub workflow passed |

## Pagination and browser lifecycle verification

The following checks were repeated on October 2, 2026, using Node 24.19.0, pnpm 11.19.0, and Chrome 154.0.8037.95 on Windows. They cover the pagination and native WebMCP cache-restoration fixes; they do not replace the dated release record above.

| Area | Evidence and result |
| --- | --- |
| Automated suites | 27 passed: 25 offline tests, including [pagination regressions](tests/order-pagination.test.mjs), and both contract fork integrations |
| Build and dependencies | `pnpm check`, `pnpm build`, and `pnpm audit --prod` passed; Ganache used its JavaScript fallback because its optional native module did not support this Node build |
| Pagination in the rebuilt browser bundle | Delayed and failed API responses verified that rapid clicks cannot skip pages, a failed or wrong-network response preserves the displayed page, retry loads the intended page, and refresh reloads the current page |
| Pagination layout | Desktop and 390-pixel mobile viewports checked; no horizontal page overflow |
| Native WebMCP | Native `read_exchange` and `place_simulated_order` calls worked before and after two actual Back/Forward-cache restorations; all three registered tools and the existing exchange/form state survived; an ordinary reload registered each tool once |
| Fresh local testnet walkthrough | Seven successful transactions on chain 31337: wrap, two approvals, partial fill, cancellation, revocation, and unwrap. Alice gained 2 USDT, Bob spent 2 USDT, Alice retained 0.001 WETH, Bob ended with zero WETH, and both wallets had zero 0x allowances. One fill was indexed |
| Local failure handling | A rejected signature published no order; filling the cancelled selection failed before the wallet confirmation dialog |
| Deployed demo | Demo balances, self-trade and insufficient-funds rejection, reset dismissal/confirmation, cancellation, and the 390-pixel layout passed without wallet interaction |
| Deployed readiness | Storage health and settlement readiness both returned HTTP 200 at 10:17 UTC; chain 1, verified contracts, zero protocol fee multiplier, block 26103990 |

Pagination failure cases used controlled API responses against the rebuilt interface. Contract suites and the local walkthrough executed copied Ethereum contract code with disposable wallets. No real wallet was connected and no mainnet transaction or approval was submitted.

Native WebMCP was explicitly enabled with Chrome's `--enable-features=WebMCP,WebMCPTesting` testing configuration; no shim was used. Default Chrome in this environment did not expose the API. This verifies the native browser API and lifecycle, not compatibility with every external browser-agent client. The deployed demo emitted a content-policy warning for a Cloudflare-injected inline script; its tested controls remained functional.

## Evidence files

| File | Scope |
| --- | --- |
| [Release testnet](validation/release-testnet.json) | Latest seven transaction Alice and Bob browser scenario, balances, order state, and receipts |
| [Mainnet readiness](validation/mainnet-readiness.json) | Read only contract checks, code hashes, quotes, and timestamp; no transaction or signature |
| [Earlier swap testnet](validation/local-testnet.json) | Eight local browser transactions including swaps, USDT allowance reset, and revocation |
| [Earlier limit orders](validation/limit-orders-testnet.json) | Ten local browser transactions including sell and buy orders, partial fills, cancellation, and cleanup |
| [Earlier validation notes](docs/validation-history.md) | Historical implementation checks and their original scope |

Test wallets were disposable. Evidence files contain no private keys or session capabilities. The local testnet uses copied contract code and Ethereum state on chain 31337; it is not Sepolia or a real mainnet trade.

## Reproduce the checks

Run the [development commands](docs/development.md#commands) and follow the [browser walkthrough](docs/testnet.md). CI runs offline checks, rebuild verification, and production dependency auditing; main branch runs also execute the two fork suites and read only mainnet checks.

[Live readiness](https://neon.alx21.chatgpt.site/api/readiness) checks recent Ethereum data and settlement configuration. It returns HTTP 503 on failure. [Storage health](https://neon.alx21.chatgpt.site/api/health) checks storage separately. Neither endpoint certifies wallet compatibility, transaction execution, or safety.

## Verification boundaries

External wallet mainnet signing, hardware wallet combinations, and current mobile wallet compatibility remain unverified. Earlier simulator and instant swap layouts were checked at 390 pixels; the shared order interface was checked on desktop. No independent security audit is claimed.

One confirmation is not finality. History contains app indexed receipts rather than a complete chain index. An empty book needs user supplied orders and counterparties. Fork testing and mainnet read checks provide integration evidence without guaranteeing execution or safety under every production condition.
