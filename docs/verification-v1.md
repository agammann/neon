# Neon verification

[README](../README.md) · [Historical validation](../VALIDATION.md) · [CI](https://github.com/agammann/neon/actions/workflows/verify.yml)

## November 17, 2026 checks

Local checks used Node 24.19.0 and pnpm 11.19.0 on Windows. The 1.0.3 offline suite passed 31 tests with one Linux-only test skipped. The native lab suite passed all 14 tests, and the full dependency audit reported zero advisories. The focused WebMCP regression fails against the earlier read-only declaration and passes with the corrected hints. The generated public wallet bundle changes only that declaration, and the HTML footer identifies 1.0.3.

Before the annotation correction, native browser WebMCP discovered and executed all three tools against an isolated synthetic book. The documented fork walkthrough completed seven chain-31337 receipts, a rejected signature with no published order, the exact 2 USDT half fill, cancellation, allowance revocation and unwrap. Swaps in both directions brought the local session to ten successful receipts. The indexed fill survived a reload. These transactions used disposable accounts and state copied from the free public RPC.

The rebuilt 1.0.3 tool registered with the corrected hints and returned the retained indexed fill from chain 31337 without a wallet connection.

The separate native test-only lab completed deposits of 1 test ETH per trader, a matched 2× position and settlement after the mock price moved from 2000 to 2200. Available balances were 1.181818181818181818 ETH for Alice and 0.818181818181818182 ETH for Bob. Both withdrew their full available balances. This experimental lab remains restricted to chain 31337 and uses an adjustable local oracle.

A separate read-only mainnet check verified contract identities, the signing hash and quotes in both directions at block 26437583 using `https://ethereum-rpc.publicnode.com`. It requested zero signatures and submitted zero transactions. Its output was saved outside the source tree, preserving the historical readiness snapshot. Mainnet wallet signing and real-money transactions remain untested.

## October 8, 2026 release checkpoint

The October 8, 2026 release checks used Node 24.19.0, pnpm 11.19.0, Windows 11 x64 and Chrome 155.0.8059.12. The workflow at that checkpoint repeated installation, build reproduction, the offline suite, both fork suites, dependency audit and fresh source-ZIP extraction on Windows and Linux before publishing.

Current pull-request and main-branch CI run offline checks and fresh source consumers. The fork suites and read-only mainnet readiness check require a manual workflow dispatch with `live_rpc_checks` enabled. That input defaults to off. See the [current CI guidance](development.md#readiness-and-service-limits) for the release gate.

The local checks passed 25 offline tests plus two actual contract-fork suites. The fork suites execute copied Uniswap/token/0x contracts with disposable balances and confirm swaps, partial and full fills, cancellation, allowance revocation, expiry, invalid signatures, duplicate receipts and simulated chain-state recovery. Wrong-chain refusal and separation of production and lab signers are checked explicitly. The full dependency audit reports zero advisories for the released lockfile.

The actual browser walkthrough confirms seven successful chain-31337 receipts: wrap, maker approval, taker approval, half fill, cancellation, revocation and unwrap. Alice receives exactly 2 test USDT, Bob spends exactly 2 test USDT, Alice retains 0.001 WETH, Bob finishes with no WETH and both 0x allowances are zero. A rejected signature publishes no order, and trying to fill the cancelled order submits no transaction.

Additional browser swaps in both directions passed independent onchain balance, minimum-output, gas-fee and exact-allowance checks. Rejecting a swap preserves balances. Disconnect, reload and reconnect preserve the shared settled book. The interface fits at 390 and 320 pixels. Stopping and restarting the lab produces new disposable wallet addresses and an empty book.

Chrome 155 with its native WebMCP testing features enabled registered all three page tools. Native simulation reads and placement passed, registrations and simulation state survived two actual back-forward-cache restores, and ordinary reload reset the tab simulation. This check uses the browser's native implementation with an empty local read-only book fixture; public book readback is a separate deployment check.

The read-only mainnet check confirms current contract identities, the order signing hash and quotes in both directions. It submits no transaction and requests no signature. These results do not claim a real-money transaction or an independent security audit. Ethereum RPC availability remains a requirement for starting the contract-fork lab.

The source archive manifest records its exact commit, tree, byte count and SHA-256. The fresh extraction check verifies every tracked byte before installing and building both browser profiles. Generated lab records, local databases, dependencies and private state are excluded. The guarded publisher checks the complete asset set and tag before publication, and leaves an existing published release unchanged.
