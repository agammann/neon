# Earlier validation notes

Historical record retained from the implementation. For the current release decision, see [Validation](../VALIDATION.md).

Status: deployed successfully at https://neon.alx21.chatgpt.site with public access. The shared order Worker and D1 schema are live. Public health and order API reads returned HTTP 200, chain ID 1, and ready storage. The initial mainnet book is empty. Four application assets match local SHA256 hashes. The rendered live order interface was verified separately.

## Release verification, September 17 UTC / September 16 Pacific

25 tests passed, 0 failed: 23 offline tests and two real contract fork integration tests. This rerun includes signature tampering, partial and full fills, replay rejection, cancellation, approval revocation, expired orders, receipt idempotency including hash case, and recovery after simulated reorganizations of both fills and cancellations. The public book rechecks candidates regardless of cached status. Receipt history suppresses fills absent from current chain receipts and retains them for possible reappearance. Finality is explicitly not checked.

Seven fresh browser transactions on chain 31337 passed with receipt status 1. Alice wrapped 0.002 ETH and signed a sell order. Bob paid 2 USDT for 0.001 WETH. Alice cancelled the remaining order and revoked WETH permission; Bob unwrapped the purchased 0.001 WETH. Both wallets ended with zero USDT and WETH allowances to 0x. Rejected signing published nothing, the stale cancelled fill was rejected before submission, and changing participant disabled transaction controls until reconnecting. Both tabs had no console errors. [Release browser evidence](../validation/release-testnet.json) records balances, public test signatures, order states, and all seven receipts without keys or session capabilities.

[Read only mainnet evidence](../validation/mainnet-readiness.json) records chain ID 1, recent blocks, six contract code hashes, the 0x signing domain match, zero protocol fee multiplier, and live quotes in both directions. It requested no signatures and submitted no transactions. `pnpm check:mainnet` reproduces this check. At the time of this record, main branch CI also ran the two fork suites and published a mainnet readiness artifact. The [current CI policy](../.github/workflows/verify.yml) requires a manually enabled live RPC check.

The new `/api/readiness` endpoint checks fresh Ethereum data plus Uniswap, USDT, and 0x integration identity. It returns HTTP 503 when settlement readiness fails even if `/api/health` still reports working storage. A successful readiness result does not verify an external wallet or certify safety.

Mainnet trading is configured and publicly enabled. External wallet signing, hardware wallets, and current mobile wallet compatibility remain outside completed validation. A real mainnet smoke transaction must be reviewed and signed by its wallet owner. No independent security audit is claimed. These are explicit production signoff limits, not completed tests.

## Earlier observed results

The preceding revision had 23 tests passed, 0 failed on September 17, 2026 UTC (September 16 Pacific). This includes 21 offline tests and two separate Ethereum fork integration tests.

The Ethereum fork at block 25,993,956 executed the real deployed Uniswap router and Tether bytecode locally. Selling 0.01 test ETH received 24.353445 USDT in that fork. The reverse trade returned native ETH to the same test account, and the exact USDT allowance became zero. Bob, the other ephemeral test account, received no funds from Alice’s trade. These are fork results, not a live quote, and no real funds were spent.

Original simulator and instant swap browser checks covered the actual Bob and Alice partial fill, updated balances, transaction history, synthetic chart, visible Neon branding, wallet mode, disabled disconnected actions, and the no wallet error. Those original modes fit a 390 pixel viewport. The new shared order interface was checked on desktop; mobile wallet compatibility remains unverified. Browser console showed no errors during those checks.

WebMCP read and simulated placement tools registered. A valid placement updated visible balances and state. A self trade attempt returned an intentional error and did not change balances. These tools cannot connect a wallet, approve tokens, or execute real transactions.

## Interactive local testnet verification

The browser wallet flow was exercised on chain ID 31337 with a local mainnet fork and disposable Alice and Bob wallets. Eight submitted transactions confirmed with receipt status 1. The recorded initial balances, final balances, transaction requests, logs, and receipts are in [local-testnet.json](../validation/local-testnet.json). No keys or session capabilities are recorded.

Alice sold 0.01 test ETH and received 24.276591 fork USDT. She approved exactly 10 USDT and bought 0.004115144159203209 native test ETH, excluding gas. The approval was fully consumed. Next she approved 5 USDT, requested a larger trade, reset the nonzero allowance to zero, approved 10 USDT, and revoked it. Bob then sold 0.005 test ETH for 12.138295 fork USDT. Both final router allowances were zero. Bob's balances were unchanged by Alice's trades before Bob's own sale.

A rejected test wallet confirmation submitted no transaction. Bob's attempted 500 USDT purchase was rejected as insufficient balance with both approve and swap controls disabled. Changing participant disconnected the old account and required reconnecting. The first wallet is selected automatically; balances and action buttons remain unavailable unless contract verification succeeds.

The offline build tests prove the default settlement rejects chain 31337, the lab build rejects chain 1, and the public bundle excludes the local signing service. The original mainnet configuration also passed its separate fork integration after the network refactor, selling and buying through the real contract code locally. Test amounts and quotes describe those snapshots, not current market prices.

## Live limit order verification

Ten additional browser transactions confirmed on the local Ethereum fork. Alice and Bob used separate browser tabs and independently selected disposable wallets. Alice wrapped 0.02 ETH, approved 0.01 WETH, and published a signed sell order for 0.01 WETH at 2,000 USDT. Bob approved 10 USDT and filled 0.005 WETH. Alice cancelled the remaining order; Bob's stale fill attempt was rejected before submission.

Alice then approved 2 USDT and posted a buy order for 0.001 WETH. Bob approved 0.001 WETH and filled it. Bob unwrapped his remaining 0.004 WETH. Alice revoked her unused WETH permission. Both users finished with zero 0x USDT and WETH allowances. Alice's first order was cancelled, her second was filled, and two confirmed fills were indexed from receipts. [Full evidence](../validation/limit-orders-testnet.json) includes initial and final balances, signed test orders, API states, transaction requests, logs, and all ten successful receipts. No private keys or capabilities are included.

The separate protocol/API integration test verifies mainnet signing hashes against deployed 0x code, signed order storage, partial fills, full fills, replay rejection, onchain cancellation, and receipt indexing. Unsigned or tampered orders are rejected. API tests cover body bounds, storage protection, and request budgets. Network compilation tests separate the public mainnet build from the local test signer.

## Limits

No real wallet transaction has been signed or submitted. Actual browser extension signature prompts, hardware wallets, replacement transactions, hosted browser wallet behavior, and mobile wallet compatibility are not fully verified. There is no independent security audit. Fork testing is strong integration evidence, not proof of production safety or universal compatibility. The simulator is tab local, not a persistent multiplayer matching service. Instant swaps use Uniswap pools; live signed orders use 0x wallet settlement; the separate educational demo remains simulated.

The source and deployed build output are intended to match. Build with the lockfile and inspect the recipient, router, token, value, minimum output, and deadline before signing any real transaction. Do not treat a successful website deployment as verification of real money trading.

Production dependency audit: no known vulnerabilities found. External user wallet signing remains unverified. The built in disposable test wallet was exercised through the browser.



Read only mainnet verification: chain ID 1 and official contract references passed against Ethereum Mainnet at block 25,993,985. Both sell and buy quotes returned from mainnet pools. Zero transactions were submitted. GitHub Actions run 35171272352 completed successfully for the first published source revision.
