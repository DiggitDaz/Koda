import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { ethers } from 'ethers';
import axios from 'axios';
import { AlertTriangle, Link2, Wallet, X } from 'lucide-react';
import { getUniversalConnector } from '../config/walletconnect.js';
import { useAuth } from './AuthContext.js';
import { arcProvider, arcSend } from '../lib/arcRpc.js';

const WalletContext = createContext(null);

// Set to true while BridgeComponent is switching chains — prevents reload mid-flow
let suppressChainReload = false;
export const setSuppressChainReload = (val) => { suppressChainReload = val; };

const USDC_ADDR    = '0x3600000000000000000000000000000000000000';
const TAPUSDC_ADDR = '0xCb96C70be34cd6484e69D1BEd5ad2F22602191e3';
const EURC_ADDR    = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';
const TAPEURC_ADDR = '0x36247A653A1253A96a286f5E296c06fF958b1ac0';
const ERC20_ABI    = ['function balanceOf(address) view returns (uint256)'];
const API_BASE     = import.meta.env.VITE_AUTH_URL;
const STORAGE_KEY    = 'koda_wallet_type';
const RDNS_KEY       = 'koda_wallet_rdns';
const METAMASK_RDNS  = 'io.metamask';

// Discover all EIP-6963 wallets announced by browser extensions.
// Returns an array of { info: { name, icon, uuid, rdns }, provider } objects.
const discoverEIP6963Providers = () => new Promise(resolve => {
    const found = [];
    const handler = (e) => found.push(e.detail);
    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    setTimeout(() => {
        window.removeEventListener('eip6963:announceProvider', handler);
        resolve(found);
    }, 200);
});

const usdcContract    = new ethers.Contract(USDC_ADDR,    ERC20_ABI, arcProvider);
const tapusdcContract = new ethers.Contract(TAPUSDC_ADDR, ERC20_ABI, arcProvider);
const eurcContract    = new ethers.Contract(EURC_ADDR,    ERC20_ABI, arcProvider);
const tapeurcContract = new ethers.Contract(TAPEURC_ADDR, ERC20_ABI, arcProvider);

// Outside component — no dependency concerns
const extractAddress = (sess) => {
    if (!sess) return null;
    try {
        const accounts = Object.values(sess.namespaces).flatMap(ns => ns.accounts || []);
        return accounts[0]?.split(':').pop() || null;
    } catch { return null; }
};

const injectedAvailable = () => typeof window !== 'undefined' && !!window.ethereum;

export const WalletProvider = ({ children }) => {
    const { user } = useAuth();

    const wcRef       = useRef(null);   // UniversalConnector — initialised once
    const screenedRef = useRef(null);
    const addressRef  = useRef(null);   // stable ref for event listener closures

    const [connector,       setConnector]       = useState(null); // { provider: EIP1193 }
    const [address,         setAddress]         = useState(null);
    const [walletType,      setWalletType]      = useState(null); // 'injected' | 'walletconnect'
    const [connecting,      setConnecting]      = useState(false);
    const [showPicker,           setShowPicker]           = useState(false);
    const [discoveredProviders,  setDiscoveredProviders]  = useState([]);
    const [showUnsupportedModal, setShowUnsupportedModal] = useState(false);
    const [unsupportedWalletName, setUnsupportedWalletName] = useState('');
    const [balances,          setBalances]          = useState({ USDC: '0', TAPUSDC: '0', EURC: '0', TAPEURC: '0' });
    const [balancesLoading, setBalancesLoading] = useState(false);
    const [screeningStatus, setScreeningStatus] = useState(null);

    // Keep addressRef in sync so event listeners never see stale value
    useEffect(() => { addressRef.current = address; }, [address]);

    // Track EIP-6963 wallet announcements from page load so the picker has
    // accurate data before the user ever clicks Connect. MetaMask announces
    // on DOMContentLoaded but doesn't always re-announce on a late request,
    // so we need to be listening from the start, not on-demand.
    useEffect(() => {
        const seen = new Map();
        const handler = (e) => {
            const d = e.detail;
            if (!seen.has(d.info.uuid)) {
                seen.set(d.info.uuid, d);
                setDiscoveredProviders(Array.from(seen.values()));
            }
        };
        window.addEventListener('eip6963:announceProvider', handler);
        window.dispatchEvent(new Event('eip6963:requestProvider'));
        return () => window.removeEventListener('eip6963:announceProvider', handler);
    }, []);

    // clear all wallet state
    const clearWalletState = useCallback(() => {
        setConnector(null);
        setAddress(null);
        setWalletType(null);
        setBalances({ USDC: '0', TAPUSDC: '0', EURC: '0', TAPEURC: '0' });
        setScreeningStatus(null);
        screenedRef.current = null;
        addressRef.current  = null;
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(RDNS_KEY);
    }, []); // only calls stable setters + mutates refs

    // init WC connector + restore any saved session
    useEffect(() => {
        const init = async () => {
            const uc = await getUniversalConnector();
            wcRef.current = uc;

            const saved = localStorage.getItem(STORAGE_KEY);

            // Restore injected session silently — no prompt
            if (saved === 'injected') {
                const savedRdns = localStorage.getItem(RDNS_KEY);
                if (savedRdns) {
                    // Try to restore the exact wallet via EIP-6963
                    const found = await discoverEIP6963Providers();
                    const match = found.find(d => d.info.rdns === savedRdns);
                    if (match) {
                        try {
                            const accounts = await match.provider.request({ method: 'eth_accounts' });
                            if (accounts[0]) {
                                setConnector({ provider: match.provider });
                                setAddress(accounts[0]);
                                setWalletType('injected');
                                return;
                            }
                        } catch {}
                    }
                }
                // Fallback: use window.ethereum (original behaviour)
                if (injectedAvailable()) {
                    try {
                        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                        if (accounts[0]) {
                            setConnector({ provider: window.ethereum });
                            setAddress(accounts[0]);
                            setWalletType('injected');
                            return;
                        }
                    } catch {}
                }
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem(RDNS_KEY);
            }

            // Restore WalletConnect session
            if (saved === 'walletconnect' && uc.provider?.session) {
                const addr = extractAddress(uc.provider.session);
                if (addr) {
                    setConnector({ provider: uc.provider });
                    setAddress(addr);
                    setWalletType('walletconnect');
                    return;
                }
                localStorage.removeItem(STORAGE_KEY);
            }
        };

        init().catch(console.error);
    }, []);

    // injected wallet event listeners — use connector.provider so EIP-6963
    // wallets (Rainbow, Rabby etc) get their own provider's events, not MetaMask's
    useEffect(() => {
        const provider = connector?.provider;
        if (!provider || walletType !== 'injected') return;

        const onAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                clearWalletState();
            } else if (accounts[0] !== addressRef.current) {
                screenedRef.current = null;
                setAddress(accounts[0]);
            }
        };

        const onChainChanged = () => { if (!suppressChainReload) window.location.reload(); };

        provider.on('accountsChanged', onAccountsChanged);
        provider.on('chainChanged', onChainChanged);

        return () => {
            provider.removeListener('accountsChanged', onAccountsChanged);
            provider.removeListener('chainChanged', onChainChanged);
        };
    }, [walletType, connector, clearWalletState]);

    // balances
    const fetchBalances = useCallback(async (addr) => {
        const target = addr || address;
        if (!target) return;
        setBalancesLoading(true);

        const rawCall = async (contractAddr, iface, retries = 3) => {
            const data = iface.encodeFunctionData('balanceOf', [target]);
            for (let i = 0; i < retries; i++) {
                try {
                    const result = await arcSend('eth_call', [
                        { to: contractAddr, data },
                        'latest',
                    ]);
                    if (result && result !== '0x') {
                        return iface.decodeFunctionResult('balanceOf', result)[0];
                    }
                    return null;
                } catch (err) {
                    if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                    else console.warn('[Balances] failed after retries:', contractAddr, err.code);
                }
            }
            return null;
        };

        const [uBal, tBal, eBal, teBal] = await Promise.all([
            rawCall(USDC_ADDR,    usdcContract.interface),
            rawCall(TAPUSDC_ADDR, tapusdcContract.interface),
            rawCall(EURC_ADDR,    eurcContract.interface),
            rawCall(TAPEURC_ADDR, tapeurcContract.interface),
        ]);

        setBalances({
            USDC:    uBal   != null ? ethers.formatUnits(uBal,   6) : '0',
            TAPUSDC: tBal   != null ? ethers.formatUnits(tBal,   6) : '0',
            EURC:    eBal   != null ? ethers.formatUnits(eBal,   6) : '0',
            TAPEURC: teBal  != null ? ethers.formatUnits(teBal,  6) : '0',
        });
        setBalancesLoading(false);
    }, [address]);

    // screening
    const screenWallet = useCallback(async (addr) => {
        if (screenedRef.current === addr) return null;
        screenedRef.current = addr;  // block concurrent calls before first await
        setScreeningStatus('pending');
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/wallet/screen`, {
                wallet_address: addr,
            });
            const status = res.data.action ?? 'allowed';
            setScreeningStatus(status);
            screenedRef.current = addr;
            return status;
        } catch {
            setScreeningStatus('allowed');
            screenedRef.current = addr;
            return 'allowed';
        }
    }, []);

    const linkWallet = useCallback(async (addr) => {
        if (!user) return;
        axios.post(`${API_BASE}/user/link-wallet`, {
            wallet_address: addr,
            wallet_name: 'My Wallet',
        }).catch(() => {});
    }, [user]);

    // screen + fetch when address is set
    useEffect(() => {
        if (!address || screenedRef.current === address) return;
        screenWallet(address).then(status => {
            if (status === 'allowed') {
                fetchBalances(address);
                linkWallet(address);
            }
        });
    // fetchBalances and linkWallet intentionally omitted from deps — including them
    // causes the effect to re-fire when those callbacks recreate (on address/user change),
    // resulting in multiple concurrent screenings for the same address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, screenWallet]);

    // connect via a specific EIP-6963 provider (user picked from the list)
    const connectWithEIP6963Provider = useCallback(async (detail) => {
        setShowPicker(false);
        setConnecting(true);
        try {
            const accounts = await detail.provider.request({ method: 'eth_requestAccounts' });
            if (accounts[0]) {
                setConnector({ provider: detail.provider });
                setAddress(accounts[0]);
                setWalletType('injected');
                localStorage.setItem(STORAGE_KEY, 'injected');
                localStorage.setItem(RDNS_KEY, detail.info.rdns);
            }
        } catch (err) {
            console.error('EIP-6963 connect error:', err);
        } finally {
            setConnecting(false);
        }
    }, []);

    // connect via injected provider — fallback for wallets that don't support EIP-6963
    const connectInjected = useCallback(async () => {
        setShowPicker(false);
        setConnecting(true);
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (accounts[0]) {
                setConnector({ provider: window.ethereum });
                setAddress(accounts[0]);
                setWalletType('injected');
                localStorage.setItem(STORAGE_KEY, 'injected');
                localStorage.removeItem(RDNS_KEY);
            }
        } catch (err) {
            console.error('Injected connect error:', err);
        } finally {
            setConnecting(false);
        }
    }, []);

    // connect via WalletConnect
    const connectWalletConnect = useCallback(async () => {
        setShowPicker(false);
        const uc = wcRef.current;
        if (!uc) return;
        setConnecting(true);

        let settled = false;

        // On mobile the browser tab is backgrounded while the wallet app is open.
        // The WC relay WebSocket can drop during that time, so provider.connect()
        // may never resolve even after the user approves. When the page becomes
        // visible again we check directly whether a session was established.
        const handleVisibilityChange = async () => {
            if (document.visibilityState !== 'visible' || settled) return;
            await new Promise(r => setTimeout(r, 800));
            if (!settled && uc.provider?.session) {
                finalize(uc.provider.session);
            }
        };

        const finalize = async (session) => {
            if (settled) return;
            settled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);

            // Only allow MetaMask through WalletConnect
            const peerName = session.peer?.metadata?.name || '';
            if (!peerName.toLowerCase().includes('metamask')) {
                try { await uc.disconnect(); } catch {}
                setUnsupportedWalletName(peerName || 'This wallet');
                setShowUnsupportedModal(true);
                setConnecting(false);
                return;
            }

            const addr = extractAddress(session);
            if (addr) {
                setConnector({ provider: uc.provider });
                setAddress(addr);
                setWalletType('walletconnect');
                localStorage.setItem(STORAGE_KEY, 'walletconnect');
            }
            setConnecting(false);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        try {
            const { session: s } = await uc.connect();
            finalize(s);
        } catch (err) {
            if (!settled) {
                settled = true;
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                console.error('WalletConnect error:', err);
                setConnecting(false);
            }
        }
    }, []);

    // connect: open picker with already-tracked EIP-6963 providers (collected on mount),
    // or fall through to WalletConnect if no injected wallets detected at all.
    const connect = useCallback(() => {
        if (injectedAvailable() || discoveredProviders.length > 0) {
            setShowPicker(true);
        } else {
            connectWalletConnect();
        }
    }, [connectWalletConnect, discoveredProviders.length]);

    // disconnect
    const disconnect = useCallback(async () => {
        if (walletType === 'walletconnect' && wcRef.current) {
            try { await wcRef.current.disconnect(); } catch {}
        }
        // Injected wallets have no programmatic disconnect — just clear state
        clearWalletState();
    }, [walletType, clearWalletState]);

    const isConnected = !!address;

    return (
        <WalletContext.Provider value={{
            connector,
            address,
            isConnected,
            connecting,
            connect,
            disconnect,
            walletType,
            balances,
            balancesLoading,
            fetchBalances,
            screeningStatus,
            isScreening: screeningStatus === 'pending',
            isBlocked:   screeningStatus === 'blocked',
        }}>
            {children}
            {showPicker && (
                <WalletPickerModal
                    eip6963Providers={discoveredProviders}
                    onSelectEIP6963={connectWithEIP6963Provider}
                    onInjected={connectInjected}
                    onWalletConnect={connectWalletConnect}
                    onClose={() => setShowPicker(false)}
                />
            )}
            {showUnsupportedModal && (
                <UnsupportedWalletModal
                    walletName={unsupportedWalletName}
                    onClose={() => setShowUnsupportedModal(false)}
                />
            )}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error('useWallet must be used within WalletProvider');
    return ctx;
};

// Wallet picker modal — MetaMask only while Arc Testnet has limited wallet support

const WalletPickerModal = ({ eip6963Providers = [], onSelectEIP6963, onInjected, onWalletConnect, onClose }) => {
    const metaMaskProvider    = eip6963Providers.find(d => d.info.rdns === METAMASK_RDNS);
    const otherProviders      = eip6963Providers.filter(d => d.info.rdns !== METAMASK_RDNS);
    const showInjectedFallback = !metaMaskProvider &&
        typeof window !== 'undefined' && !!window.ethereum?.isMetaMask;

    return (
        <PickerOverlay onClick={e => e.target === e.currentTarget && onClose()}>
            <PickerCard>
                <PickerHeader>
                    <PickerTitle>Connect wallet</PickerTitle>
                    <PickerClose onClick={onClose}><X size={16} /></PickerClose>
                </PickerHeader>
                <PickerBody>
                    {/* ── MetaMask (primary) ── */}
                    {metaMaskProvider ? (
                        <PickerOption onClick={() => onSelectEIP6963(metaMaskProvider)}>
                            <PickerOptionIcon>
                                {metaMaskProvider.info.icon
                                    ? <img src={metaMaskProvider.info.icon} alt="MetaMask" style={{ width: 24, height: 24, borderRadius: 6, display: 'block' }} />
                                    : <Wallet size={20} />
                                }
                            </PickerOptionIcon>
                            <PickerOptionText>
                                <PickerOptionName>MetaMask</PickerOptionName>
                                <PickerOptionSub>Browser extension</PickerOptionSub>
                            </PickerOptionText>
                            <PickerChevron>›</PickerChevron>
                        </PickerOption>
                    ) : showInjectedFallback ? (
                        <PickerOption onClick={onInjected}>
                            <PickerOptionIcon>
                                <Wallet size={20} />
                            </PickerOptionIcon>
                            <PickerOptionText>
                                <PickerOptionName>MetaMask</PickerOptionName>
                                <PickerOptionSub>In-app browser</PickerOptionSub>
                            </PickerOptionText>
                            <PickerChevron>›</PickerChevron>
                        </PickerOption>
                    ) : (
                        <PickerOptionDisabled>
                            <PickerOptionIcon $muted>
                                <Wallet size={20} />
                            </PickerOptionIcon>
                            <PickerOptionText>
                                <PickerOptionName $muted>MetaMask not detected</PickerOptionName>
                                <PickerOptionSub>
                                    <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer"
                                       style={{ color: '#4F55F1', textDecoration: 'none' }}>
                                        Install MetaMask →
                                    </a>
                                </PickerOptionSub>
                            </PickerOptionText>
                        </PickerOptionDisabled>
                    )}

                    {/* ── MetaMask mobile via WalletConnect QR ── */}
                    <PickerOption onClick={onWalletConnect}>
                        <PickerOptionIcon $wc>
                            <Link2 size={20} />
                        </PickerOptionIcon>
                        <PickerOptionText>
                            <PickerOptionName>MetaMask mobile</PickerOptionName>
                            <PickerOptionSub>Scan QR code with the MetaMask app</PickerOptionSub>
                        </PickerOptionText>
                        <PickerChevron>›</PickerChevron>
                    </PickerOption>

                    {/* ── Other detected wallets — greyed out ── */}
                    {otherProviders.length > 0 && (
                        <>
                            <PickerDividerRow>
                                <PickerDividerLine />
                                <PickerDividerLabel>Arc Testnet support coming soon</PickerDividerLabel>
                                <PickerDividerLine />
                            </PickerDividerRow>
                            {otherProviders.map(detail => (
                                <PickerOptionDisabled key={detail.info.uuid}>
                                    <PickerOptionIcon $muted>
                                        {detail.info.icon
                                            ? <img src={detail.info.icon} alt={detail.info.name} style={{ width: 24, height: 24, borderRadius: 6, display: 'block', opacity: 0.45 }} />
                                            : <Wallet size={20} />
                                        }
                                    </PickerOptionIcon>
                                    <PickerOptionText>
                                        <PickerOptionName $muted>{detail.info.name}</PickerOptionName>
                                        <PickerOptionSub>Not yet supported on Arc Testnet</PickerOptionSub>
                                    </PickerOptionText>
                                    <PickerComingSoon>Soon</PickerComingSoon>
                                </PickerOptionDisabled>
                            ))}
                        </>
                    )}
                </PickerBody>
                <PickerFooter>
                    New to MetaMask? <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">Download it here</a>
                </PickerFooter>
            </PickerCard>
        </PickerOverlay>
    );
};

// Unsupported wallet modal — shown when a non-MetaMask wallet connects via WalletConnect

const UnsupportedWalletModal = ({ walletName, onClose }) => (
    <PickerOverlay onClick={e => e.target === e.currentTarget && onClose()}>
        <PickerCard>
            <PickerHeader>
                <PickerTitle>Wallet not supported</PickerTitle>
                <PickerClose onClick={onClose}><X size={16} /></PickerClose>
            </PickerHeader>
            <UnsupportedBody>
                <UnsupportedIconWrap>
                    <AlertTriangle size={28} />
                </UnsupportedIconWrap>
                <UnsupportedMessage>
                    <strong>{walletName}</strong> doesn't support Arc Testnet yet.
                </UnsupportedMessage>
                <UnsupportedSub>
                    Koda runs on Arc Testnet, which uses USDC as its gas token. This is an unusual
                    configuration that most wallets haven't added support for yet.
                </UnsupportedSub>
                <UnsupportedSub>
                    Please use <strong>MetaMask</strong> — either the browser extension or by scanning
                    the QR code with the MetaMask mobile app.
                </UnsupportedSub>
                <UnsupportedActions>
                    <UnsupportedPrimaryBtn
                        as="a"
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Get MetaMask
                    </UnsupportedPrimaryBtn>
                    <UnsupportedSecondaryBtn onClick={onClose}>
                        Try again
                    </UnsupportedSecondaryBtn>
                </UnsupportedActions>
            </UnsupportedBody>
        </PickerCard>
    </PickerOverlay>
);

// Picker styled components

const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const PickerOverlay = styled.div`
    position: fixed;
    inset: 0;
    background: #00000040;
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 600;

    @media (max-width: 768px) {
        align-items: flex-end;
        padding: 0;
    }
`;

const PickerCard = styled.div`
    width: 100%;
    max-width: 400px;
    background: linear-gradient(45deg, #000000ff 20%, #121212);
    border-radius: 20px;
    padding: 28px;
    box-shadow: 0 8px 40px rgba(9, 0, 34, 0.15);
    animation: ${fadeUp} 0.3s ease;
    font-family: 'Sora', sans-serif;

    @media (max-width: 768px) {
        border-radius: 24px 24px 0 0;
        max-width: 100%;
        padding: 24px 20px 32px;
    }
`;

const PickerHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
`;

const PickerTitle = styled.h3`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #fff;
    margin: 0;
`;

const PickerClose = styled.button`
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #8D969E30;
    border: none;
    color: #8D969E;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: opacity 0.15s;
    &:hover { opacity: 0.7; }
`;

const PickerBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const PickerOption = styled.button`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(9,0,34,0.06);
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.15s;
    &:hover { background: rgba(255,255,255,0.09); }
`;

const PickerOptionIcon = styled.div`
    width: 44px; height: 44px;
    border-radius: 12px;
    background: ${p => p.$wc ? 'rgba(79,85,241,0.12)' : 'rgba(255,255,255,0.06)'};
    color: ${p => p.$wc ? '#4F55F1' : '#8D969E'};
    display: grid; place-items: center;
    flex-shrink: 0;
`;

const PickerOptionText = styled.div`flex: 1; min-width: 0;`;

const PickerOptionName = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 3px;
`;

const PickerOptionSub = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
    margin: 0;
`;

const PickerChevron = styled.span`
    font-size: 18px;
    color: rgba(255,255,255,0.2);
    flex-shrink: 0;
    line-height: 1;
`;

const PickerFooter = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: #8D969E80;
    text-align: center;
    margin: 12px 0 0;
    line-height: 1.5;

    a {
        color: #8D969E;
        text-decoration: underline;
        &:hover { color: #fff; }
    }
`;

const PickerOptionDisabled = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: rgba(255,255,255,0.02);
    border: 1.5px solid rgba(9,0,34,0.04);
    border-radius: 14px;
    opacity: 0.45;
    cursor: not-allowed;
    user-select: none;
`;

const PickerDividerRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 4px 0 2px;
`;

const PickerDividerLine = styled.div`
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.07);
`;

const PickerDividerLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 10px;
    font-weight: 600;
    color: rgba(255,255,255,0.25);
    white-space: nowrap;
    letter-spacing: 0.3px;
    text-transform: uppercase;
`;

const PickerComingSoon = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.06);
    border-radius: 6px;
    padding: 3px 7px;
    flex-shrink: 0;
`;

// Unsupported wallet modal body

const UnsupportedBody = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 0 8px;
`;

const UnsupportedIconWrap = styled.div`
    width: 52px;
    height: 52px;
    border-radius: 14px;
    background: rgba(220, 80, 40, 0.12);
    color: #e05a30;
    display: grid;
    place-items: center;
    align-self: center;
`;

const UnsupportedMessage = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 500;
    color: #ffffff;
    margin: 0;
    text-align: center;
    line-height: 1.4;

    strong { font-weight: 700; }
`;

const UnsupportedSub = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
    margin: 0;
    line-height: 1.6;
    text-align: center;

    strong { color: rgba(255,255,255,0.8); font-weight: 600; }
`;

const UnsupportedActions = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 4px;
`;

const UnsupportedPrimaryBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 13px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.15s;
    &:hover { opacity: 0.85; }
`;

const UnsupportedSecondaryBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 12px;
    background: transparent;
    color: rgba(255,255,255,0.55);
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    &:hover { border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.8); }
`;
