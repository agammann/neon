# Neon

Neon is being rebuilt as an **ETH funded perpetual trading terminal on Ethereum Mainnet**. The new terminal displays the live ETH-USDT perpetual market, signs orders in the user's wallet, and routes execution to [Synthetix](https://synthetix.io/). Neon does not operate the matching engine or hold collateral in a Neon contract.

**Release state:** this `eth-perps` branch is a development candidate. The [currently published Neon site](https://neon.alx21.chatgpt.site/) and GitHub `main` still run the earlier ETH/USDT spot app. No Synthetix trade or withdrawal with real money has been tested or deployed from Neon. Do not treat this branch as a verified production exchange.

## What the rebuild does

The terminal reads live Synthetix ETH-USDT mark, index, funding, order book and candles. With an Ethereum wallet, an eligible trader can wrap ETH into WETH, deposit WETH to Synthetix's published Mainnet deposit contract, discover a trading account, sign leverage and market or limit orders, inspect positions and open orders, submit reduce-only closes or cancellations, request a WETH withdrawal, and unwrap WETH back to ETH. Neon checks the venue's [wallet trading-access endpoint](https://developers.synthetix.io/developer-resources/api/rest-api/info/getIsWhitelisted) before enabling deposits or orders. Wallet and Synthetix signatures are required; Neon has no operator trading key.

Synthetix currently uses **WETH as collateral, but its perpetuals are USDT quoted and settled**. Fees, funding and realized PnL affect a USDT balance, which can become debt and can trigger a forced collateral exchange. WETH also receives a valuation haircut. This is an ETH funded product, not an ETH denominated inverse perpetual. See the [ETH perpetual guide](docs/eth-perps.md) before funding an account.

The earlier spot terminal remains in this branch at `/spot.html`, along with its [trading guide](docs/trading.md), [Alice and Bob local testnet](docs/testnet.md), and [historical validation](VALIDATION.md). These describe the spot app, not the new perpetual interface.

## Run the rebuild locally

Install Node.js 22.13 or newer and pnpm 11.19.0. From this checkout:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open `http://127.0.0.1:4318/`. The market screen reads the live Synthetix API, so network access is required. The browser wallet must be on Ethereum Mainnet, chain 1. **The controls can submit real-money requests if used with a funded wallet.** Use a disposable fork for contract tests; do not use a real wallet for exploratory QA.

To keep an existing local Neon instance running, choose another port: `$env:PORT=4320; pnpm start` in PowerShell or `PORT=4320 pnpm start` in a POSIX shell.

## Verify

```sh
pnpm test
pnpm build
pnpm check:perps
pnpm test:perps:fork
```

`pnpm test` checks the signed order payload, actionable account/order parsing, and bounded venue proxy. `pnpm check:perps` reads current Mainnet contract bytecode and public Synthetix market and collateral configuration, without signing or spending. The fork test runs Neon's wrap, unwrap and deposit functions with disposable ETH/WETH against copied Mainnet contract state. [Recorded evidence](validation/perps-mainnet-readiness.json) contains no wallet keys or real transaction.

These checks do **not** demonstrate an authenticated live fill, liquidation handling, or a completed withdrawal. The [Synthetix API environment documentation](https://developers.synthetix.io/environments) lists a production Mainnet API; its public API testnet remains in development. A real-money pilot, threat review of the integrated flow, and independent security assessment remain before public launch.

## Custody and trust

The fixed WETH and Synthetix deposit addresses are in [synthetix-client.js](src/synthetix-client.js). The app requests an exact WETH approval and signs each trade; withdrawal destinations default to the connected wallet. This removes a Neon-controlled vault, but **cannot make user loss or rug risk impossible**. Synthetix contract governance, off-chain matching, website updates, API availability, wallet compromise, funding, liquidation and market risk still matter. Neon is independent of Synthetix and LN Markets.

Source is public for inspection. No open source license is granted for Neon. Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
