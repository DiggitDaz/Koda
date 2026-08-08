import { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { ethers } from 'ethers';
import { Wallet, Link2 } from 'lucide-react';
import { getUniversalConnector } from '../../config/walletconnect.js';
import { arcSend, ARC_RPC_PROXY } from '../../lib/arcRpc.js';

const extractAddress = (session) => {
    try {
        const accounts = Object.values(session.namespaces).flatMap(ns => ns.accounts || []);
        return accounts[0]?.split(':').pop() || null;
    } catch { return null; }
};

const WidgetConnect = ({ userId, actionLabel, onConnected, onError }) => {
    const wcRef      = useRef(null);
    const [loading,  setLoading]  = useState(false);
    const [which,    setWhich]    = useState(null); // 'injected' | 'wc'
    const [error,    setError]    = useState('');

    useEffect(() => {
        getUniversalConnector().then(uc => { wcRef.current = uc; }).catch(() => {});
    }, []);

    const signAndConnect = async (address, provider) => {
        const timestamp = Date.now();
        const message   = `Connect wallet to Koda. User ID: ${userId}. Timestamp: ${timestamp}`;

        try {
            await provider.request({
                method: 'wallet_addEthereumChain',
                params: [{ chainId: '0x4CEF52', chainName: 'Arc Testnet', rpcUrls: [ARC_RPC_PROXY], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, blockExplorerUrls: [import.meta.env.VITE_EXPLORER_URL] }],
            });
        } catch {
            try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x4CEF52' }] }); } catch {}
        }

        const ethProvider = new ethers.BrowserProvider(provider);
        const signer      = await ethProvider.getSigner();
        const signature   = await signer.signMessage(message);

        onConnected({ address, connector: { provider }, signature, message });
    };

    const connectInjected = async () => {
        if (!window.ethereum) { setError('No browser wallet detected.'); return; }
        setLoading(true); setWhich('injected'); setError('');
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!accounts[0]) throw new Error('No account returned');
            await signAndConnect(accounts[0], window.ethereum);
        } catch (err) {
            const msg = err.code === 4001 ? 'Request cancelled.' : (err.message || 'Connection failed');
            setError(msg);
            onError?.(msg);
        } finally { setLoading(false); setWhich(null); }
    };

    const connectWalletConnect = async () => {
        const uc = wcRef.current;
        if (!uc) { setError('WalletConnect not ready — try again.'); return; }
        setLoading(true); setWhich('wc'); setError('');
        try {
            const { session } = await uc.connect();
            const addr = extractAddress(session);
            if (!addr) throw new Error('No address returned');
            await signAndConnect(addr, uc.provider);
        } catch (err) {
            const msg = err.message || 'WalletConnect failed';
            setError(msg);
            onError?.(msg);
        } finally { setLoading(false); setWhich(null); }
    };

    const hasInjected = typeof window !== 'undefined' && !!window.ethereum;

    return (
        <Card>
            <Title>{actionLabel}</Title>
            <Sub>Connect your self-custody wallet to continue.</Sub>

            <Options>
                {hasInjected && (
                    <Option onClick={connectInjected} disabled={loading}>
                        <OptionIcon>
                            <Wallet size={20} />
                        </OptionIcon>
                        <OptionText>
                            <OptionName>Browser wallet</OptionName>
                            <OptionSub>MetaMask, Rabby, Coinbase and more</OptionSub>
                        </OptionText>
                        {loading && which === 'injected' ? <Spinner /> : <Chevron>›</Chevron>}
                    </Option>
                )}
                <Option onClick={connectWalletConnect} disabled={loading}>
                    <OptionIcon $wc>
                        <Link2 size={20} />
                    </OptionIcon>
                    <OptionText>
                        <OptionName>WalletConnect</OptionName>
                        <OptionSub>Scan QR with any mobile wallet</OptionSub>
                    </OptionText>
                    {loading && which === 'wc' ? <Spinner /> : <Chevron>›</Chevron>}
                </Option>
            </Options>

            {error && <ErrorMsg>{error}</ErrorMsg>}
        </Card>
    );
};

// ─── Styled ───────────────────────────────────────────────────────────────────

const spin = keyframes`to { transform: rotate(360deg); }`;
const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const Card = styled.div`
    width: 100%;
    max-width: 380px;
    background: #111118;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 28px;
    animation: ${fadeIn} 0.3s ease both;
`;

const Title = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.4px;
    margin: 0 0 6px;
`;

const Sub = styled.p`
    font-size: 13px;
    color: rgba(255,255,255,0.35);
    margin: 0 0 24px;
    line-height: 1.5;
`;

const Options = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const Option = styled.button`
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
    &:hover:not(:disabled) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const OptionIcon = styled.div`
    width: 44px; height: 44px;
    border-radius: 12px;
    background: ${p => p.$wc ? 'rgba(70,133,255,0.12)' : 'rgba(79,85,241,0.12)'};
    color:       ${p => p.$wc ? '#4685ff'               : '#4F55F1'};
    display: grid; place-items: center; flex-shrink: 0;
`;

const OptionText = styled.div`flex: 1; min-width: 0;`;

const OptionName = styled.p`
    font-size: 14px; font-weight: 700; color: #ffffff; margin: 0 0 3px;
`;

const OptionSub = styled.p`
    font-size: 12px; color: rgba(255,255,255,0.35); margin: 0;
`;

const Chevron = styled.span`
    font-size: 20px; color: rgba(255,255,255,0.2); flex-shrink: 0; line-height: 1;
`;

const Spinner = styled.div`
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.15);
    border-top-color: #4F55F1;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
    flex-shrink: 0;
`;

const ErrorMsg = styled.p`
    margin-top: 16px;
    font-size: 13px;
    color: #f87171;
    line-height: 1.5;
`;

export default WidgetConnect;
