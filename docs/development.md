# Development and deployment

[Back to Neon](../README.md) · [Troubleshooting](troubleshooting.md)

## Prerequisites and setup

Use Git, Node.js 24.19.0, and pnpm 11.19.0 to reproduce the release. Install from the [Node.js download page](https://nodejs.org/en/download) and follow the [pnpm installation reference](https://pnpm.io/installation) if a package manager is not available. The repository pins pnpm; avoid an unversioned upgrade while reproducing a release.

Follow the [clone and install commands](../README.md#interactive-local-testnet). Run all commands below from the repository root. The lockfile and `pnpm-workspace.yaml` are part of the build: keep the package overrides and build permissions intact.

## Commands

| Command | Purpose | Network and output |
| --- | --- | --- |
| `pnpm testnet` | Build and run the disposable browser lab | Reads mainnet state, executes only locally; port 4319 |
| `pnpm build:lab` | Build the test profile without starting a server | Writes ignored `.lab/` artifacts |
| `pnpm start` | Serve the mainnet interface locally | Port 4318; real wallet required for actual trades |
| `pnpm test` | Run the offline suite | 23 tests at the recorded release |
| `pnpm check` | Check authored simulator JavaScript syntax | No network |
| `pnpm test:fork` | Exercise ETH / USDT swaps against copied contracts | Reads Ethereum; submits only inside Ganache |
| `pnpm test:orders` | Exercise 0x orders, API, cancellation, expiry, and reorg recovery | Reads Ethereum; submits only inside Ganache |
| `pnpm check:mainnet` | Verify live contracts, signing hash, and both quote directions | Read only; rewrites `validation/mainnet-readiness.json` |
| `pnpm build` | Build the public wallet bundle and Worker | Updates tracked browser bundle plus ignored Worker artifacts |
| `pnpm audit --prod` | Check known production dependency advisories | Queries the package advisory service |
| `pnpm package:release` | Package the clean committed source with its commit/tree manifest and checksums | Requires Git; writes ignored `release-artifacts/` |
| `pnpm test:consumer` | Verify and extract that ZIP into a fresh directory, install, build and test | Requires Python 3.12+; writes ignored `consumer-output/` |

For a local mainnet preview:

```sh
pnpm build
pnpm start
```

Open `http://127.0.0.1:4318/`. This is a local website connected to **Ethereum Mainnet**, not a testnet. Its local order database is separate from the published site's database. Stop the server with **Ctrl+C**.

## Storage and configuration

| Item | Behavior |
| --- | --- |
| Local mainnet database | `.local/neon.db`, persists across restarts |
| Browser lab database | In memory, reset on server restart |
| Published database | Sites managed D1 binding named `DB` |
| Optional `ETHEREUM_RPC_URL` | Server reads, fork source, and command line checks |
| Default RPC | `https://ethereum-rpc.publicnode.com` |
| Browser wallet RPC | Provided by the user's wallet; separate from the server setting |

Provide `ETHEREUM_RPC_URL` through the process environment or the hosting provider's protected environment settings. The scripts do **not** automatically load a `.env` file. No API key is required for the default endpoint. Never commit credential-bearing URLs or put a private RPC credential in browser assets.

The lab is restricted to `http://127.0.0.1:4319` and the mainnet preview binds to `127.0.0.1:4318`. Changing ports or exposing the lab to other machines is not a supported configuration switch.

## Repository layout

| Path | Role |
| --- | --- |
| `dist/index.html`, `dist/style.css`, `dist/app.js`, `dist/engine.js` | Authored UI and simulator source, intentionally tracked |
| `dist/wallet.bundle.js` | Generated public browser bundle, tracked for reproducibility |
| `src/wallet.js`, `src/settlement.js` | Wallet state and Uniswap transaction construction |
| `src/orders.js`, `src/orders-ui.js` | Signed 0x orders and shared book UI |
| `src/order-api.js`, `src/readiness.js` | Storage API and live infrastructure checks |
| `src/worker.js` | Published Worker entrypoint |
| `src/lab-*.js`, `scripts/lab-server.mjs` | Disposable test wallet and fork server |
| `scripts/build-*.mjs`, `build.mjs` | Separate public and test builds |
| `drizzle/` | Database schema and migration journal |
| `tests/` | Offline and contract fork suites |
| `validation/` | Dated public evidence snapshots |
| `docs/` | Guides and historical validation notes |

Do not remove `dist/` as generic build clutter: most of its files are authored source. Generated `.build/`, `.lab/`, `.local/`, `dist/server/`, `dist/.openai/`, and dependencies are ignored by Git.

## Published runtime

This repository's deployment targets Sites, using a Worker and D1. A static file host alone cannot run the shared order API. `pnpm build` creates `dist/server/index.js` and copies the hosting configuration and migrations into `dist/.openai/`; it does not publish anything.

`.openai/hosting.json` identifies the existing Neon Sites project. Repository access does not grant permission to deploy to that project. An independent copy must use its own authorized Sites project and database binding rather than reusing Neon's project identifier.

For an authorized release to the existing project:

1. Install from the lockfile, run the relevant checks, and build.
2. Review generated browser changes, commit the exact source, and push to GitHub and the configured Sites source repository.
3. Package the built Worker and assets using the Sites hosting workflow. Include the D1 migration artifacts.
4. Save a Sites version referencing the full pushed commit SHA, then deploy that saved version.
5. Confirm deployment success, check the hosted UI and APIs, and compare served application assets with the tested build.

Publishing GitHub changes alone does not deploy the website. Documentation changes can have a newer GitHub commit than the running app when application assets are unchanged.

## Readiness and service limits

| Endpoint | Meaning |
| --- | --- |
| [Health](https://neon.alx21.chatgpt.site/api/health) | Storage responds; this alone is not Ethereum readiness |
| [Readiness](https://neon.alx21.chatgpt.site/api/readiness) | Recent Ethereum block, expected token/router identity, and zero 0x fee requirement; failure returns HTTP 503 |
| [Order book](https://neon.alx21.chatgpt.site/api/orders) | Public signed order availability and indexed receipt history |

Bodies are limited to 8 KiB. The API allows 60 requests per minute per request IP, up to 20 cached active orders per maker, and 10,000 total unexpired stored orders. Receipt candidates and order pages are bounded. See [book behavior](trading.md#history-and-book-behavior) for visible pagination and history limits.

CI checks offline tests, browser build reproduction, all dependency advisories, both contract-fork suites, the read-only mainnet check and a fresh source-ZIP consumer on Windows and Linux. Main branch publication uses the exact checked commit and verified asset digests; an existing published version is left unchanged. No CI step signs or broadcasts a real mainnet transaction. `NEON_READINESS_OUTPUT` can select a separate existing output directory for the read-only check; CI uses it to preserve the committed historical snapshot.

## Upgrade and recovery

For a new local lab release, stop the existing process with **Ctrl+C**, extract the new source into a separate directory, install its frozen lockfile and follow the same walkthrough. Lab balances and orders deliberately reset; `.lab/` is a test record, not a wallet backup. Reload both tabs after a restart because their participant addresses belong to the old session.

For the local mainnet preview, stop the server before copying `.local/neon.db` into a private backup location. Keep that database with the old source directory when preparing an upgrade. If the new preview fails, stop it and restart the old version with its original database. Do not copy a test lab database into the mainnet preview. Disconnecting, clearing a browser or restoring the local book does not cancel an onchain order or revoke a token allowance; those actions must be confirmed through the connected wallet.

Independent developers can add adapters or trading UI using the MIT source and existing tests. Keep disposable signing code confined to the lab build, preserve the fixed chain checks and use fresh copied-contract fixtures before changing settlement behavior. Report failures through the [contribution guide](../CONTRIBUTING.md) with the release, command, Node/browser version and observed error; leave out private keys and credential-bearing RPC URLs.
