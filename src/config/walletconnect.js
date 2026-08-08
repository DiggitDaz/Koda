// src/config/walletconnect.js
import { UniversalConnector } from '@reown/appkit-universal-connector'

export const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "efa30c3844cd88e18ca201425e9b266a"

if (!projectId) {
    throw new Error('WalletConnect Project ID is not defined')
}

// Arc Testnet config
const arcTestnet = {
    id: 5042002,
    chainNamespace: 'eip155',
    caipNetworkId: 'eip155:5042002',
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } }
}

export const networks = [arcTestnet]

export async function getUniversalConnector() {
    const universalConnector = await UniversalConnector.init({
        projectId,
        metadata: {
            name: 'Koda',
            description: 'Spend USDC from self-custody',
            url: 'https://kodafi.xyz',
            icons: ['https://kodafi.xyz/logo.png'],
            redirect: {
                universal: 'https://kodafi.xyz',
                native: '',
            },
        },
        networks: [
            {
                methods: [
                    'eth_sendTransaction',
                    'personal_sign',
                    'eth_sign',
                    'eth_signTransaction',
                    'eth_signTypedData',
                ],
                chains: [arcTestnet],
                events: ['chainChanged', 'accountsChanged'],
                namespace: 'eip155',
                rpcMap: {
                    '5042002': 'https://rpc.testnet.arc.network',
                },
            }
        ]
    })

    return universalConnector
}