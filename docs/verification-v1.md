# Neon 1.0.0 verification

[README](../README.md) · [Historical validation](../VALIDATION.md) · [CI](https://github.com/agammann/neon/actions/workflows/verify.yml)

The October 8, 2026 release checks use Node 24.19.0, pnpm 11.19.0, Windows 11 x64 and Chrome 155.0.8059.12. The release workflow repeats installation, build reproduction, the offline suite, both fork suites, dependency audit and fresh source-ZIP extraction on Windows and Linux before publishing.

The local checks passed 25 offline tests plus two actual contract-fork suites. The fork suites execute copied Uniswap/token/0x contracts with disposable balances and confirm swaps, partial and full fills, cancellation, allowance revocation, expiry, invalid signatures, duplicate receipts and simulated chain-state recovery. Wrong-chain refusal and separation of production and lab signers are checked explicitly. The full dependency audit reports zero advisories for the released lockfile.

The actual browser walkthrough confirms seven successful chain-31337 receipts: wrap, maker approval, taker approval, half fill, cancellation, revocation and unwrap. Alice receives exactly 2 test USDT, Bob spends exactly 2 test USDT, Alice retains 0.001 WETH, Bob finishes with no WETH and both 0x allowances are zero. A rejected signature publishes no order, and trying to fill the cancelled order submits no transaction.

Additional browser swaps in both directions passed independent onchain balance, minimum-output, gas-fee and exact-allowance checks. Rejecting a swap preserves balances. Disconnect, reload and reconnect preserve the shared settled book. The interface fits at 390 and 320 pixels. Stopping and restarting the lab produces new disposable wallet addresses and an empty book.

Chrome 155 with its native WebMCP testing features enabled registered all three page tools. Native simulation reads and placement passed, registrations and simulation state survived two actual back-forward-cache restores, and ordinary reload reset the tab simulation. This check uses the browser's native implementation with an empty local read-only book fixture; public book readback is a separate deployment check.

The read-only mainnet check confirms current contract identities, the order signing hash and quotes in both directions. It submits no transaction and requests no signature. These results do not claim a real-money transaction or an independent security audit. Ethereum RPC availability remains a requirement for starting the contract-fork lab.

The source archive manifest records its exact commit, tree, byte count and SHA-256. The fresh extraction check verifies every tracked byte before installing and building both browser profiles. Generated lab records, local databases, dependencies and private state are excluded. The guarded publisher checks the complete asset set and tag before publication, and leaves an existing published release unchanged.
