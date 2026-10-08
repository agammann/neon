# Troubleshooting

[Back to Neon](../README.md) · [Local testnet](testnet.md) · [Trading](trading.md)

## Installation and startup

| Symptom | What to do |
| --- | --- |
| `node` or `pnpm` is not recognized | Install Node.js 24.19.0 and pnpm 11.19.0, then open a new terminal. Check `node --version` and `pnpm --version`. |
| PowerShell blocks a script shim | Run the same command using `npm.cmd` or `pnpm.cmd`. No execution policy change is needed for that workaround. |
| Lockfile mismatch | Use the committed lockfile and pinned pnpm. Check that you are in the repository root. Do not discard the lockfile to bypass the error. |
| Unsupported `node:sqlite` | Use Node.js 24.19.0. The local server uses the built in SQLite module. |
| Ganache reports a missing native µWS binary | A JavaScript fallback is expected on some Node versions. Continue if the lab subsequently prints **Test lab ready**. An actual startup failure still needs investigation. |
| `EADDRINUSE` on 4318 or 4319 | Another instance is already listening. Use that instance or stop its terminal with **Ctrl+C** before restarting. |
| Lab startup stalls or quotes are unavailable | The fork needs a working Ethereum RPC and internet access. Retry once connectivity is restored, or configure a trusted `ETHEREUM_RPC_URL` privately. |
| Lab works at 127.0.0.1 but not another hostname | Use exactly `http://127.0.0.1:4319/`; the test wallet intentionally restricts its origin. |
| Lab reports session errors after a restart | Reload both browser tabs and reconnect. The old session capability and wallets no longer belong to the running lab. |

## Wallet and trade issues

| Symptom | What to do |
| --- | --- |
| No browser wallet found | Open the mainnet site in a browser with an Ethereum wallet extension or an injected wallet browser. Codex's in app browser may have no wallet. The local lab has its own disposable wallet. |
| Wallet account or network changed | Select Ethereum Mainnet and reconnect for the public app. For the lab, select the desired participant and reconnect. |
| Insufficient USDT, WETH, or ETH | Check the input token balance and leave ETH for gas. ETH and WETH are separate balances; wrap ETH before a WETH sell order. |
| Approval button asks for a zero allowance | An insufficient nonzero allowance is being reset. Wait for confirmation, then request the required exact approval. For swaps, get a new quote between steps. |
| Quote expired | Click **Get quote** again. Quotes last 30 seconds; approval transactions usually require refreshing the quote. |
| No funded orders appear | The book needs participants. Refresh, try another page if available, or publish an adequately funded and approved order. The simulator's orders do not appear in the live book. |
| Order changed or no longer has sufficient funds | Refresh. The order may have been filled, cancelled, expired, or lost sufficient funds or allowance. |
| Active order capacity reached | Cancel unwanted orders and refresh your order history. The global unexpired storage cap also includes terminal orders until expiry. |
| Too many requests | Wait one minute before retrying. Avoid repeatedly pressing refresh in several tabs. |
| Trade confirmed but shared history delayed | Open the wallet transaction receipt. A receipt can succeed before indexing succeeds; the shared history is not a complete chain indexer. |
| Transaction replaced, reverted, or timed out | Inspect the wallet's activity and transaction receipt before trying again. A submitted transaction may still be pending or replaced. |
| Disconnected but an order can still be filled | Disconnecting does not cancel signatures or revoke approvals. Use **Cancel order** or the corresponding revoke control and wait for confirmation. |

## Reporting a bug

Use [GitHub issues](https://github.com/agammann/neon/issues) for ordinary bugs. Include the mode and chain, browser and wallet versions, steps, expected behavior, actual behavior, and a redacted error message. A public receipt hash is useful only if you are comfortable associating that transaction with the issue.

Do not post seed phrases, private keys, cookies, session capabilities, credential-bearing RPC URLs, or unpublished order signatures. For suspected vulnerabilities, see [Contributing](../CONTRIBUTING.md#security-reports).
