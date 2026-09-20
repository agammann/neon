# ETH perpetual trading in Neon

[Back to Neon](../README.md) · [Synthetix trader documentation](https://docs.synthetix.io/) · [Synthetix developer documentation](https://developers.synthetix.io/)

## Product model

Neon's new terminal is an independent interface to Synthetix's ETH-USDT perpetual on **Ethereum Mainnet, chain 1**. Synthetix supplies the exchange order book, matching, risk engine, funding and settlement. Neon supplies a client-side chart, order form and account interface, and a bounded API proxy to add the required User-Agent header. The proxy holds no user private key and cannot change the destination, size, side, price or leverage of a valid EIP-712 signed request without invalidating its signature.

The product is ETH funded through WETH. It is **not ETH settled**: the venue quotes and settles in USDT. WETH contributes to margin after a haircut. Trading fees, funding and realized PnL affect USDT balance, including possible debt and forced exchange of WETH. Read the venue's [multicollateral guide](https://docs.synthetix.io/deposits-withdrawals/multi-collateral-margin) and [liquidation guide](https://docs.synthetix.io/trading/liquidations) before using leverage.

## User flow

1. Open Neon in a wallet-enabled browser and connect on Ethereum Mainnet. Neon reads the wallet's ETH and WETH balances, checks [Synthetix trading access](https://developers.synthetix.io/developer-resources/api/rest-api/info/getIsWhitelisted), and discovers Synthetix accounts for the address. If the venue reports the wallet ineligible or the check fails, Neon disables deposits and new trades; an existing account can still request withdrawals.
2. Enter an amount and wrap ETH into WETH, then deposit WETH to Synthetix. Both are onchain transactions with gas fees. The first deposit creates a Synthetix account. The WETH approval is for the exact amount, not unlimited.
3. Inspect the live market and account. Choose long or short, market or limit, ETH size and leverage. Neon shows a rough notional and initial margin estimate; the venue makes the final margin, fee and liquidation calculations.
4. Review the real-money confirmation. Set leverage and place the order with separate wallet signatures. The venue response may mean accepted but not yet filled; refresh positions and orders to confirm state.
5. Close a position with a reduce-only market order or cancel an open order. To exit, request a WETH withdrawal to the connected wallet, subject to Synthetix margin checks and fees, then unwrap WETH to ETH. Confirm account and chain state before assuming completion.

Do not transfer ETH directly to the Synthetix deposit contract. Neon first wraps ETH, then calls the documented WETH deposit method. The destination of a WETH withdrawal is set to the connected wallet in this interface.

## Current verification boundary

The live public market API and contract bytecode were read. A disposable Ethereum fork completed wrap, unwrap, WETH approval and a 1 WETH deposit to the documented contract. The client order payload is checked with EIP-712 signature recovery. A disposable, unfunded wallet's signed account read reached Synthetix authentication and was correctly rejected for lack of ownership, confirming the signature envelope was parsed.

No funded account, live fill, real withdrawal, or liquidation path has been tested. Synthetix's [environment page](https://developers.synthetix.io/environments) currently lists only Mainnet for its trading API and says testnet is in development, although its deposit guide lists a Sepolia deposit contract. A Sepolia contract alone cannot validate an end-to-end trade without a working test API and matching engine. The Mainnet venue is a third-party dependency; current contract and market state can change.

The original Bob and Alice testnet in [testnet.md](testnet.md) exercises the older spot app. It does not test the Synthetix perpetual.

## Security boundaries

Neon has no collateral vault, operator withdrawal key or discretionary order matching. It forwards only allowlisted ETH-market actions with a 32 KB request limit. The WETH approval is exact and the contract address is fixed in source. Users still trust the served frontend code, wallet, Synthetix API and contracts, matching service, oracle and governance. A source update could change future behavior. There is no independent audit of this integration and no guarantee that the venue or another dependency cannot lose or freeze funds.

The Synthetix [exchange terms](https://synthetix.io/exchange-terms) govern access to that service and describe leveraged trading, jurisdiction and service restrictions. Neon has not made an eligibility determination for any user or jurisdiction.
