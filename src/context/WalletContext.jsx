import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { ethers } from 'ethers';
import axios from 'axios';
import { Link2, Wallet, X } from 'lucide-react';
import { getUniversalConnector } from '../config/walletconnect.js';
import { useAuth } from './AuthContext.js';
import { arcProvider, arcSend } from '../lib/arcRpc.js';

const WalletContext = createContext(null);

// Set to true while BridgeComponent is switching chains — prevents reload mid-flow
let suppressChainReload = false;
export const setSuppressChainReload = (val) => { suppressChainReload = val; };

const USDC_ADDR    = '0x3600000000000000000000000000000000000000';
const TAPUSDC_ADDR = '0x69053637FF706bD2691ABCEbc9D36E61445343Cf';
const ERC20_ABI    = ['function balanceOf(address) view returns (uint256)'];
const API_BASE     = 'https://chainfree.site:7001';
const STORAGE_KEY  = 'koda_wallet_type';

const usdcContract    = new ethers.Contract(USDC_ADDR,    ERC20_ABI, arcProvider);
const tapusdcContract = new ethers.Contract(TAPUSDC_ADDR, ERC20_ABI, arcProvider);

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
    const [showPicker,      setShowPicker]      = useState(false);
    const [balances,        setBalances]        = useState({ USDC: '0', TAPUSDC: '0' });
    const [balancesLoading, setBalancesLoading] = useState(false);
    const [screeningStatus, setScreeningStatus] = useState(null);

    // Keep addressRef in sync so event listeners never see stale value
    useEffect(() => { addressRef.current = address; }, [address]);

    // clear all wallet state
    const clearWalletState = useCallback(() => {
        setConnector(null);
        setAddress(null);
        setWalletType(null);
        setBalances({ USDC: '0', TAPUSDC: '0' });
        setScreeningStatus(null);
        screenedRef.current = null;
        addressRef.current  = null;
        localStorage.removeItem(STORAGE_KEY);
    }, []); // only calls stable setters + mutates refs

    // init WC connector + restore any saved session
    useEffect(() => {
        const init = async () => {
            const uc = await getUniversalConnector();
            wcRef.current = uc;

            const saved = localStorage.getItem(STORAGE_KEY);

            // Restore injected session silently — no prompt
            if (saved === 'injected' && injectedAvailable()) {
                try {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts[0]) {
                        setConnector({ provider: window.ethereum });
                        setAddress(accounts[0]);
                        setWalletType('injected');
                        return;
                    }
                } catch {}
                localStorage.removeItem(STORAGE_KEY);
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

    // injected wallet event listeners
    useEffect(() => {
        if (!injectedAvailable() || walletType !== 'injected') return;

        const onAccountsChanged = (accounts) => {
            if (accounts.length === 0) {
                clearWalletState();
            } else if (accounts[0] !== addressRef.current) {
                screenedRef.current = null;
                setAddress(accounts[0]);
            }
        };

        const onChainChanged = () => { if (!suppressChainReload) window.location.reload(); };

        window.ethereum.on('accountsChanged', onAccountsChanged);
        window.ethereum.on('chainChanged', onChainChanged);

        return () => {
            window.ethereum.removeListener('accountsChanged', onAccountsChanged);
            window.ethereum.removeListener('chainChanged', onChainChanged);
        };
    }, [walletType, clearWalletState]);

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

        const [uBal, tBal] = await Promise.all([
            rawCall(USDC_ADDR,    usdcContract.interface),
            rawCall(TAPUSDC_ADDR, tapusdcContract.interface),
        ]);

        setBalances({
            USDC:    uBal != null ? ethers.formatUnits(uBal, 6) : '0',
            TAPUSDC: tBal != null ? ethers.formatUnits(tBal, 6) : '0',
        });
        setBalancesLoading(false);
    }, [address]);

    // screening
    const screenWallet = useCallback(async (addr) => {
        if (screenedRef.current === addr) return null;
        screenedRef.current = addr;  // block concurrent calls before first await
        setScreeningStatus('pending');
        try {
            const res = await axios.post('https://chainfree.site:7000/api/wallet/screen', {
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

    // connect via injected provider
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
        try {
            const { session: s } = await uc.connect();
            const addr = extractAddress(s);
            if (addr) {
                setConnector({ provider: uc.provider });
                setAddress(addr);
                setWalletType('walletconnect');
                localStorage.setItem(STORAGE_KEY, 'walletconnect');
            }
        } catch (err) {
            console.error('WalletConnect error:', err);
        } finally {
            setConnecting(false);
        }
    }, []);

    // connect: show picker if injected available, else go WC
    const connect = useCallback(() => {
        if (injectedAvailable()) {
            setShowPicker(true);
        } else {
            connectWalletConnect();
        }
    }, [connectWalletConnect]);

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
                    onInjected={connectInjected}
                    onWalletConnect={connectWalletConnect}
                    onClose={() => setShowPicker(false)}
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

// Wallet picker modal

const WalletPickerModal = ({ onInjected, onWalletConnect, onClose }) => (
    <PickerOverlay onClick={e => e.target === e.currentTarget && onClose()}>
        <PickerCard>
            <PickerHeader>
                <PickerTitle>Connect wallet</PickerTitle>
                <PickerClose onClick={onClose}><X size={16} /></PickerClose>
            </PickerHeader>
            <PickerBody>
                <PickerOption onClick={onInjected}>
                    <PickerOptionIcon>
                        <Wallet size={20} />
                    </PickerOptionIcon>
                    <PickerOptionText>
                        <PickerOptionName>Browser wallet</PickerOptionName>
                        <PickerOptionSub>MetaMask, Rabby, Coinbase and more</PickerOptionSub>
                    </PickerOptionText>
                    <PickerChevron>›</PickerChevron>
                </PickerOption>
                <PickerOption onClick={onWalletConnect}>
                    <PickerOptionIcon $wc>
                        <Link2 size={20} />
                    </PickerOptionIcon>
                    <PickerOptionText>
                        <PickerOptionName>WalletConnect</PickerOptionName>
                        <PickerOptionSub>Scan QR code with any mobile wallet</PickerOptionSub>
                    </PickerOptionText>
                    <PickerChevron>›</PickerChevron>
                </PickerOption>
            </PickerBody>
            <PickerFooter>
                New to crypto wallets? <a href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer">Read our guide</a>
            </PickerFooter>
        </PickerCard>
    </PickerOverlay>
);

// Picker styled components

const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const PickerOverlay = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(9,0,34,0.5);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 200;
`;

const PickerCard = styled.div`
    width: 100%;
    max-width: 380px;
    background: #0B1628;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0,0,0,0.5);
    animation: ${fadeUp} 0.2s ease both;
`;

const PickerHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 18px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
`;

const PickerTitle = styled.h3`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.3px;
`;

const PickerClose = styled.button`
    width: 30px; height: 30px;
    display: grid; place-items: center;
    background: rgba(255,255,255,0.06);
    border: none;
    border-radius: 8px;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    &:hover { background: rgba(255,255,255,0.1); color: #fff; }
`;

const PickerBody = styled.div`
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const PickerOption = styled.button`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    width: 100%;
    transition: background 0.15s, border-color 0.15s;
    &:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.14);
    }
`;

const PickerOptionIcon = styled.div`
    width: 44px; height: 44px;
    border-radius: 12px;
    background: ${p => p.$wc ? 'rgba(70,133,255,0.12)' : 'rgba(108,99,255,0.12)'};
    color: ${p => p.$wc ? '#4685ff' : '#a09eff'};
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
    color: rgba(255,255,255,0.38);
    margin: 0;
`;

const PickerChevron = styled.span`
    font-size: 20px;
    color: rgba(255,255,255,0.2);
    flex-shrink: 0;
    line-height: 1;
`;

const PickerFooter = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.25);
    text-align: center;
    padding: 14px 20px 18px;
    margin: 0;
    border-top: 1px solid rgba(255,255,255,0.05);

    a {
        color: rgba(255,255,255,0.5);
        text-decoration: underline;
        &:hover { color: rgba(255,255,255,0.8); }
    }
`;
