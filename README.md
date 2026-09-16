# Beamio Consumer

Beamio Consumer is the self-custody application for direct relationships between customers and merchants. It brings merchant discovery, memberships, coupons, Store Credit, Reward PT, and USDC into one mobile-first experience built with CoNET infrastructure.

Beamio supports transactions without becoming the custodian, counterparty, or owner of the customer relationship. Wallet authorization stays on the customer device, while supported writes are submitted through gas-sponsored relays.

## Product experience

- **Self-custody wallet** — Manage an EOA Wallet and a CoNET Smart Wallet without sending private keys to Beamio.
- **USDC payments** — Send, receive, and request USDC through mobile-friendly payment, QR, and sharing flows.
- **Merchant discovery** — Find participating merchants and connect directly to their programs.
- **Memberships and coupons** — Join merchant programs, claim eligible coupons, and present assets for in-store use.
- **Store Credit** — Hold value issued by a specific merchant program.
- **Reward PT** — Earn rewards from purchases, referrals, sharing, and engagement, then use eligible PT under participating program rules.
- **Private messaging** — Communicate through encrypted CoNET messaging and recover supported chat history across devices.
- **CoNET participation** — View supported network, validator, referral, and reward experiences from the Bounty Board.

Store Credit remains specific to the issuing merchant. Reward PT is a separate asset and is only portable where participating program rules allow it. Any remaining payment amount may be settled in USDC.

## Trust and security model

- Wallet material is stored on the customer device and restored through the user's BeamioTag and access password.
- Mnemonics and signing keys are never stored in Local Storage or sent to application servers.
- Supported USDC and program actions use local authorization with sponsored submission.
- Merchant program ownership and customer assets remain distinct; Beamio does not pool them into a custodial balance.
- Remote data failures do not erase previously trusted local state.

## Application architecture

This repository contains the Consumer PWA served at [beamio.app/app](https://beamio.app/app/). It also runs inside the Beamio iOS and Android WebView shells.

The application uses:

- React 18 and TypeScript
- Create React App with CRACO
- CoNET L1 for consumer Smart Wallets, merchant programs, Reward PT, memberships, and application state
- Base for supported USDC wallet balances and settlement paths
- Ethers v6 for chain interaction and local signing
- PouchDB and IndexedDB for device-local wallet and trusted application data
- Dedicated workers for wallet feeds, BeamioTag and merchant-card data, and encrypted chat
- OpenPGP for CoNET messaging
- Local-first IPFS image storage

Chain reads are worker-managed, cached, deduplicated, and refreshed in the background. UI components consume trusted mirrors instead of issuing independent recurring RPC requests.

## Getting started

Requirements:

- Node.js 20 (`.nvmrc`)
- Yarn

Install dependencies and start the development server:

```bash
nvm use
yarn install
yarn start
```

Create a production build for `/app/`:

```bash
yarn build
```

Create the root-path build used by the native embedded package:

```bash
yarn build:embedded
```

Run the test suite:

```bash
yarn test
```

## Deployment

Production deployment must use the repository-level deployment script:

```bash
./scripts/deployBeamioPwa.sh
```

Run it from the `BeamioContract` repository root. The script bumps the patch version, updates the embedded OTA manifest, commits and pushes the version change, builds the PWA, publishes `/app/`, creates `SilentPassUI-<version>.zip`, and verifies the live OTA files.

Do not publish only the static `build/` directory. Native shells discover updates through:

- `https://beamio.app/app/update.json`
- `https://beamio.app/app/SilentPassUI-<version>.zip`

## Related applications

- [Beamio](https://beamio.app/) — Product overview
- [Beamio POS](https://pos.beamio.app/) — Authorized in-store terminal
- [Beamio Merchant OS](https://biz.beamio.app/) — Merchant program and operations control plane
- [Beamio whitepaper](https://gitbook.conet.network/applications/beamio.html) — Product model and trust boundaries
- [CoNET](https://conet.network/) — Underlying decentralized infrastructure

## License

Beamio Consumer is licensed under the MIT License. See [MIT_LICENSE](./MIT_LICENSE).
