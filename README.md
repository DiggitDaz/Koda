# Koda

Koda lets you spend USDC directly from a self-custody wallet using a virtual Visa card. No custodian, no wrapped stablecoin sitting in someone else's account — your keys, your balance, your card.

Built on Arc Testnet (Circle's USDC-native chain) and submitted to the Arc Hackathon.

**Live soon at [kodafi.xyz](https://kodafi.xyz)**

---

## What it does

You connect your wallet, wrap USDC into TAPUSDC (1:1, always redeemable), and get a Koda virtual Visa card. When you use the card, the payment processor checks your on-chain TAPUSDC balance in real time and either approves or declines the Stripe authorisation. If approved, TAPUSDC moves from your wallet to the settlement address on-chain — all within the same transaction. No overnight settlement, no custodial risk.

A debit card tap is just an event. Listen to it. Prove it happened. Settle it on-chain. The raw Stripe authorisation ID is embedded as `bytes32` in each transaction, creating permanent, publicly verifiable proof linking on-chain transfers to processor-authorised card payments.

---

## Security architecture

TAPUSDC incorporates reentrancy guards, role-based access controls, and a 48-hour timelock on role revocations. Card settlements use auto-expiring temporary balance restrictions — a compromised processor key can delay a payment for up to 5 minutes, but cannot mint, burn, or touch admin functions. The wrapper contract includes a timelocked emergency rescue mechanism that can only withdraw surplus USDC above the total TAPUSDC supply.

---

## Stack

**Frontend** — React 19 + Vite, styled-components, ethers.js v6, WalletConnect via Reown

**Backend** — Two Node/Express servers:
- Port 7001 — auth (JWT), user accounts, card/wallet linking
- Port 7000 — Stripe Issuing, card creation, payment simulation, on-chain settlement

**Chain** — Arc Testnet

**Bridge** — Circle CCTP V2 (Base Sepolia → Arc Testnet) with Iris attestation API

**Contracts**
- TAPUSDC: `0x69053637FF706bD2691ABCEbc9D36E61445343Cf`
- TAPUSDCWrapper: `0xee6E98d6Da6B5FaeD46FEBD5b920cdB7e1896564`
- USDC (Arc precompile): `0x3600000000000000000000000000000000000000`

**Third party** — Stripe Issuing (card rails), Circle (USDC + Arc), TRM Labs (wallet screening), SumSub (KYC, planned)

---

## Running locally

**Prerequisites:** Node 18+, a browser wallet (MetaMask or similar), Arc Testnet added to your wallet.

```bash
git clone https://github.com/DiggitDaz/Koda.git
cd Koda
npm install
cp .env.example .env
```

Edit `.env` and add your WalletConnect project ID (free at [cloud.reown.com](https://cloud.reown.com)):

```
VITE_WALLETCONNECT_PROJECT_ID=your_id_here
```

```bash
npm run dev
```

The app runs at `http://localhost:5173`. It connects to the hosted backend at `chainfree.site` — you don't need to run the backend yourself to use the frontend.

---

## Testing

This runs against Stripe Sandbox and Arc Testnet — no real money involved. The signup page makes this clear and asks you to confirm before proceeding.

To go through the full flow:
1. Sign up with fictitious details
2. Connect a wallet (MetaMask, WalletConnect, etc.)
3. Get test USDC from the Arc faucet
4. Wrap USDC → TAPUSDC on the dashboard
5. Create your Koda card (Stripe Sandbox issues a real test card)
6. Activate the card and grant processor approval
7. Buy something from Bolt & Board — the demo hardware store built into the app

The store triggers a real Stripe Issuing authorisation. The backend checks your on-chain TAPUSDC balance, approves it, then calls `processCardPayment` on-chain. You can see the transaction on [Arc Testnet explorer](https://testnet.arcscan.app).

---

## What's not done yet

- Subscription manager contract isn't deployed on Arc Testnet yet (UI is there, contract address is pending)
- KYC flow (SumSub) is scaffolded but disabled — SDK renewal needed
- EIP-2612 permit on TAPUSDC would make approvals gasless but requires a contract upgrade
- Production deployment needs Stripe approval for live Issuing and independent smart contract audits

---

## The bigger picture

The vision extends beyond cards. Koda is a settlement layer applicable to any payment event — QR codes, open banking, or other rails — where real-time on-chain proof and self-custody settlement matter.

---

## Licence

MIT
