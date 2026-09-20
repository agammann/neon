# Neon native ETH market lab

This is an **experimental, local-chain prototype** of an ETH-funded ETH/USD market. Alice and Bob deposit native **test ETH** directly into `NeonNativeMarket`, take opposite sides of a bilateral position, settle gains and losses in ETH, and withdraw native ETH. The trading flow has no WETH, USDT, token approvals, exchange wallet, or offchain custody account.

The contract deliberately deploys **only on chain 31337**. It refuses Ethereum Mainnet and Sepolia. The oracle is an adjustable mock controlled by the lab. **Do not send real ETH or use this code as a live exchange.** The published Neon website and the existing `main` branch still run the earlier ETH/USDT spot product; this branch does not update that deployment.

## Run Alice and Bob locally

Install Node.js 22.13 or newer and pnpm 11.19.0. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm test:native
pnpm native:lab
```

Open **http://127.0.0.1:4322/** on the same computer. The lab starts a disposable Ethereum chain with funded Alice and Bob accounts, compiles and deploys the contracts, and binds its web server to `127.0.0.1`. No wallet extension, seed phrase, faucet, or real funds are needed. Stop it with Ctrl+C; restarting creates fresh accounts and history.

To see a complete trade:

1. Deposit 1 test ETH for Alice and Bob.
2. Leave Alice on **Long ETH**, 1 ETH margin, 2× leverage, and post an offer.
3. Click **Bob match** before the one-hour expiry. Matching requires the oracle price to remain within the maker's 1% limit and Bob's 0.5% execution bounds.
4. Set the mock ETH/USD price from $2,000 to $2,200, then click **Alice close**. Alice receives about 1.181818 ETH and Bob about 0.818182 ETH in available balances. The equal and opposite change is an inverse ETH-denominated payoff, bounded by each side's 1 ETH margin.
5. Click **Withdraw all** for each trader. The contract sends their available native test ETH back to their disposable wallets.

Use **Reset lab** to clear those transactions. The server keeps the disposable private keys only in its process memory and signs transactions for the two fictional traders. This convenience is specific to the local lab. It is not a production signing design.

## Contract model and safety boundary

Each maker offer reserves margin in the contract. A counterparty must reserve an equal amount to match. Either position participant can close at the current oracle price. Anyone can trigger liquidation once the calculated loss reaches 80% of one side's margin. If the oracle is more than an hour old, priced actions stop; after a position has been open for a full day and the oracle has not updated for a full day (or has stopped responding), anyone may trigger a **neutral return of both original margins**. That escape sacrifices unrealized PnL and is not a fair-price guarantee.

There is no owner, upgrade hook, fee recipient, exchange withdrawal key, or operator settlement authority in this prototype. Withdrawals are limited to each trader's available balance. The contract tracks total liabilities, and the tests verify that settlement conserves the deposited ETH. These features reduce a narrow operator rug path, but they **do not make loss or a rug impossible**: contract bugs, oracle manipulation, transaction ordering, user mistakes, a compromised interface, and Ethereum risks remain. The mock oracle is trivially controllable and is acceptable only in this disposable environment.

This is **not yet a production perpetual exchange**. There is no funding rate, robust mark/index design, insurance or bad-debt system, liquidation incentive, market surveillance, independent audit, external oracle deployment, real-wallet frontend, or operational monitoring. The onchain offer list is a minimal bilateral matching mechanism, not a scalable order book. Either participant can close a position at the oracle price without the other's signature; users would need to explicitly accept that rule before any production version. Before any Mainnet release, the contract needs a new design review, security audit, economic testing, Sepolia end-to-end deployment, incident procedures, and applicable legal review. Passing local tests alone does not establish Mainnet safety.

Run `pnpm build:native` to compile the two contracts; generated artifacts are local and ignored by Git. The integration suite exercises deposits, offers, matching, ETH-denominated PnL, withdrawals, cancellation, liquidation, stale-oracle refund, and refusal to deploy on Mainnet.
