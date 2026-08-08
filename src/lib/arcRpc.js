import { ethers } from 'ethers';

export const ARC_RPC_PRIMARY = 'https://rpc.testnet.arc.network';

// In production, MetaMask's internal RPC calls (eth_gasPrice etc.) go through
// our Netlify proxy, which fans out across all 3 Arc RPCs and returns the first
// non-rate-limited response. In dev, point directly at blockdaemon.
export const ARC_RPC_PROXY = import.meta.env.DEV
    ? 'https://rpc.blockdaemon.testnet.arc.network'
    : `${window.location.origin}/.netlify/functions/rpc`;

// In dev, rpc.testnet.arc.network blocks CORS from localhost — use blockdaemon first.
const RPCS = import.meta.env.DEV
    ? [
        'https://rpc.blockdaemon.testnet.arc.network',
        'https://rpc.drpc.testnet.arc.network',
        'https://rpc.testnet.arc.network',
    ]
    : [
        'https://rpc.testnet.arc.network',
        'https://rpc.blockdaemon.testnet.arc.network',
        'https://rpc.drpc.testnet.arc.network',
    ];

const _providers = RPCS.map(url => new ethers.JsonRpcProvider(url));

// Primary provider for ethers.Contract instantiation (has .send())
export const arcProvider = _providers[0];

// Sequential fallback for raw eth_call — tries each RPC until one succeeds.
// Use this instead of arcProvider.send() everywhere.
export async function arcSend(method, params) {
    let lastErr;
    for (const p of _providers) {
        try { return await p.send(method, params); }
        catch (err) { lastErr = err; }
    }
    throw lastErr;
}
