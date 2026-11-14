# Changelog

## 1.0.2

- Return safe validation responses for invalid order and receipt requests, while keeping internal storage and Ethereum provider errors out of client responses.
- Keep Ethereum RPC integration checks available by explicit manual CI opt-in; routine pull-request and main-branch checks run without a live provider.
- Preserve the existing wallet and database schema while packaging the corrected Worker source.

## 1.0.1

- Harden release publishing by reading each artifact through one stable file handle, rejecting symbolic links and non-regular files, bounding size, and detecting changes during the read.
- Refresh the stable source package and installation instructions for the corrected publishing path.

## 1.0.0

- Publish a versioned source ZIP, source manifest and SHA-256 checksums with a fresh installation check on Windows and Linux.
- Provide the documented Alice and Bob local contract-fork workflow, signed limit orders, instant swaps, cancellation and reset instructions.
- Update the build tool and WebSocket dependency, preserve separate public and disposable-wallet builds, and grant the MIT license.
- Retain the existing mainnet application. Contract-fork tests and read-only mainnet checks do not claim a real-money transaction or an independent security audit.
