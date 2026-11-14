# Contributing to Neon

[Back to Neon](README.md) · [Development guide](docs/development.md)

## Propose a focused change

Use an issue for an ordinary bug or proposed improvement, then keep a pull request focused on that behavior. Describe the problem, resulting behavior, and validation performed. Neon is released under the MIT license. Preserve the license and third party notices.

## Work locally

Follow the [setup instructions](README.md#interactive-local-testnet). Use disposable funds through `pnpm testnet` when developing wallet behavior. Never use a real wallet key in tests or commit a key, session capability, or private RPC credential.

Edit wallet and protocol code under `src/`. The HTML, CSS, simulator app, and matching engine under `dist/` are authored source. Rebuild `dist/wallet.bundle.js` with `pnpm build` when its source changes; avoid editing the generated bundle by hand.

## Verify a change

For application changes, run:

```sh
pnpm test
pnpm check
pnpm build
git diff --exit-code -- dist/wallet.bundle.js
pnpm audit
```

The bundle comparison should be clean after the intended regenerated bundle has been staged or committed. Before that, review the expected bundle diff instead of treating it as a failure. Changes to settlement, signatures, network guards, or the API also need `pnpm test:fork` and `pnpm test:orders`.

For documentation changes, check file links, heading anchors, exact UI labels, and commands against the implementation. Preserve the distinction among the simulator, local fork, mainnet read checks, and real mainnet transactions. Do not turn a skipped test into a passed result.

`pnpm check:mainnet` is read only but refreshes a tracked evidence file. Commit a new evidence snapshot only when intentionally updating the validation record. Keep historical snapshots identifiable by their timestamps.

## Security reports

Do not put active exploit details, secrets, or unpublished signed orders in a public issue. If the repository's **Security** tab provides a private **Report a vulnerability** option, use it. Otherwise ask the maintainer to arrange a private channel without including sensitive details. This repository does not promise a response deadline, bug bounty, or independent audit.
