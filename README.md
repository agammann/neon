# Neon

> **Native ETH market work in progress:** [Try the local Alice and Bob lab](native-market/README.md). This separate experimental branch uses only native test ETH for margin and payouts. It is not deployed or ready for real funds. The published site described below is the earlier ETH/USDT spot application.

**Trade ETH and USDT from your own Ethereum wallet.**

[Open Neon](https://neon.alx21.chatgpt.site) · [Trading guide](docs/trading.md) · [Testnet walkthrough](docs/testnet.md) · [Validation](VALIDATION.md) · [Build status](https://github.com/agammann/neon/actions/workflows/verify.yml)

Neon provides native ETH / USDT instant swaps through Uniswap v3 and a shared WETH / USDT limit order book settled through 0x. Funds remain in users' wallets until settlement. There is no Neon deposit account, withdrawal queue, or operator settlement key.

## Choose where to start

| Goal | Start here | Funds and network |
| --- | --- | --- |
| Use the published app | [Open Neon](https://neon.alx21.chatgpt.site) in a wallet enabled browser | Real funds on Ethereum Mainnet, chain 1 |
| Try the Alice and Bob workflow | Run the local testnet below | Disposable funds on a local Ethereum fork, chain 31337 |
| Explore matching concepts | Select **Bob + Alice demo** in the app | Synthetic balances in the current browser tab |
| Develop or operate Neon | [Development guide](docs/development.md) | Separate mainnet and test profiles |

The mainnet limit order book needs users to publish orders and other users to fill them. Posting a crossing order does not automatically match it. Instant swaps use existing Uniswap liquidity. WETH is the wrapped form of ETH used by limit orders; the app includes wrap and unwrap controls.

## Interactive local testnet

Install [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org/en/download) 22.13 or newer, and the pinned package manager. Node 22 is used in CI; Node 24 has also been exercised locally.

```sh
npm install --global pnpm@11.19.0
git clone https://github.com/agammann/neon.git
cd neon
pnpm install --frozen-lockfile
pnpm testnet
```

These commands work in PowerShell and a POSIX shell. If PowerShell blocks the `npm.ps1` or `pnpm.ps1` shim, use `npm.cmd` or `pnpm.cmd` for the same commands.

Wait for **Test lab ready**, then open `http://127.0.0.1:4319/` on the same computer. The page must say **LOCAL TESTNET · NO REAL FUNDS**. Select Alice or Bob and click **Connect wallet**. The built in disposable wallet handles test confirmations; no extension, faucet, seed phrase, or real funds are needed.

Follow the [Alice and Bob walkthrough](docs/testnet.md) for exact steps and expected balances. Internet access is needed to read Ethereum state. Keep the terminal running; **Ctrl+C** stops the lab. Restarting creates fresh wallets and clears the lab book.

## Release status

The application is publicly deployed with mainnet trading enabled. Recorded release verification passed **25 tests**, including two contract fork suites, plus browser transactions with disposable wallets. Mainnet contract identity, signing domain, and quote checks passed. **A real money mainnet transaction test was intentionally skipped by the project owner.** No independent security audit is claimed.

The local testnet copies actual Ethereum contract code and state. It is not Sepolia or an official issuance of test USDT. See [Validation](VALIDATION.md) for dated evidence and verification boundaries.

## Documentation

| Guide | Covers |
| --- | --- |
| [Trading](docs/trading.md) | Wallet connection, swaps, orders, cancellation, and permissions |
| [Local testnet](docs/testnet.md) | Alice and Bob example with expected results |
| [Development](docs/development.md) | Commands, source layout, persistence, configuration, and deployment |
| [Troubleshooting](docs/troubleshooting.md) | Installation, RPC, wallet, approval, and order issues |
| [Validation](VALIDATION.md) | Test coverage, evidence, and release decision |
| [Contributing](CONTRIBUTING.md) | Focused changes, checks, and bug reports |

## Custody and trust

Neon stores public signed orders and indexed receipts, not private keys. Disconnecting a wallet does not cancel orders or revoke approvals. Transactions require gas, and cancellation or revocation only takes effect when confirmed.

The 0x proxy has its own upgrade governance. Tether has issuer controls. Website, wallet, dependency, protocol, RPC, liquidity, and network risks remain. One confirmation is not finality. Fixed contract addresses and protocol references are listed in the [trading guide](docs/trading.md#contracts-and-references).

## Source and attribution

Source is public for inspection. No open source license is granted for Neon. Dependency licenses are preserved in [Third party notices](THIRD_PARTY_NOTICES.md).

The educational simulator was inspired by [Brian Nigito’s How to Build an Exchange](https://www.janestreet.com/tech-talks/building-an-exchange/). Neon has no affiliation with Jane Street and does not claim its architecture or performance.
