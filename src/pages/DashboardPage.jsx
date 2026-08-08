import { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import {
    Eye, EyeOff, ArrowDownLeft, ArrowUpRight,
    Snowflake, MoreHorizontal, Plus, Copy, Check, Wallet, ChevronDown, ChevronRight,
    Gauge, X, ArrowLeftRight, Droplets,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.js';
import { useWallet } from '../context/WalletContext.js';
import WrapComponent from '../components/WrapComponent.jsx';
import UnwrapComponent from '../components/UnwrapComponent.jsx';
import BridgeComponent from '../components/BridgeComponent.jsx';

import { arcSend } from '../lib/arcRpc.js';
import { useTutorial } from '../context/TutorialContext';
import BalanceHistoryChart, { recordBalanceSnapshot } from '../components/BalanceHistoryChart.jsx';

const TAPUSDC_ADDRESS   = '0xCb96C70be34cd6484e69D1BEd5ad2F22602191e3';
const TAPEURC_ADDRESS   = '0x36247A653A1253A96a286f5E296c06fF958b1ac0';
const LIMIT_ABI = [
    'function getAvailableSpendingToday(address account) view returns (uint256)',
    'function dailySpendingLimit(address account) view returns (uint256)',
    'function globalDailyLimit() view returns (uint256)',
    'function setDailySpendingLimit(uint256 newLimit) external',
];

const limitIface   = new ethers.Interface(LIMIT_ABI);

async function rawLimitCall(sig, args = [], contractAddr, retries = 3) {
    const data = limitIface.encodeFunctionData(sig, args);
    for (let i = 0; i < retries; i++) {
        try {
            const result = await arcSend('eth_call', [{ to: contractAddr, data }, 'latest']);
            if (result && result !== '0x') return limitIface.decodeFunctionResult(sig, result)[0];
            return null;
        } catch (err) {
            if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            else console.warn('[DailyLimit]', sig, 'failed:', err.code ?? err.message);
        }
    }
    return null;
}

const fmt = (b) => {
    if (!b) return '0.00';
    const n = parseFloat(b);
    if (n === 0) return '0.00';
    return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const SEG_COUNT = 36;
const SEG_GRAD  = ['#C8FF3E', '#00FFB2', '#00D0E8', '#0090CC'];

function hexLerp(a, b, t) {
    const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [ar,ag,ab] = p(a), [br,bg,bb] = p(b);
    return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
}

function segColor(ratio) {
    const t = ratio * (SEG_GRAD.length - 1);
    const i = Math.min(Math.floor(t), SEG_GRAD.length - 2);
    return hexLerp(SEG_GRAD[i], SEG_GRAD[i+1], t - i);
}

const LIMIT_STATUS = {
    loading:   { label: 'Checking…',   accent: '#4F55F1', badgeBg: '#4F55F1',             bar: '#4F55F1' },
    ok:        { label: 'Available',   accent: '#22c55e',   badgeBg: 'rgba(34,197,94,0.12)',   bar: '#22c55e'   },
    low:       { label: 'Low',         accent: '#f59e0b',   badgeBg: 'rgba(245,158,11,0.12)',  bar: '#f59e0b'   },
    exhausted: { label: 'Limit hit',   accent: '#ef4444',   badgeBg: 'rgba(239,68,68,0.12)',   bar: '#ef4444'   },
};

function useWalletInfo(walletType, connector) {
    const [info, setInfo] = useState(null);
    useEffect(() => {
        if (!walletType) { setInfo(null); return; }
        if (walletType === 'walletconnect') { setInfo({ name: 'WalletConnect', icon: null }); return; }
        const found = [];
        const onAnnounce = (e) => {
            found.push(e.detail);
            const matched = found.find(d => d.provider === connector?.provider) ?? found[0];
            if (matched) setInfo({ name: matched.info.name, icon: matched.info.icon });
        };
        window.addEventListener('eip6963:announceProvider', onAnnounce);
        window.dispatchEvent(new Event('eip6963:requestProvider'));
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
        return () => { window.removeEventListener('eip6963:announceProvider', onAnnounce); clearTimeout(t); };
    }, [walletType, connector]);
    return info;
}

const DashboardPage = () => {
    const navigate  = useNavigate();
    const { user }  = useAuth();
    const { isConnected, address, balances, fetchBalances, connector, walletType } = useWallet();

    const [activeCurrency,   setActiveCurrency]   = useState(() => localStorage.getItem('kodaCurrency') || 'TAPUSDC');
    const [hidden,           setHidden]           = useState(false);
    const [showWrap,         setShowWrap]         = useState(false);
    const [showUnwrap,       setShowUnwrap]       = useState(false);
    const [showBridge,       setShowBridge]       = useState(false);
    const [showCardDetails,  setShowCardDetails]  = useState(false);
    const [fetchedCard,      setFetchedCard]      = useState(null);
    const [cardDetailsBusy,  setCardDetailsBusy]  = useState(false);
    const [activating,       setActivating]       = useState(false);
    const [activateError,    setActivateError]    = useState('');
    const [card,             setCard]             = useState(null);
    const [cardDetails,      setCardDetails]      = useState(null);
    const [cardLoading,      setCardLoading]      = useState(true);
    const [transactions,     setTransactions]     = useState([]);
    const [txLoading,        setTxLoading]        = useState(false);
    const [copied,           setCopied]           = useState(false);
    const walletInfo = useWalletInfo(walletType, connector);
    const shortAddr  = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';

    // Tutorial steps 2, 3 & 4
    const { tourStep, setTourStep, dismissTour } = useTutorial();
    const faucetRef    = useRef(null);
    const [faucetRect,    setFaucetRect]    = useState(null);
    const wrapRef      = useRef(null);
    const [wrapRect,      setWrapRect]      = useState(null);
    const cardPanelRef = useRef(null);
    const [cardPanelRect, setCardPanelRect] = useState(null);

    // Skip step 2 if user already has meaningful USDC
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (tourStep !== 2) return;
        if (parseFloat(balances.USDC || '0') >= 1) setTourStep(3);
    }, [tourStep]); // balances.USDC intentionally omitted

    // Skip step 4 if user already has a card
    useEffect(() => {
        if (tourStep !== 4) return;
        if (!cardLoading && card) dismissTour();
    }, [tourStep, cardLoading, card]);

    const makeMeasureEffect = (step, ref, setRect) => () => {
        if (tourStep !== step) { setRect(null); return; }
        const measure = () => {
            if (!ref.current) return;
            const r = ref.current.getBoundingClientRect();
            setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height, winW: window.innerWidth });
        };
        const raf = requestAnimationFrame(measure);
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(makeMeasureEffect(2, faucetRef,    setFaucetRect),    [tourStep]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(makeMeasureEffect(3, wrapRef,      setWrapRect),      [tourStep]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(makeMeasureEffect(4, cardPanelRef, setCardPanelRect), [tourStep]);

    const advanceStep2 = () => setTourStep(3);
    const advanceStep3 = () => { setShowWrap(true); setTourStep(4); };
    const advanceStep4 = () => { dismissTour(); navigate('/createcard'); };

    useEffect(() => {
        if (balances.TAPUSDC || balances.USDC || balances.TAPEURC || balances.EURC) {
            recordBalanceSnapshot(balances.TAPUSDC, balances.USDC, balances.TAPEURC, balances.EURC);
        }
    }, [balances.TAPUSDC, balances.USDC, balances.TAPEURC, balances.EURC]);

    useEffect(() => {
        const today     = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
        const fxUrl     = v => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${v}/v1/currencies/gbp.json`;
        fetch(fxUrl(today))
            .then(r => r.ok ? r.json() : fetch(fxUrl(yesterday)).then(r2 => r2.json()))
            .then(d => {
                const { usd, eur } = d.gbp;
                setFxRates({ gbpUsd: usd, gbpEur: eur, eurUsd: usd / eur, usdEur: eur / usd });
                setFxDate(d.date);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) { setCardLoading(false); return; }

        axios.get(`${import.meta.env.VITE_AUTH_URL}/user/cards`, {
            headers: { Authorization: `Bearer ${token}` },
        }).then(async res => {
            if (res.data.success && res.data.data?.length > 0) {
                const userCard = res.data.data[0];
                setCard(userCard);
                try {
                    const details = await axios.post(`${import.meta.env.VITE_API_URL}/retrieve-card-details`, { cardId: userCard.card_id });
                    const d = details.data.cardDetails || details.data.card || details.data;
                    setCardDetails(d);
                } catch { /* non-fatal */ }
                try {
                    setTxLoading(true);
                    const txRes = await axios.get(`${import.meta.env.VITE_API_URL}/card-transactions/${userCard.card_id}`);
                    if (txRes.data.success) {
                        const auths = txRes.data.stripe_authorizations || [];
                        const dbTx  = txRes.data.database_transactions  || [];
                        const merged = auths.map(auth => {
                            if (!auth.approved) return { ...auth, txHash: null };
                            const authTime = new Date(auth.created).getTime();
                            const match = dbTx.find(d => {
                                if (!d.transaction_hash) return false;
                                const sameAmount = Math.abs(d.usd_cents) === Math.round(auth.amount * 100);
                                const withinWindow = Math.abs(new Date(d.created_at).getTime() - authTime) < 5 * 60 * 1000;
                                return sameAmount && withinWindow;
                            });
                            return { ...auth, txHash: match?.transaction_hash || null };
                        });

                        // Pre-Stripe declines (balance/card-validation failures) never reach
                        // Stripe so they won't appear in the auth list above. We write them
                        // to card_balance_history with a sim_declined_* hash — surface them here.
                        const simDeclines = dbTx
                            .filter(d => d.transaction_hash?.startsWith('sim_declined'))
                            .map(d => ({
                                id:       d.transaction_hash,
                                amount:   Math.abs(d.usd_cents) / 100,
                                currency: 'gbp',
                                merchant: (d.subscription_name || '').replace(/^Declined:\s*/, '') || 'Card payment',
                                approved: false,
                                created:  d.created_at,
                                txHash:   null,
                            }));

                        const allTx = [...merged, ...simDeclines];
                        allTx.sort((a, b) => new Date(b.created) - new Date(a.created));
                        setTransactions(allTx.slice(0, 10));
                    }
                } catch { /* non-fatal */ }
                finally { setTxLoading(false); }
            }
        }).catch(() => {}).finally(() => setCardLoading(false));
    }, []);

    const [fxRates,          setFxRates]          = useState(null);
    const [fxDate,           setFxDate]           = useState(null);
    const [dailyAvailable,   setDailyAvailable]   = useState(null);
    const [dailyLimit,       setDailyLimit]       = useState(null);
    const [showLimitModal,   setShowLimitModal]   = useState(false);
    const [limitInput,       setLimitInput]       = useState('');
    const [limitBusy,        setLimitBusy]        = useState(false);

    const fetchDailyLimit = useCallback(async () => {
        if (!address) return;
        const contractAddr = activeCurrency === 'TAPEURC' ? TAPEURC_ADDRESS : TAPUSDC_ADDRESS;
        const [available, personal, global] = await Promise.all([
            rawLimitCall('getAvailableSpendingToday', [address], contractAddr),
            rawLimitCall('dailySpendingLimit', [address], contractAddr),
            rawLimitCall('globalDailyLimit', [], contractAddr),
        ]);
        const effectiveLimit = (personal != null && personal > 0n) ? personal : (global ?? 0n);
        setDailyAvailable(available ?? 0n);
        setDailyLimit(effectiveLimit);
    }, [address, activeCurrency]);

    useEffect(() => {
        setDailyAvailable(null);
        setDailyLimit(null);
    }, [activeCurrency]);
    useEffect(() => { fetchDailyLimit(); }, [fetchDailyLimit]);

    const dailySpent    = dailyLimit !== null && dailyAvailable !== null ? dailyLimit - dailyAvailable : null;
    const dailyUsedPct  = dailyLimit && dailyLimit > 0n
                          ? Math.min(100, Number((dailySpent * 100n) / dailyLimit))
                          : 0;
    const limitStatus   = dailyLimit === null ? 'loading'
                          : dailyUsedPct >= 100 ? 'exhausted'
                          : dailyUsedPct >= 75  ? 'low'
                          :                       'ok';

    const handleSetLimit = async () => {
        if (!connector || !limitInput || parseFloat(limitInput) < 0) return;
        setLimitBusy(true);
        try {
            const provider = new ethers.BrowserProvider(connector.provider);
            const signer   = await provider.getSigner();
            const contractAddr = activeCurrency === 'TAPEURC' ? TAPEURC_ADDRESS : TAPUSDC_ADDRESS;
            const tapusdc  = new ethers.Contract(contractAddr, LIMIT_ABI, signer);
            // Fetch nonce from Arc RPC directly — wallet cache can lag behind chain state
            const rawNonce = await arcSend('eth_getTransactionCount', [address, 'pending']);
            const nonce    = parseInt(rawNonce, 16);
            const tx = await tapusdc.setDailySpendingLimit(ethers.parseUnits(limitInput, 6), { nonce });
            await tx.wait();
            setShowLimitModal(false);
            setLimitInput('');
            await fetchDailyLimit();
        } catch (err) { console.error('Set limit error:', err); }
        finally { setLimitBusy(false); }
    };

    const handleActivateCard = async () => {
        setActivating(true);
        setActivateError('');
        try {
            const token = localStorage.getItem('authToken');
            const res = await axios.post(
                `${import.meta.env.VITE_AUTH_URL}/user/activate-card`, {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                setFetchedCard(p => ({ ...p, status: 'active' }));
            } else {
                setActivateError(res.data.message || 'Activation failed.');
            }
        } catch (err) {
            setActivateError(err.response?.data?.message || 'Activation failed.');
        } finally { setActivating(false); }
    };

    const handleViewCardDetails = async () => {
        const cId = card?.card_id || localStorage.getItem('cardId');
        if (!cId) return;
        setCardDetailsBusy(true);
        setFetchedCard(null);
        setShowCardDetails(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/retrieve-card-details`, { cardId: cId });
            if (res.data.success) setFetchedCard(res.data.cardDetails);
        } catch { /* modal stays open, shows error */ }
        finally { setCardDetailsBusy(false); }
    };

    const handleCopyCardNumber = async () => {
        const num = cardDetails?.card_number;
        if (!num) return;
        await navigator.clipboard.writeText(num.replace(/\s/g, ''));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const switchCurrency = (c) => {
        setActiveCurrency(c);
        localStorage.setItem('kodaCurrency', c);
    };

    const isEUR       = activeCurrency === 'TAPEURC';
    const baseBalance = isEUR ? balances.TAPEURC : balances.TAPUSDC;
    const stabBalance = isEUR ? balances.EURC    : balances.USDC;
    const stabLabel   = isEUR ? 'EURC'           : 'USDC';

    return (
      <>
        <Page>
            {/* Hero row */}
            <HeroRow>
                <HeroLeftCol>
                    <CurrencyToggleBar>
                        <CurrencyToggleOpt $active={!isEUR} onClick={() => switchCurrency('TAPUSDC')}>
                            TAPUSDC
                        </CurrencyToggleOpt>
                        <CurrencyToggleOpt $active={isEUR} onClick={() => switchCurrency('TAPEURC')}>
                            TAPEURC
                        </CurrencyToggleOpt>
                    </CurrencyToggleBar>

                    <HeroTopRow>
                        <HeroLeft>
                            <HeroDotPattern />
                            {/* Wallet identity row */}
                            <HeroWalletRow>
                                <HeroWalletBadge>
                                    {walletInfo?.icon
                                        ? <HeroWalletLogo src={walletInfo.icon} alt={walletInfo.name} />
                                        : <HeroWalletFallback><Wallet size={15} /></HeroWalletFallback>
                                    }
                                    <HeroWalletMeta>
                                        <HeroWalletNameRow>
                                            <HeroWalletName>{walletInfo?.name ?? 'My Wallet'}</HeroWalletName>
                                            <ChevronDown size={13} color="#8D969E" />
                                        </HeroWalletNameRow>
                                        <HeroWalletAddr>{shortAddr(address)}</HeroWalletAddr>
                                    </HeroWalletMeta>
                                </HeroWalletBadge>
                                <HeroViewBtn onClick={() => navigate('/wallet')}>View</HeroViewBtn>
                            </HeroWalletRow>

                            {/* Balance */}
                            <BalanceLabel>Total Balance</BalanceLabel>

                            <HeroBalanceRow>
                                <BalanceAmount>{hidden ? '••••••' : fmt(baseBalance)}</BalanceAmount>
                                <HeroCurrencyPill>
                                    <EyeToggle onClick={() => setHidden(h => !h)}>
                                        {hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </EyeToggle>
                                    {activeCurrency}
                                </HeroCurrencyPill>
                            </HeroBalanceRow>

                            <SecondaryBalance>
                                <SecondaryAmount>{hidden ? '••••' : fmt(stabBalance)}</SecondaryAmount>
                                <SecondaryCurrency>{stabLabel}</SecondaryCurrency>
                                <SecondaryDivider />
                                <SecondaryLabel>in wallet</SecondaryLabel>
                            </SecondaryBalance>

                            
                        </HeroLeft>

                        <HeroLeftExtra>
                            <ExtraTitle>Actions</ExtraTitle>
                            <ActionsList>
                                <ActionRow ref={wrapRef} onClick={tourStep === 3 ? advanceStep3 : () => setShowWrap(true)}>
                                    <ArrowDownLeft size={15} color="rgba(255,255,255,0.45)" />
                                    <ActionRowLabel>Wrap</ActionRowLabel>
                                    <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                                </ActionRow>
                                <ActionRowDivider />
                                <ActionRow onClick={() => setShowUnwrap(true)}>
                                    <ArrowUpRight size={15} color="rgba(255,255,255,0.45)" />
                                    <ActionRowLabel>Unwrap</ActionRowLabel>
                                    <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                                </ActionRow>
                                <ActionRowDivider />
                                <ActionRow onClick={() => setShowBridge(true)}>
                                    <ArrowLeftRight size={15} color="rgba(255,255,255,0.45)" />
                                    <ActionRowLabel>Bridge</ActionRowLabel>
                                    <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                                </ActionRow>
                                <ActionRowDivider />
                                <ActionRow ref={faucetRef} as="a" href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" onClick={tourStep === 2 ? advanceStep2 : undefined}>
                                    <Droplets size={15} color="rgba(255,255,255,0.45)" />
                                    <ActionRowLabel>Get USDC / EURC</ActionRowLabel>
                                    <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                                </ActionRow>
                            </ActionsList>
                        </HeroLeftExtra>
                    </HeroTopRow>

                    <BalanceHistoryChart
                        tapusdcBalance={balances.TAPUSDC}
                        usdcBalance={balances.USDC}
                        tapeurcBalance={balances.TAPEURC}
                        eurcBalance={balances.EURC}
                    />

                    {/* Recent activity */}
                    <ActivityCard>
                        <ActivityHeader>
                            <ActivityTitle>Recent activity</ActivityTitle>
                            <ActivityRule />
                            {transactions.length > 0 && (
                                <SeeAllBtn onClick={() => navigate('/payments')}>See all</SeeAllBtn>
                            )}
                        </ActivityHeader>

                        {txLoading ? (
                            <EmptyState>
                                <EmptyTitle>Loading transactions…</EmptyTitle>
                            </EmptyState>
                        ) : transactions.length === 0 ? (
                            <EmptyState>
                                <EmptyTitle>No activity yet</EmptyTitle>
                                <EmptyBody>Your transactions will appear here once you start spending.</EmptyBody>
                            </EmptyState>
                        ) : (
                            <TxList>
                                {transactions.map((tx, i) => {
                                    const approved = tx.approved;
                                    const formattedDate = new Date(tx.created).toLocaleString('en-GB', {
                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                    });
                                    return (
                                        <div key={tx.id}>
                                            <TxRow>
                                                <TxAvatar $positive={approved}>
                                                    {approved ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                                                </TxAvatar>
                                                <TxMeta>
                                                    <TxName>{tx.merchant || 'Card payment'}</TxName>
                                                    <TxDetail>
                                                        {approved ? 'Approved' : 'Declined'}
                                                        {tx.txHash && (
                                                            <TxHashLink
                                                                href={`${import.meta.env.VITE_EXPLORER_URL}/tx/${tx.txHash}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                · on-chain
                                                            </TxHashLink>
                                                        )}
                                                    </TxDetail>
                                                </TxMeta>
                                                <TxRight>
                                                    <TxAmount $positive={approved}>
                                                        {approved ? '-' : ''}£{typeof tx.amount === 'number' ? tx.amount.toFixed(2) : tx.amount}
                                                    </TxAmount>
                                                    <TxTime>{formattedDate}</TxTime>
                                                </TxRight>
                                            </TxRow>
                                            {i < transactions.length - 1 && <TxDivider />}
                                        </div>
                                    );
                                })}
                            </TxList>
                        )}
                    </ActivityCard>

                </HeroLeftCol>

                <HeroRightCol>
                    <HeroRight>
                        <CardTabRow>
                            
                            <Tip text="Coming soon">
                                <AddCardBtn><Plus size={13} /> Add Card</AddCardBtn>
                            </Tip>
                        </CardTabRow>

                        {cardLoading ? (
                            <CardSkeleton />
                        ) : card ? (
                            <>
                                <KodaCard>
                                    <CardTopRow>
                                        <CardWordmark>koda</CardWordmark>
                                        <CardBalanceAmount>{fmt(balances[activeCurrency])}</CardBalanceAmount>
                                    </CardTopRow>
                                    <CardMidRow>
                                        <CardAccountLine>
                                            {cardDetails?.last4 ? `•••• •••• •••• ${cardDetails.last4}` : '•••• •••• •••• ••••'}
                                        </CardAccountLine>
                                        <CardBalanceLabel>Balance</CardBalanceLabel>
                                    </CardMidRow>
                                    <CardActionRow>
                                        <Tip text="View your full card number, expiry date and CVV for online payments">
                                            <CardActionBtn onClick={handleViewCardDetails}>
                                                <Eye size={14} /> Details
                                            </CardActionBtn>
                                        </Tip>
                                        <Tip text="Copy your card number to clipboard">
                                            <CardActionBtn onClick={handleCopyCardNumber} disabled={!cardDetails?.card_number}>
                                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                                {copied ? 'Copied' : 'Copy'}
                                            </CardActionBtn>
                                        </Tip>
                                        <Tip text="Temporarily block all new payments on this card — you can unfreeze at any time">
                                            <CardActionBtn>
                                                <Snowflake size={14} /> Freeze
                                            </CardActionBtn>
                                        </Tip>
                                        <Tip text="Additional card settings and options">
                                            <CardActionBtn>
                                                <MoreHorizontal size={14} /> More
                                            </CardActionBtn>
                                        </Tip>
                                    </CardActionRow>
                                </KodaCard>
                            </>
                        ) : (
                            <NoCardPanel ref={cardPanelRef} onClick={tourStep === 4 ? advanceStep4 : () => navigate('/createcard')}>
                                <NoCardInner>
                                    <NoCardIcon><Plus size={22} /></NoCardIcon>
                                    <NoCardTitle>Create your Koda card</NoCardTitle>
                                    <NoCardBody>
                                        A virtual Visa card that spends TAPUSDC directly from your self-custody wallet.
                                    </NoCardBody>
                                    <CreateCardBtn>Get your card</CreateCardBtn>
                                </NoCardInner>
                            </NoCardPanel>
                        )}
                    </HeroRight>

                    {isConnected && (
                        <ApprovalCard>
                            <ApprovalTitle>
                                Daily spending limit
                                
                            </ApprovalTitle>

                            <ApprovalBarWrap>
                                <SegmentedBar>
                                    {Array.from({length: SEG_COUNT}, (_, i) => {
                                        const active = i < Math.round(dailyUsedPct / 100 * SEG_COUNT);
                                        return (
                                            <BarSeg key={i} $active={active}
                                                style={active ? {background: segColor(i / (SEG_COUNT - 1))} : undefined}
                                            />
                                        );
                                    })}
                                </SegmentedBar>
                                <ApprovalBarLabel>
                                    {limitStatus === 'loading' && '—'}
                                    {limitStatus !== 'loading' && (
                                        <>
                                            {fmt(ethers.formatUnits(dailySpent ?? 0n, 6))} of {fmt(ethers.formatUnits(dailyLimit ?? 0n, 6))} {activeCurrency} used today
                                        </>
                                    )}
                                </ApprovalBarLabel>
                            </ApprovalBarWrap>

                            <ApprovalActions>
                                <ApprovalGrantBtn onClick={() => {
                                    setLimitInput(dailyLimit ? ethers.formatUnits(dailyLimit, 6) : '');
                                    setShowLimitModal(true);
                                }}>
                                    Set limit
                                </ApprovalGrantBtn>
                            </ApprovalActions>
                        </ApprovalCard>
                    )}

                    <FxCard>
                        <FxCardHeader>
                            <FxCardTitle>FX Rates</FxCardTitle>
                            {fxDate && <FxCardDate>ECB · {fxDate}</FxCardDate>}
                        </FxCardHeader>
                        <FxPairList>
                            {[
                                { label: 'GBP / USD', value: fxRates?.gbpUsd },
                                { label: 'GBP / EUR', value: fxRates?.gbpEur },
                                { label: 'EUR / USD', value: fxRates?.eurUsd },
                                { label: 'USD / EUR', value: fxRates?.usdEur },
                            ].map(({ label, value }) => (
                                <FxPairRow key={label}>
                                    <FxPairLabel>{label}</FxPairLabel>
                                    <FxPairRate>{value ? value.toFixed(4) : '—'}</FxPairRate>
                                </FxPairRow>
                            ))}
                        </FxPairList>
                    </FxCard>

                    <HelpCard>
                        <HelpIconWrap>?</HelpIconWrap>
                        <HelpTitle>Need help?</HelpTitle>
                        <HelpBody>
                            Learn how Koda works, from connecting your wallet and wrapping USDC, to spending with your virtual card.
                        </HelpBody>
                        <HelpLink href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer">
                            Read the docs
                        </HelpLink>
                        <HelpSecondary onClick={() => navigate('/how-it-works')}>
                            How it works
                        </HelpSecondary>
                    </HelpCard>

                </HeroRightCol>
            </HeroRow>

            {/* Overlays */}
            {showWrap && (
                <WrapComponent
                    connector={connector}
                    walletAddress={address}
                    onClose={() => setShowWrap(false)}
                    onSuccess={() => { setShowWrap(false); fetchBalances(); }}
                />
            )}

            {showUnwrap && (
                <UnwrapComponent
                    connector={connector}
                    walletAddress={address}
                    onClose={() => setShowUnwrap(false)}
                    onSuccess={() => { setShowUnwrap(false); fetchBalances(); }}
                />
            )}

            {showBridge && (
                <BridgeComponent
                    connector={connector}
                    walletAddress={address}
                    onClose={() => setShowBridge(false)}
                    onSuccess={() => { setShowBridge(false); fetchBalances(); }}
                />
            )}

            {showCardDetails && (
                <ModalOverlay onClick={(e) => e.target === e.currentTarget && setShowCardDetails(false)}>
                    <CardDetailsModal>
                        <ModalHeader>
                            <ModalHeaderTitle>Card details</ModalHeaderTitle>
                            <ModalCloseBtn onClick={() => setShowCardDetails(false)}><X size={14} /></ModalCloseBtn>
                        </ModalHeader>

                        {cardDetailsBusy && (
                            <ModalBody>
                                <ModalSpinner />
                                <ModalMeta>Fetching card details…</ModalMeta>
                            </ModalBody>
                        )}

                        {!cardDetailsBusy && !fetchedCard && (
                            <ModalBody>
                                <ModalMeta style={{ color: '#ef4444' }}>Could not retrieve card details.</ModalMeta>
                            </ModalBody>
                        )}

                        {!cardDetailsBusy && fetchedCard && (
                            <ModalBody>
                                <DetailRow>
                                    <DetailLabel>Card number</DetailLabel>
                                    <DetailValue>{fetchedCard.card_number?.replace(/(.{4})/g, '$1 ').trim()}</DetailValue>
                                </DetailRow>
                                <DetailRow>
                                    <DetailLabel>Expiry</DetailLabel>
                                    <DetailValue>
                                        {String(fetchedCard.exp_month).padStart(2,'0')}/{String(fetchedCard.exp_year).slice(-2)}
                                    </DetailValue>
                                </DetailRow>
                                <DetailRow>
                                    <DetailLabel>CVV</DetailLabel>
                                    <DetailValue>{fetchedCard.cvc}</DetailValue>
                                </DetailRow>
                                <DetailRow>
                                    <DetailLabel>Name</DetailLabel>
                                    <DetailValue>{fetchedCard.cardholder_name}</DetailValue>
                                </DetailRow>
                                <DetailRow>
                                    <DetailLabel>Status</DetailLabel>
                                    <DetailValue style={{ color: fetchedCard.status === 'active' ? '#22c55e' : '#f59e0b', textTransform: 'capitalize' }}>
                                        {fetchedCard.status}
                                    </DetailValue>
                                </DetailRow>

                                {fetchedCard.status !== 'active' && (
                                    <>
                                        {activateError && (
                                            <ModalNote style={{ color: '#ef4444' }}>{activateError}</ModalNote>
                                        )}
                                        <ActivateBtn onClick={handleActivateCard} disabled={activating}>
                                            {activating ? <TinySpinner /> : null}
                                            {activating ? 'Activating…' : 'Activate card'}
                                        </ActivateBtn>
                                    </>
                                )}

                                <ModalNote>These details are for testing only. Do not share them.</ModalNote>
                            </ModalBody>
                        )}
                    </CardDetailsModal>
                </ModalOverlay>
            )}

            {showLimitModal && (
                <ModalOverlay onClick={(e) => e.target === e.currentTarget && setShowLimitModal(false)}>
                    <ApprovalModal>
                        <ModalHeader>
                            <div>
                                <ApprovalModalTitle>Set daily spending limit</ApprovalModalTitle>
                                <ModalHeaderSub>Max {activeCurrency} you can spend per day</ModalHeaderSub>
                            </div>
                            <ApprovalModalClose onClick={() => setShowLimitModal(false)}><X size={14} /></ApprovalModalClose>
                        </ModalHeader>

                        <ModalBody>
                            <ApprovalTokenBox>
                                <ApprovalAmountLabel>
                                    <span>Daily limit</span>
                                    <ApprovalBalanceHint onClick={() => setLimitInput(balances[activeCurrency] || '0')}>
                                        Balance: {fmt(balances[activeCurrency])} — Max
                                    </ApprovalBalanceHint>
                                </ApprovalAmountLabel>
                                <ApprovalTokenRow>
                                    <ApprovalAmountInput
                                        type="number"
                                        placeholder="0.00"
                                        value={limitInput}
                                        onChange={(e) => setLimitInput(e.target.value)}
                                        disabled={limitBusy}
                                        autoFocus
                                    />
                                    <ApprovalAmountToken>{activeCurrency}</ApprovalAmountToken>
                                </ApprovalTokenRow>
                            </ApprovalTokenBox>
                            <ApprovalModalNote>
                                Sets the maximum amount of {activeCurrency} you can spend in a single day. Set to 0 to use the global default.
                            </ApprovalModalNote>
                        </ModalBody>

                        <ModalFooter>
                            <ModalConfirmBtn
                                onClick={handleSetLimit}
                                disabled={limitBusy || limitInput === ''}
                            >
                                {limitBusy ? <><TinySpinner /> Confirming…</> : 'Confirm'}
                            </ModalConfirmBtn>
                        </ModalFooter>
                    </ApprovalModal>
                </ModalOverlay>
            )}
        </Page>

        {tourStep === 2 && faucetRect && (
            <>
                <TourSpotlight style={{
                    top:    faucetRect.top    - 8,
                    left:   faucetRect.left   - 8,
                    width:  faucetRect.width  + 16,
                    height: faucetRect.height + 16,
                }} />
                <TourCard style={{
                    top:  faucetRect.bottom + 16,
                    left: faucetRect.left - 8,
                }}>
                    <TourArrow style={{ left: 20, right: 'auto' }} />
                    <TourStepPill>Step 2 of 4</TourStepPill>
                    <TourTitle>Get some USDC</TourTitle>
                    <TourBody>
                        You'll need USDC to wrap into TAPUSDC and spend with your Koda card. Click here to visit Circle's free testnet faucet. Funds arrive in seconds.
                    </TourBody>
                    <TourSkip onClick={dismissTour}>Skip tutorial</TourSkip>
                </TourCard>
            </>
        )}

        {tourStep === 3 && wrapRect && (
            <>
                <TourSpotlight style={{
                    top:    wrapRect.top    - 8,
                    left:   wrapRect.left   - 8,
                    width:  wrapRect.width  + 16,
                    height: wrapRect.height + 16,
                }} />
                <TourCard style={{
                    top:  wrapRect.bottom + 16,
                    left: wrapRect.left - 8,
                }}>
                    <TourArrow style={{ left: 20, right: 'auto' }} />
                    <TourStepPill>Step 3 of 4</TourStepPill>
                    <TourTitle>Wrap your USDC</TourTitle>
                    <TourBody>
                        Tap Wrap to convert your USDC into TAPUSDC, the spendable token on your Koda card. You can also wrap EURC into TAPEURC if you prefer euros.
                    </TourBody>
                    <TourSkip onClick={dismissTour}>Skip tutorial</TourSkip>
                </TourCard>
            </>
        )}

        {tourStep === 4 && cardPanelRect && (
            <>
                <TourSpotlight style={{
                    top:    cardPanelRect.top    - 8,
                    left:   cardPanelRect.left   - 8,
                    width:  cardPanelRect.width  + 16,
                    height: cardPanelRect.height + 16,
                }} />
                <TourCard style={{
                    top:  cardPanelRect.bottom + 16,
                    left: cardPanelRect.left - 8,
                }}>
                    <TourArrow style={{ left: 20, right: 'auto' }} />
                    <TourStepPill>Step 4 of 4</TourStepPill>
                    <TourTitle>Create your card</TourTitle>
                    <TourBody>
                        You are ready. Tap here to create your Koda virtual Visa card and start spending your TAPUSDC anywhere Visa is accepted.
                    </TourBody>
                    <TourSkip onClick={dismissTour}>Skip tutorial</TourSkip>
                </TourCard>
            </>
        )}
      </>
    );
};

// SVG helpers

const NfcIcon = () => (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
        <path d="M11 14a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="rgba(255,255,255,0.9)" />
        <path d="M7.5 11.5a5 5 0 0 1 7 0" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4.5 8.5a9 9 0 0 1 13 0" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const ChipSvg = () => (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
        <rect width="36" height="28" rx="5" fill="url(#chip)" />
        <rect x="13" y="0"  width="10" height="28" fill="rgba(0,0,0,0.08)" />
        <rect x="0"  y="9"  width="36" height="10" fill="rgba(0,0,0,0.08)" />
        <rect x="13" y="9"  width="10" height="10" fill="rgba(0,0,0,0.05)" />
        <defs>
            <linearGradient id="chip" x1="0" y1="0" x2="36" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f6d365" />
                <stop offset="1" stopColor="#c9a227" />
            </linearGradient>
        </defs>
    </svg>
);

// Tooltip

// green #7bdc05
// black #0f0f11
// box-shadow: 0 8px 14px rgba(0,0,0,0.25);


const TooltipBubble = styled.div`
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    background: #ffffff;
    border: 1px solid #4F55F1;
    color: #000000;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.5;
    padding: 7px 12px;
    border-radius: 8px;
    pointer-events: none;
    opacity: 0;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    transition: opacity 0.15s;
    z-index: 99;
    max-width: 200px;
    white-space: normal;
    text-align: center;

    &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 5px solid transparent;
        border-top-color: rgba(255,255,255,0.1);
    }
`;

const TooltipWrap = styled.div`
    position: relative;
    display: flex;
    &:hover ${TooltipBubble} { opacity: 1; }
`;

const Tip = ({ text, children }) => (
    <TooltipWrap>
        {children}
        <TooltipBubble>{text}</TooltipBubble>
    </TooltipWrap>
);

// Animations

const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
`;

const shimmer = keyframes`
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
`;

const spin = keyframes`to { transform: rotate(360deg); }`;

const barIn = keyframes`from { width: 0%; }`;

// Page

const Page = styled.div`
    min-height: 100%;
    padding: 20px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    animation: ${fadeUp} 0.4s ease both;
    background: #000000;

    @media (max-width: 768px) {
        padding: 16px 0 60px;
    }
`;

// Hero row

const HeroRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 432px;
    gap: 16px;
    margin-bottom: 16px;
    border: 2px solid #0f0f1130;
    padding: 25px 25px 0px 25px;
    border-radius: 24px;

    @media (max-width: 960px) { grid-template-columns: 1fr 360px; }
    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        border: none;
        padding: 0;
        gap: 12px;
        width: 95%;
        margin: 0 auto 16px;
    }
`;

const HeroLeftCol = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
`;

const CurrencyToggleBar = styled.div`
    display: flex;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 4px;
    gap: 4px;
`;

const CurrencyToggleOpt = styled.button`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 16px;
    border: none;
    border-radius: 9px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.2px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    background: ${p => p.$active ? '#4F55F1' : 'transparent'};
    color: ${p => p.$active ? '#ffffff' : 'rgba(255,255,255,0.35)'};
    &:hover { color: ${p => p.$active ? '#ffffff' : 'rgba(255,255,255,0.65)'}; }
`;

const CurrencyToggleDot = styled.span`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: ${p => p.$active ? '#4F55F1' : 'rgba(255,255,255,0.15)'};
    transition: background 0.15s;
`;

const HeroTopRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;

    @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const HeroLeftExtra = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border-radius: 20px;
    border: 1px solid #ffffff20;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,15,17,0.05);
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const ExtraTitle = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: #ffffff;
    margin: 0;
`;

const ActionsList = styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: space-between;
`;

const ActionRow = styled.button`
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 11px 4px;
    background: transparent;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s;

    &:hover {
        background: rgba(255,255,255,0.04);
    }
    &:hover svg:last-child { color: rgba(255,255,255,0.6) !important; }
`;


const ActionRowLabel = styled.span`
    flex: 1;
    text-align: left;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
`;

const ActionRowDivider = styled.div`
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 0 0;
`;

const HeroWalletRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    background: #ffffff05;
    border: 1px solid #ffffff20;
    padding: 15px;
    border-radius: 15px;
`;

const HeroWalletBadge = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
`;

const HeroWalletLogo = styled.img`
    width: 36px;
    height: 36px;
    border-radius: 10px;
    flex-shrink: 0;
`;

const HeroWalletFallback = styled.div`
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    display: grid;
    place-items: center;
    color: rgba(255,255,255,0.45);
    flex-shrink: 0;
`;

const HeroWalletMeta = styled.div`
    display: flex;
    flex-direction: column;
    gap: 3px;
`;

const HeroWalletNameRow = styled.div`
    display: flex;
    align-items: center;
    gap: 4px;
`;

const HeroWalletName = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
`;

const HeroWalletAddr = styled.span`
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
    color: #8D969E;
`;

const HeroViewBtn = styled.button`
    background: transparent;
    border-radius: 8px;
    border: none;
    color: #4F55F1;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 14px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    white-space: nowrap;
    &:hover { border-color: rgba(255,255,255,0.35); color: #ffffff; }
`;

const HeroBalanceRow = styled.div`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 0 12px;
`;

const HeroCurrencyPill = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 6px 12px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: #8D969E;
    white-space: nowrap;
    flex-shrink: 0;
    margin-bottom: 4px;
`;

const HeroLeft = styled.div`
    position: relative;
    overflow: hidden;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid #ffffff20;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,15,17,0.05);
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    @media (max-width: 768px) { padding: 20px; }
`;

const HeroRightCol = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;

    @media (max-width: 768px) { gap: 12px; }
`;

const HeroRight = styled.div`
    position: relative;
    overflow: hidden;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid #ffffff20;
    border-radius: 20px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,15,17,0.05);

    @media (max-width: 768px) { padding: 20px; }
`;

const HeroDotPattern = styled.div`
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(15,15,17,0.05) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
`;

const HeroGlow = styled.div`
    position: absolute;
    top: -140px; left: -140px;
    width: 360px; height: 360px;
    border-radius: 50%;
    background: radial-gradient(circle, #ffffff20 0%, transparent 70%);
    pointer-events: none;
`;

// Balance

const BalanceLabelRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
`;

const BalanceLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: #8D969E;
    text-transform: uppercase;
    letter-spacing: 1.2px;
`;

const EyeToggle = styled.button`
    background: none; border: none;
    color: #8D969E; cursor: pointer;
    display: grid; place-items: center; padding: 4px;
    border-radius: 6px;
    transition: color 0.15s, background 0.15s;
    &:hover { opacity: 0.8; }
`;

const BalanceDisplay = styled.div`
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 10px;
`;

const BalanceAmount = styled.span`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(44px, 5.5vw, 68px);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -2px;
    line-height: 1;
`;

const BalanceCurrency = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #8D969E;
    margin-bottom: 10px;
    letter-spacing: 0.3px;
`;

const SecondaryBalance = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
`;

const SecondaryAmount = styled.span`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    letter-spacing: -0.3px;
`;

const SecondaryCurrency = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #8D969E;
`;

const SecondaryDivider = styled.div`
    width: 1px;
    height: 12px;
    background: #8D969E30;
`;

const SecondaryLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
`;

const NetworkRow = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 28px;
`;

const NetworkDot = styled.div`
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background: ${p => p.$on ? '#22C55E' : 'rgba(15,15,17,0.18)'};
    ${p => p.$on && css`animation: ${pulse} 2.5s ease infinite;`}
`;

const NetworkLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #8D969E;
`;


// Koda card

const CardSkeleton = styled.div`
    flex: 1;
    min-height: 0;
    border-radius: 18px;
    background: linear-gradient(90deg, #1a2a40 25%, #223045 50%, #1a2a40 75%);
    background-size: 800px 100%;
    animation: ${shimmer} 1.4s ease infinite;
`;

// Card tab row

const CardTabRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
`;

const CardTabGroup = styled.div`
    display: flex;
    background: rgba(255,255,255,0.06);
    border-radius: 10px;
    padding: 3px;
    gap: 2px;
`;

const CardTab = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    background: ${p => p.$active ? 'rgba(255,255,255,0.12)' : 'transparent'};
    color: ${p => p.$active ? '#ffffff' : 'rgba(255,255,255,0.35)'};
    transition: background 0.15s, color 0.15s;
`;

const CardTabDot = styled.span`
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
`;

const AddCardBtn = styled.button`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    background: transparent;
    color: rgba(255,255,255,0.55);
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    &:hover { border-color: rgba(255,255,255,0.25); color: #ffffff; }
`;

// Card panel

const KodaCard = styled.div`
    background: #8D969E15
    
    ;
    border-radius: 16px;
    overflow: hidden;
    flex-shrink: 0;
    height: 200px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0,0,0,0.28);
`;

const CardTopRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 18px 18px 8px;
`;

const CardWordmark = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    letter-spacing: 0.5px;
`;

const CardBalanceAmount = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    line-height: 1;
`;

const CardMidRow = styled.div`
    display: flex;
    flex: 1;
    justify-content: space-between;
    align-items: flex-end;
    padding: 4px 18px 16px;
`;

const CardAccountLine = styled.p`
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.82);
    letter-spacing: 2px;
    margin: 0;
`;

const CardBalanceLabel = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    margin: 0;
`;

const CardActionRow = styled.div`
    display: flex;
    gap: 6px;
    padding: 10px 12px;
    border-top: 1px solid rgba(255,255,255,0.15);
`;

const CardActionBtn = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border: none;
    border-radius: 20px;
    background: rgba(0,0,0,0.18);
    color: rgba(255,255,255,0.9);
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(0,0,0,0.28); }
    &:disabled { opacity: 0.4; cursor: default; }
`;

// No-card state

const NoCardPanel = styled.div`
    aspect-ratio: 1.586;
    border-radius: 18px;
    border: 2px dashed #8D969E;
    background: rgba(255, 255, 255, 0.02);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    &:hover {
       opacity: 0.7;
    }
`;

const NoCardInner = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px;
    text-align: center;
`;

const NoCardIcon = styled.div`
    width: 48px; height: 48px;
    border-radius: 24px;
    background: #4F55F1;
    color: #fff;
    display: grid; place-items: center;
`;

const NoCardTitle = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    margin: 0;
`;

const NoCardBody = styled.p`
    font-size: 12px;
    color: #8D969E;
    line-height: 1.5;
    margin: 0;
    max-width: 200px;
`;

const CreateCardBtn = styled.div`
    margin-top: 4px;
    padding: 9px 20px;
    background: #4F55F1;
    color: #fff;
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 700;
`;

// Bottom row


const BottomRow = styled.div`
    display: grid;
    grid-template-columns: ${p => p.$cols === 2 ? '1fr 1fr' : '1fr'};
    gap: 16px;
    align-items: stretch;
    border-radius: 24px;
    border: 2px solid #0f0f1130;
    padding: 0 25px 25px;

    @media (max-width: 900px) { grid-template-columns: 1fr 1fr; }
    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        border: none;
        padding: 20px 0 0;
        width: 95%;
        margin: 0 auto;
    }
`;

// Approval card

const ApprovalCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid #ffffff20;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,15,17,0.05);

    @media (max-width: 768px) { padding: 16px; }
`;

const ApprovalTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
`;

const ApprovalStatusBadge = styled.span`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 20px;
    background: ${p => (LIMIT_STATUS[p.$status] || LIMIT_STATUS.loading).badgeBg};
    color: ${p => (LIMIT_STATUS[p.$status] || LIMIT_STATUS.loading).accent};
`;

const ApprovalBarWrap = styled.div`display: flex; flex-direction: column; gap: 5px;`;

const SegmentedBar = styled.div`
    display: flex;
    gap: 2px;
    height: 10px;
    align-items: stretch;
`;

const BarSeg = styled.div`
    flex: 1;
    border-radius: 3px;
    background: ${p => p.$active ? 'transparent' : 'rgba(255,255,255,0.07)'};
    transition: background 0.4s;
`;

const ApprovalBarLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: #8D969E;
`;

const ApprovalActions = styled.div`
    display: flex;
    gap: 8px;
    flex-shrink: 0;
`;

const ApprovalGrantBtn = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    padding: 9px 16px;
    background: #4F55F1;
    color: #ffffff;
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.15s, transform 0.15s;
    &:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

// Activity card

const ActivityCard = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid #ffffff20;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,15,17,0.05);

    @media (max-width: 768px) { padding: 20px; }
`;

const ActivityHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
`;

const ActivityTitle = styled.h2`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.3px;
    white-space: nowrap;
`;

const ActivityRule = styled.div`
    flex: 1;
    height: 1px;
    background: rgba(15,15,17,0.08);
`;

const SeeAllBtn = styled.button`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #4F55F1;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    white-space: nowrap;
    transition: color 0.15s;
    &:hover { color: #0f0f11; }
`;

const TxList = styled.div`
    border-radius: 12px;
    overflow: hidden;
`;

const TxRow = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 0;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(15,15,17,0.02); }
`;

const TxAvatar = styled.div`
    width: 38px; height: 38px;
    flex-shrink: 0;
    border-radius: 19px;
    display: grid; place-items: center;
    background: ${p => p.$positive ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)'};
    color: ${p => p.$positive ? '#16a34a' : '#dc2626'};
`;

const TxMeta = styled.div`flex: 1; min-width: 0;`;

const TxName = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const TxDetail = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: #8D969E;
    margin: 0;
`;

const TxHashLink = styled.a`
    color: #8D969E60;
    text-decoration: none;
    margin-left: 2px;
    &:hover { text-decoration: underline; }
`;

const TxRight = styled.div`text-align: right; flex-shrink: 0;`;

const TxAmount = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: ${p => p.$positive ? '#00A87E' : '#dc2626'};
    margin: 0 0 2px;
`;

const TxTime = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: #8D969E;
    margin: 0;
`;

const TxDivider = styled.div`
    height: 1px;
    background: rgba(15,15,17,0.06);
    margin-left: 52px;
`;

const EmptyState = styled.div`
    padding: 36px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
`;

const EmptyTitle = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #8D969E;
    margin: 0;
`;

const EmptyBody = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
    line-height: 1.5;
    margin: 0;
    max-width: 240px;
`;

// Help card

const FxCard = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid #ffffff20;
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const FxCardHeader = styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
`;

const FxCardTitle = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
`;

const FxCardDate = styled.p`
    font-family: 'SF Mono', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    margin: 0;
`;

const FxPairList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0;
`;

const FxPairRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    &:last-child { border-bottom: none; }
`;

const FxPairLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.3px;
`;

const FxPairRate = styled.span`
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.88);
    letter-spacing: 0.5px;
`;

const HelpCard = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid #ffffff20;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(15,15,17,0.05);
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

const HelpIconWrap = styled.div`
    width: 36px; height: 36px;
    border-radius: 10px;
    background: rgba(79,85,241,0.15);
    color: #4F55F1;
    font-family: 'Saira', sans-serif;
    font-size: 18px;
    font-weight: 800;
    display: grid;
    place-items: center;
    flex-shrink: 0;
`;

const HelpTitle = styled.h3`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.2px;
`;

const HelpBody = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
    line-height: 1.6;
    margin: 0;
`;

const HelpLink = styled.a`
    display: inline-block;
    padding: 9px 16px;
    background: #4F55F1;
    color: #ffffff;
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 800;
    text-decoration: none;
    text-align: center;
    transition: opacity 0.15s, transform 0.15s;
    &:hover { opacity: 0.85; transform: translateY(-1px); }
`;

const HelpSecondary = styled.button`
    background: none;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    padding: 9px 16px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.55);
    cursor: pointer;
    text-align: center;
    transition: border-color 0.15s, color 0.15s;
    &:hover { border-color: rgba(255,255,255,0.28); color: rgba(255,255,255,0.85); }
`;

// Shared modal primitives

const ModalOverlay = styled.div`
    position: fixed; inset: 0;
    background: rgba(4,8,20,0.65);
    backdrop-filter: blur(6px);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 200px 20px 20px; z-index: 50;

    @media (max-width: 768px) {
        align-items: flex-start;
        padding: 16px;
    }
`;

const ModalHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 22px 22px 0;
`;

const ModalHeaderTitle = styled.h3`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
`;

const ModalHeaderSub = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
    margin: 0;
`;

const ModalCloseBtn = styled.button`
    width: 32px; height: 32px;
    display: grid; place-items: center;
    background: #8D969E30;
    border: none; border-radius: 8px;
    color: #8D969E;
    cursor: pointer; flex-shrink: 0;
    transition: opacity 0.15s;
    &:hover { opacity: 0.6; }
`;

const ModalBody = styled.div`
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

const ModalNote = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
    line-height: 1.6;
    margin: 0;
    text-align: center;
`;

const ModalMeta = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    color: #8D969E;
    text-align: center;
    margin: 8px 0;
`;

const ModalFooter = styled.div`
    display: flex;
    gap: 10px;
    padding: 0 22px 22px;
`;

const ModalCancelBtn = styled.button`
    flex: 1;
    padding: 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    cursor: pointer;
    transition: background 0.15s;
    &:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ModalConfirmBtn = styled.button`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 14px;
    background: #4F55F1;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,85,241,0.3); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ModalSpinner = styled.div`
    width: 28px; height: 28px;
    border: 2px solid rgba(255,255,255,0.15);
    border-top-color: #4F55F1;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
    margin: 8px auto;
`;

// Card details modal

const CardDetailsModal = styled.div`
    width: 100%; max-width: 400px;
    background: #121212;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.4);
    animation: ${fadeUp} 0.22s ease both;
`;

const DetailRow = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    &:first-of-type { padding-top: 0; }
    &:last-of-type { border-bottom: none; padding-bottom: 0; }
`;

const DetailLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
    font-weight: 500;
`;

const DetailValue = styled.span`
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 0.5px;
`;

const ActivateBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    padding: 14px;
    background: #4F55F1;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,85,241,0.3); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

// Approval modal

const ApprovalModal = styled.div`
    width: 100%; max-width: 420px;
    background: #121212;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 8px 40px rgba(9,0,34,0.4);
    animation: ${fadeUp} 0.22s ease both;
`;

const ApprovalModalTitle = styled.h3`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 4px;
`;

const ApprovalModalClose = styled.button`
    width: 32px; height: 32px;
    display: grid; place-items: center;
    background: #8D969E30;
    border: none; border-radius: 8px;
    color: #8D969E;
    cursor: pointer; flex-shrink: 0;
    transition: opacity 0.15s;
    &:hover { opacity: 0.6; }
`;

const ApprovalTokenBox = styled.div`
    background: rgba(255, 255, 255, 0.1);
    border: 1.5px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 16px;
`;

const ApprovalTokenRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const ApprovalAmountLabel = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #8D969E;
    margin-bottom: 10px;
`;

const ApprovalBalanceHint = styled.span`
    font-size: 11px;
    font-weight: 600;
    color: #8D969E;
    cursor: pointer;
    transition: color 0.2s;
    &:hover { color: #ffffff; }
`;

const ApprovalAmountInput = styled.input`
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 28px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.5px;
    min-width: 0;
    &::placeholder { color: #8D969E50; }
    &:disabled { opacity: 0.5; }
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button { -webkit-appearance: none; }
    -moz-appearance: textfield;
`;

const ApprovalAmountToken = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    background: #4F55F1;
    border-radius: 8px;
    padding: 6px 12px;
    white-space: nowrap;
    flex-shrink: 0;
`;

const ApprovalModalNote = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: #8D969E;
    line-height: 1.6;
    margin: 0;
    text-align: center;
`;

// Shared spinner

const TinySpinner = styled.div`
    width: 12px; height: 12px;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
    flex-shrink: 0;
`;

// Tutorial overlay (step 2)

const spotPulse2 = keyframes`
    0%, 100% { border-color: rgba(79,85,241,0.65); }
    50%       { border-color: rgba(79,85,241,1); box-shadow: 0 0 0 9999px rgba(0,0,0,0.62), 0 0 18px rgba(79,85,241,0.25); }
`;

const tourFadeIn2 = keyframes`
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const TourSpotlight = styled.div`
    position: fixed;
    border-radius: 12px;
    border: 2px solid rgba(79,85,241,0.65);
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.62);
    pointer-events: none;
    z-index: 500;
    animation: ${spotPulse2} 2.2s ease infinite;
`;

const TourCard = styled.div`
    position: fixed;
    z-index: 501;
    width: 288px;
    background: #13131f;
    border: 1px solid rgba(79,85,241,0.3);
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(79,85,241,0.08) inset;
    animation: ${tourFadeIn2} 0.35s ease both;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const TourArrow = styled.div`
    position: absolute;
    top: -7px;
    right: 22px;
    width: 12px;
    height: 12px;
    background: #13131f;
    border-top: 1px solid rgba(79,85,241,0.3);
    border-left: 1px solid rgba(79,85,241,0.3);
    transform: rotate(45deg);
`;

const TourStepPill = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba(79,85,241,0.12);
    border: 1px solid rgba(79,85,241,0.28);
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    color: #7b81f5;
    align-self: flex-start;
`;

const TourTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 17px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.3px;
`;

const TourBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    line-height: 1.65;
    margin: 0;
`;

const TourSkip = styled.button`
    background: none;
    border: none;
    padding: 0;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.22);
    cursor: pointer;
    text-align: left;
    transition: color 0.2s;
    &:hover { color: rgba(255,255,255,0.55); }
`;

export default DashboardPage;
