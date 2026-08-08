import styled, { keyframes } from 'styled-components';
import { RefreshCw, ShieldX, Loader, Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext.js';
import usdcLogo from '../assets/usdc-logo.png';
import eurcLogo from '../assets/EURC-logo.png';

// Detects the connected wallet's name and icon.
// Tries EIP-6963 provider announcements first (supported by MetaMask, Rabby,
// Coinbase Wallet, etc.), then falls back to legacy window.ethereum flags.
function useWalletInfo(walletType, connector) {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        if (!walletType) { setInfo(null); return; }

        if (walletType === 'walletconnect') {
            setInfo({ name: 'WalletConnect', icon: null });
            return;
        }

        const found = [];

        const onAnnounce = (e) => {
            found.push(e.detail);
            // Prefer the provider instance that matches the one we connected with.
            const matched = found.find(d => d.provider === connector?.provider) ?? found[0];
            if (matched) setInfo({ name: matched.info.name, icon: matched.info.icon });
        };

        window.addEventListener('eip6963:announceProvider', onAnnounce);
        window.dispatchEvent(new Event('eip6963:requestProvider'));

        // If no EIP-6963 announcements arrive within 200ms, fall back to flags.
        const t = setTimeout(() => {
            if (found.length > 0) return;
            const eth = window.ethereum;
            if (!eth) { setInfo({ name: 'Browser Wallet', icon: null }); return; }
            let name = 'Browser Wallet';
            if (eth.isRabby)               name = 'Rabby';
            else if (eth.isMetaMask)       name = 'MetaMask';
            else if (eth.isCoinbaseWallet) name = 'Coinbase Wallet';
            else if (eth.isBraveWallet)    name = 'Brave Wallet';
            setInfo({ name, icon: null });
        }, 200);

        return () => {
            window.removeEventListener('eip6963:announceProvider', onAnnounce);
            clearTimeout(t);
        };
    }, [walletType, connector]);

    return info;
}

const TOKENS = [
    { symbol: 'USDC',    name: 'USD Coin', tag: 'In wallet',  color: '#4F55F1', bg: '#4F55F130', logo: usdcLogo },
    { symbol: 'TAPUSDC', name: 'Tap USDC', tag: 'Spendable',  color: '#4F55F1', bg: '#4F55F130', logo: null     },
    { symbol: 'EURC',    name: 'EUR Coin', tag: 'In wallet',  color: '#2563eb', bg: '#2563eb30', logo: eurcLogo },
    { symbol: 'TAPEURC', name: 'Tap EURC', tag: 'Spendable',  color: '#2563eb', bg: '#2563eb30', logo: null     },
];

const fmt = (b) => {
    if (!b) return '0.00';
    const n = parseFloat(b);
    if (n === 0) return '0.00';
    if (n < 0.01) return n.toFixed(6);
    if (n < 1)    return n.toFixed(4);
    return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const shortAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';

const WalletPage = () => {
    const {
        isConnected, address, connect, connecting,
        disconnect, isScreening, isBlocked,
        balances, balancesLoading, fetchBalances,
        walletType, connector,
    } = useWallet();

    const walletInfo = useWalletInfo(walletType, connector);
    const [copied, setCopied] = useState(false);

    const copyAddress = () => {
        if (!address) return;
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isConnected) {
        return (
            <Page>
                <PageTitle style={{ marginBottom: 28 }}>Wallet</PageTitle>
                <StateCard>
                    <StateEmoji>🔗</StateEmoji>
                    <StateTitle>No wallet connected</StateTitle>
                    <StateBody>Connect a self-custody wallet to view your balances on Arc Testnet.</StateBody>
                    <PrimaryBtn onClick={connect} disabled={connecting}>
                        {connecting ? 'Connecting…' : 'Connect wallet'}
                    </PrimaryBtn>
                </StateCard>
            </Page>
        );
    }

    if (isBlocked) {
        return (
            <Page>
                <PageTitle style={{ marginBottom: 28 }}>Wallet</PageTitle>
                <StateCard $red>
                    <ShieldX size={32} color="#f87171" />
                    <StateTitle>Wallet blocked</StateTitle>
                    <StateBody>
                        This address didn't pass our compliance check and can't connect to Koda.
                        If you think this is a mistake, contact support.
                    </StateBody>
                </StateCard>
            </Page>
        );
    }

    if (isScreening) {
        return (
            <Page>
                <PageTitle style={{ marginBottom: 28 }}>Wallet</PageTitle>
                <StateCard>
                    <SpinIcon />
                    <StateTitle>Checking your wallet</StateTitle>
                    <StateBody>
                        Running a quick security check on {shortAddr(address)}. This only takes a moment.
                    </StateBody>
                </StateCard>
            </Page>
        );
    }

    return (
        <Page>
            <TitleRow>
                <PageTitle>Connected Wallet</PageTitle>
                <IconBtn onClick={() => fetchBalances()} title="Refresh balances">
                    <RefreshCw size={24} strokeWidth={3} />
                </IconBtn>
            </TitleRow>

            <AddressPanel>
                <DotPattern />
                <AddressPanelTop>
                    <AddressBlock>
                        <WalletBadge>
                            {walletInfo?.icon
                                ? <WalletLogo src={walletInfo.icon} alt={walletInfo.name} />
                                : <WalletLogoFallback>{(walletInfo?.name ?? 'W')[0]}</WalletLogoFallback>
                            }
                            <WalletName>{walletInfo?.name ?? 'Browser Wallet'}</WalletName>
                        </WalletBadge>
                        <AddressValue>{shortAddr(address)}</AddressValue>
                    </AddressBlock>
                    <AddressPanelActions>
                        <CopyBtn onClick={copyAddress}>
                            {copied ? <Check size={13} /> : <Copy size={13} />}
                            {copied ? 'Copied' : 'Copy'}
                        </CopyBtn>
                        <DisconnectBtn onClick={disconnect}>Disconnect</DisconnectBtn>
                    </AddressPanelActions>
                </AddressPanelTop>
                <AddressDivider />
                <NetworkRow>
                    <NetworkDot />
                    <NetworkLabel>Arc Testnet</NetworkLabel>
                </NetworkRow>
            </AddressPanel>

            <SectionEyebrow>Token balances</SectionEyebrow>

            {balancesLoading ? (
                <SkeletonPanel>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                </SkeletonPanel>
            ) : (
                <TokenPanel>
                    {TOKENS.map((t, i) => (
                        <div key={t.symbol}>
                            {i === 2 && <TokenGroupDivider />}
                            <TokenRow>
                                <TokenAvatar style={{ background: t.bg, color: t.color }}>
                                    {t.logo
                                        ? <img src={t.logo} alt={t.symbol} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                        : 'T'}
                                </TokenAvatar>
                                <TokenMeta>
                                    <TokenSymbol>{t.symbol}</TokenSymbol>
                                    <TokenSubRow>
                                        <TokenName>{t.name}</TokenName>
                                        <TokenTag style={{ color: t.color, background: t.bg }}>
                                            {t.tag}
                                        </TokenTag>
                                    </TokenSubRow>
                                </TokenMeta>
                                <TokenRight>
                                    <TokenAmount>{fmt(balances[t.symbol])}</TokenAmount>
                                    <TokenNetwork>ERC-20, Arc Testnet</TokenNetwork>
                                </TokenRight>
                            </TokenRow>
                            {i < TOKENS.length - 1 && i !== 1 && <TokenDivider />}
                        </div>
                    ))}
                </TokenPanel>
            )}
        </Page>
    );
};

// Animations

const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`to { transform: rotate(360deg); }`;

const shimmer = keyframes`
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
`;

const pulse = keyframes`
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
`;

// Layout

const Page = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 36px 40px 60px;
    max-width: 720px;
    width: 95%;
    box-sizing: border-box;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    animation: ${fadeUp} 0.4s ease both;
    margin: 60px auto;
    border-radius: 25px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);

    @media (max-width: 768px) {
        padding: 24px 20px 40px;
        margin: 24px auto;
    }
`;

const TitleRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
    @media (max-width: 768px) { margin-bottom: 20px; }
`;

const PageTitle = styled.h1`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(26px, 3vw, 36px);
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.5px;
    @media (max-width: 768px) {  }
`;

const IconBtn = styled.button`
    width: 36px; height: 36px;
    display: grid; place-items: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #8D969E;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    &:hover { opacity: 0.7; }
`;

// Empty states

const StateCard = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid ${p => p.$red ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.08)'};
    border-radius: 20px;
    padding: 56px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    @media (max-width: 768px) { padding: 40px 24px; }
`;

const StateEmoji = styled.div`font-size: 40px; line-height: 1;`;

const StateTitle = styled.h2`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    margin: 4px 0 0;
    letter-spacing: -0.3px;
`;

const StateBody = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    color: rgba(255,255,255,0.45);
    line-height: 1.6;
    margin: 0;
    max-width: 340px;
`;

const PrimaryBtn = styled.button`
    margin-top: 8px;
    padding: 12px 28px;
    background: #4F55F1;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    &:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const SpinIcon = styled(Loader)`
    animation: ${spin} 1s linear infinite;
    color: rgba(255,255,255,0.5);
    width: 28px; height: 28px;
`;

// Address panel

const DotPattern = styled.div`
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
    border-radius: inherit;
`;

const AddressPanel = styled.div`
    position: relative;
    overflow: hidden;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border-radius: 20px;
    border: 1px solid #ffffff20;
    padding: 28px 32px;
    margin-bottom: 24px;
    box-shadow: 0 8px 14px rgba(0,0,0,0.25);
    @media (max-width: 768px) { padding: 22px; }
`;

const AddressPanelTop = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    position: relative;
`;

const AddressBlock = styled.div``;

const AddressEyebrow = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    margin: 0 0 10px;
`;

const WalletBadge = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 10px;
`;

const WalletLogo = styled.img`
    width: 30px;
    height: 30px;
    border-radius: 5px;
    flex-shrink: 0;
`;

const WalletLogoFallback = styled.div`
    width: 30px;
    height: 30px;
    border-radius: 5px;
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.5);
    font-size: 10px;
    font-weight: 800;
    display: grid;
    place-items: center;
    flex-shrink: 0;
`;

const WalletName = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: #8D969E;
`;

const AddressValue = styled.p`
    font-family: 'Saira', 'Fira Code', monospace;
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    letter-spacing: 1px;
    @media (max-width: 480px) { font-size: 17px; letter-spacing: 0.5px; }
`;

const AddressPanelActions = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    position: relative;
`;

const CopyBtn = styled.button`
    display: flex;
    align-items: center;
    gap: 5px;
    background: transparent;
    padding: 8px 14px;
    border: 1px solid #8D969E;
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #8D969E;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    &:hover { opacity: 70%; }
`;

const DisconnectBtn = styled.button`
    padding: 8px 14px;
    background: #4F55F1;
    border: 1px solid #4F55F1;
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #ffffff;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { opacity: 70%;}
`;

const AddressDivider = styled.div`
    height: 1px;
    background: #ffffff20;
    margin-bottom: 16px;
    position: relative;
`;

const NetworkRow = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    position: relative;
`;

const NetworkDot = styled.div`
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #7bdc05;
    animation: ${pulse} 2.5s ease infinite;
`;

const NetworkLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #8D969E;
`;

// Token balances

const SectionEyebrow = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #ffffff;
    margin: 0 0 25px;
    @media (max-width: 768px) {  }
`;

const SkeletonPanel = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    overflow: hidden;
`;

const SkeletonRow = styled.div`
    height: 80px;
    background: linear-gradient(90deg, #1e2d44 25%, #243550 50%, #1e2d44 75%);
    background-size: 600px 100%;
    animation: ${shimmer} 1.4s ease infinite;
    & + & { border-top: 1px solid rgba(255,255,255,0.05); }
`;

const TokenPanel = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 20px;
    padding: 0 24px;
    box-shadow: 0 8px 14px rgba(0,0,0,0.25);
    @media (max-width: 768px) { padding: 0 18px; }
`;

const TokenRow = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 22px 0;
    @media (max-width: 480px) { padding: 18px 0; gap: 12px; }
`;

const TokenAvatar = styled.div`
    width: 44px; height: 44px;
    border-radius: 22px;
    display: grid; place-items: center;
    font-family: 'Saira', sans-serif;
    font-size: 17px;
    font-weight: 800;
    flex-shrink: 0;
`;

const TokenMeta = styled.div`flex: 1; min-width: 0;`;

const TokenSymbol = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 4px;
`;

const TokenSubRow = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
`;

const TokenName = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
`;

const TokenTag = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 20px;
    letter-spacing: 0.3px;
`;

const TokenRight = styled.div`text-align: right; flex-shrink: 0;`;

const TokenAmount = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(18px, 3vw, 24px);
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 3px;
    letter-spacing: -0.5px;
`;

const TokenNetwork = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: #8D969E;
    margin: 0;
`;

const TokenDivider = styled.div`
    height: 1px;
    background: #8D969E30;
    margin-left: 58px;
`;

const TokenGroupDivider = styled.div`
    height: 1px;
    background: rgba(255,255,255,0.1);
    margin: 0 0;
`;

export default WalletPage;
