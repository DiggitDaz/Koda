# Koda

> **The world's first non-custodial recurring payment engine built on blockchain.**

---

## 🎬 Demo

[![Watch the Demo](https://img.shields.io/badge/▶_Watch_Demo-Click_Here-red?style=for-the-badge)](https://youtu.be/8C8Um6b_FHI)

---

## What is Koda?

Koda enables cryptocurrency holders to pay real-world recurring subscriptions — Netflix, Spotify, utilities, SaaS — automatically and directly from their own wallets, without ever giving up custody of their funds.

A user approves Koda's smart contract **once**. From that point forward, the contract automatically pulls the exact payment amount on schedule, and our backend funds a virtual card that the merchant charges like any ordinary payment. **The merchant receives fiat. The user spends crypto. Neither side experiences friction.**

The key word is *non-custodial*. Koda never holds user funds. Users can cancel, pause, or adjust at any time. The smart contract can only pull pre-agreed amounts on pre-agreed schedules — nothing more.

---

## The Problem

The subscription economy is worth over $275 billion globally, yet there is no production-grade solution for paying recurring bills with on-chain assets in a non-custodial manner.

Existing crypto payment tools either:
- Require users to hand custody of their funds to a third party, or
- Support only manual, one-off transactions — not automated recurring payments

Koda solves this with a smart contract–driven *timed allowance* architecture, where users grant scoped, revocable spending authority to a payment contract that can only execute pre-agreed amounts on pre-agreed schedules.

---

## How It Works

```
User approves USDC/USDK allowance on SubscriptionManager contract
         ↓
Subscription is created on-chain (amount + interval + duration)
         ↓
On payment date → contract pulls exact amount from user wallet
         ↓
Backend converts to fiat → funds virtual Visa card
         ↓
Merchant charges card → payment complete
```

Users retain full control at all stages. Koda's contract cannot exceed the approved allowance, and users can revoke access at any time directly from their wallet.

---

## Repository Structure

```
koda/
├── hydrix-token-contracts/
│   ├── THX.sol                  # Hydrix testnet token (tHX) — used for testnet gas and ecosystem testing
│   └── USDH.sol                 # Hydrix USD stablecoin — USD-pegged token for the Hydrix chain environment
│
├── subscription_manager.sol     # Core Koda contract — handles subscription creation, scheduling, and automated payment pulls
└── USDK.sol                     # Koda payment stablecoin — custom USD-pegged token with temporary restriction mechanism for card payment processing
```

---

## Smart Contracts

### `subscription_manager.sol`
The heart of Koda. This contract manages the full lifecycle of a subscription:
- Users create subscriptions by specifying an amount, interval, and number of payments
- The contract enforces that only the pre-approved amount can be pulled, and only when a payment is due
- Subscriptions can be paused or cancelled by the user at any time
- A 1.5% service fee is collected at the time of each payment pull

### `USDK.sol`
A custom USD-pegged stablecoin built specifically for Koda's payment flow. The key innovation is a **temporary restriction mechanism** that solves a critical race condition in card payment processing:

1. User taps card → backend detects card authorisation
2. USDK contract temporarily restricts the user's wallet (max 60 seconds)
3. During restriction: funds cannot be moved elsewhere
4. Backend pulls exact payment amount via `processCardPayment()`
5. Restriction is immediately lifted — user regains full control

This prevents double-spend scenarios without requiring custodial control of user funds. Standard stablecoins (USDC, USDT) do not expose a commercial API for temporary freezing — so USDK was built to fill that gap.

### `USDH.sol` *(in `/hydrix-token-contracts`)*
A USD-pegged stablecoin deployed on the Hydrix custom chain. Features full ERC-20 compliance, role-based minting and burning, a blacklist mechanism for compliance, and an emergency pause function. Used within the Hydrix ecosystem and testnet environment.

### `THX.sol` *(in `/hydrix-token-contracts`)*
The Hydrix testnet token (tHX). Used for gas payments and ecosystem testing on the Hydrix chain. Allows users to interact with all Hydrix contracts on testnet without using real funds.

---

## Tech Stack

- **Smart Contracts:** Solidity 0.8.20, OpenZeppelin
- **Networks:** EVM-compatible (Avalanche C-Chain, deployable to any EVM chain)
- **Frontend:** React
- **Backend:** Node.js
- **Card Issuance:** Stripe Issuing (virtual Visa cards)
- **Wallet Support:** MetaMask, WalletConnect, Trust Wallet, Coinbase Wallet

---

## Security

- Non-custodial by design — Koda never holds user funds
- Allowance-scoped pulls — contract can only pull pre-approved amounts
- Reentrancy protection on all payment functions
- Role-based access control for administrative functions
- Emergency pause on all token contracts
- USDK temporary restriction auto-expires (max 60 seconds) — cannot be permanently locked

---

## Status

Koda is currently pre-launch with a waitlist of **26,000+ users** acquired with zero marketing spend.

Active development areas:
- Production infrastructure integration (fiat conversion, card issuance)
- Regulatory compliance framework
- Mainnet deployment

---

## Contact

**Darren Wycherley** — Founder  
📧 contact@hydrix.me

---

## License

MIT
