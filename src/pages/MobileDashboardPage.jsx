import { useState, useEffect, useCallback, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import {
    Eye, EyeOff, ArrowDownLeft, ArrowUpRight,
    Plus, Copy, Check, Wallet, ChevronDown, ChevronRight,
    X, ArrowLeftRight, Droplets, Snowflake, MoreHorizontal,
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

// ─── constants ───────────────────────────────────────────────────────────────

const TAPUSDC_ADDRESS = '0xCb96C70be34cd6484e69D1BEd5ad2F22602191e3';
const TAPEURC_ADDRESS = '0x36247A653A1253A96a286f5E296c06fF958b1ac0';

const LIMIT_ABI = [
    'function getAvailableSpendingToday(address account) view returns (uint256)',
    'function dailySpendingLimit(address account) view returns (uint256)',
    'function globalDailyLimit() view returns (uint256)',
    'function setDailySpendingLimit(uint256 newLimit) external',
];

const limitIface = new ethers.Interface(LIMIT_ABI);

const SEG_COUNT = 16;

// ─── utilities ───────────────────────────────────────────────────────────────

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
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000)    return (n / 1000).toFixed(2) + 'K';
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const segColor = (t) => {
    if (t < 0.5) {
        const t2 = t * 2;
        return `rgb(${Math.round(34 + (245-34)*t2)},${Math.round(197 + (158-197)*t2)},${Math.round(94 + (11-94)*t2)})`;
    }
    const t2 = (t - 0.5) * 2;
    return `rgb(${Math.round(245 + (239-245)*t2)},${Math.round(158 + (68-158)*t2)},${Math.round(11 + (68-11)*t2)})`;
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

// ─── component ───────────────────────────────────────────────────────────────

const MobileDashboardPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isConnected, address, balances, fetchBalances, connector, walletType } = useWallet();
    const walletInfo = useWalletInfo(walletType, connector);
    const shortAddr  = (a) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : '';

    const [activeCurrency, setActiveCurrency] = useState(() => localStorage.getItem('kodaCurrency') || 'TAPUSDC');
    const [hidden,         setHidden]         = useState(false);
    const [showWrap,       setShowWrap]       = useState(false);
    const [showUnwrap,     setShowUnwrap]     = useState(false);
    const [showBridge,     setShowBridge]     = useState(false);
    const [showCardDetails,setShowCardDetails]= useState(false);
    const [fetchedCard,    setFetchedCard]    = useState(null);
    const [cardDetailsBusy,setCardDetailsBusy]= useState(false);
    const [activating,     setActivating]     = useState(false);
    const [activateError,  setActivateError]  = useState('');
    const [card,           setCard]           = useState(null);
    const [cardDetails,    setCardDetails]    = useState(null);
    const [cardLoading,    setCardLoading]    = useState(true);
    const [transactions,   setTransactions]   = useState([]);
    const [txLoading,      setTxLoading]      = useState(false);
    const [copied,         setCopied]         = useState(false);
    const [fxRates,        setFxRates]        = useState(null);
    const [fxDate,         setFxDate]         = useState(null);
    const [dailyAvailable, setDailyAvailable] = useState(null);
    const [dailyLimit,     setDailyLimit]     = useState(null);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [limitInput,     setLimitInput]     = useState('');
    const [limitBusy,      setLimitBusy]      = useState(false);

    const isEUR       = activeCurrency === 'TAPEURC';
    const baseBalance = isEUR ? balances.TAPEURC : balances.TAPUSDC;
    const stabBalance = isEUR ? balances.EURC    : balances.USDC;
    const stabLabel   = isEUR ? 'EURC'           : 'USDC';

    const switchCurrency = (c) => {
        setActiveCurrency(c);
        localStorage.setItem('kodaCurrency', c);
    };

    // Tutorial
    const { tourStep, setTourStep, dismissTour } = useTutorial();
    const faucetRef    = useRef(null);
    const [faucetRect,    setFaucetRect]    = useState(null);
    const wrapRef      = useRef(null);
    const [wrapRect,      setWrapRect]      = useState(null);
    const cardPanelRef = useRef(null);
    const [cardPanelRect, setCardPanelRect] = useState(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (tourStep !== 2) return;
        if (parseFloat(balances.USDC || '0') >= 1) setTourStep(3);
    }, [tourStep]);

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

    // Balance snapshot
    useEffect(() => {
        if (balances.TAPUSDC || balances.USDC || balances.TAPEURC || balances.EURC) {
            recordBalanceSnapshot(balances.TAPUSDC, balances.USDC, balances.TAPEURC, balances.EURC);
        }
    }, [balances.TAPUSDC, balances.USDC, balances.TAPEURC, balances.EURC]);

    // FX rates
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

    // Card + transactions
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
                            const match = dbTx.find(d => Math.abs(d.usd_cents) === Math.round(auth.amount * 100) && d.transaction_hash);
                            return { ...auth, txHash: match?.transaction_hash || null };
                        });
                        merged.sort((a, b) => new Date(b.created) - new Date(a.created));
                        setTransactions(merged.slice(0, 10));
                    }
                } catch { /* non-fatal */ }
                finally { setTxLoading(false); }
            }
        }).catch(() => {}).finally(() => setCardLoading(false));
    }, []);

    // Daily limit
    const fetchDailyLimit = useCallback(async () => {
        if (!address) return;
        const contractAddr = activeCurrency === 'TAPEURC' ? TAPEURC_ADDRESS : TAPUSDC_ADDRESS;
        const [available, personal, global] = await Promise.all([
            rawLimitCall('getAvailableSpendingToday', [address], contractAddr),
            rawLimitCall('dailySpendingLimit',        [address], contractAddr),
            rawLimitCall('globalDailyLimit',          [],        contractAddr),
        ]);
        const effectiveLimit = (personal != null && personal > 0n) ? personal : (global ?? 0n);
        setDailyAvailable(available ?? 0n);
        setDailyLimit(effectiveLimit);
    }, [address, activeCurrency]);

    useEffect(() => { setDailyAvailable(null); setDailyLimit(null); }, [activeCurrency]);
    useEffect(() => { fetchDailyLimit(); }, [fetchDailyLimit]);

    const dailySpent   = dailyLimit !== null && dailyAvailable !== null ? dailyLimit - dailyAvailable : null;
    const dailyUsedPct = dailyLimit && dailyLimit > 0n ? Math.min(100, Number((dailySpent * 100n) / dailyLimit)) : 0;
    const limitStatus  = dailyLimit === null ? 'loading' : dailyUsedPct >= 100 ? 'exhausted' : dailyUsedPct >= 75 ? 'low' : 'ok';

    const handleSetLimit = async () => {
        if (!connector || !limitInput || parseFloat(limitInput) < 0) return;
        setLimitBusy(true);
        try {
            const provider = new ethers.BrowserProvider(connector.provider);
            const signer   = await provider.getSigner();
            const contractAddr = activeCurrency === 'TAPEURC' ? TAPEURC_ADDRESS : TAPUSDC_ADDRESS;
            const tapusdc  = new ethers.Contract(contractAddr, LIMIT_ABI, signer);
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

    const handleViewCardDetails = async () => {
        if (!card) return;
        setCardDetailsBusy(true);
        setShowCardDetails(true);
        setFetchedCard(null);
        setActivateError('');
        try {
            const details = await axios.post(`${import.meta.env.VITE_API_URL}/retrieve-card-details`, { cardId: card.card_id });
            const d = details.data.cardDetails || details.data.card || details.data;
            setFetchedCard(d);
        } catch { setFetchedCard(null); }
        finally { setCardDetailsBusy(false); }
    };

    const handleCopyCardNumber = async () => {
        if (!cardDetails?.card_number) return;
        try {
            await navigator.clipboard.writeText(cardDetails.card_number);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    const handleActivateCard = async () => {
        if (!connector || !fetchedCard) return;
        setActivating(true);
        setActivateError('');
        try {
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/activate-card`, { cardId: fetchedCard.id || card.card_id });
            if (res.data.success) {
                setFetchedCard(prev => ({ ...prev, status: 'active' }));
            } else {
                setActivateError(res.data.message || 'Activation failed');
            }
        } catch (err) {
            setActivateError(err.response?.data?.message || 'Activation failed');
        } finally { setActivating(false); }
    };

    // ─── render ────────────────────────────────────────────────────────────────

    return (
      <>
        <Page>

            {/* ── Wallet ── */}
            <SectionGroup>
                <SectionTitle>Wallet</SectionTitle>
                <Card>
                    <CurrencyToggleBar>
                        <CurrencyOpt $active={!isEUR} onClick={() => switchCurrency('TAPUSDC')}>TAPUSDC</CurrencyOpt>
                        <CurrencyOpt $active={isEUR}  onClick={() => switchCurrency('TAPEURC')}>TAPEURC</CurrencyOpt>
                    </CurrencyToggleBar>

                    <WalletRow>
                        <WalletBadge>
                            {walletInfo?.icon
                                ? <WalletLogo src={walletInfo.icon} alt={walletInfo.name} />
                                : <WalletFallback><Wallet size={14} /></WalletFallback>
                            }
                            <WalletMeta>
                                <WalletNameRow>
                                    <WalletName>{walletInfo?.name ?? 'My Wallet'}</WalletName>
                                    <ChevronDown size={12} color="#8D969E" />
                                </WalletNameRow>
                                <WalletAddr>{shortAddr(address)}</WalletAddr>
                            </WalletMeta>
                        </WalletBadge>
                        <ViewBtn onClick={() => navigate('/wallet')}>View</ViewBtn>
                    </WalletRow>

                    <BalancePad>
                        <BalanceLabel>Total Balance</BalanceLabel>
                        <BalanceRow>
                            <BalanceAmt>{hidden ? '••••••' : fmt(baseBalance)}</BalanceAmt>
                            <CurrencyPill>
                                <EyeToggle onClick={() => setHidden(h => !h)}>
                                    {hidden ? <Eye size={11} /> : <EyeOff size={11} />}
                                </EyeToggle>
                                {activeCurrency}
                            </CurrencyPill>
                        </BalanceRow>
                        <SecondaryRow>
                            <SecondaryAmt>{hidden ? '••••' : fmt(stabBalance)}</SecondaryAmt>
                            <SecondaryCcy>{stabLabel}</SecondaryCcy>
                            <SecondaryDot />
                            <SecondaryHint>in wallet</SecondaryHint>
                        </SecondaryRow>
                    </BalancePad>
                </Card>
            </SectionGroup>

            {/* ── Actions ── */}
            <SectionGroup>
                <SectionTitle>Actions</SectionTitle>
                <Card $noPad>
                    <ActionRow ref={wrapRef} onClick={tourStep === 3 ? advanceStep3 : () => setShowWrap(true)}>
                        <ArrowDownLeft size={15} color="rgba(255,255,255,0.45)" />
                        <ActionLabel>Wrap</ActionLabel>
                        <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                    </ActionRow>
                    <ActionDivider />
                    <ActionRow onClick={() => setShowUnwrap(true)}>
                        <ArrowUpRight size={15} color="rgba(255,255,255,0.45)" />
                        <ActionLabel>Unwrap</ActionLabel>
                        <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                    </ActionRow>
                    <ActionDivider />
                    <ActionRow onClick={() => setShowBridge(true)}>
                        <ArrowLeftRight size={15} color="rgba(255,255,255,0.45)" />
                        <ActionLabel>Bridge</ActionLabel>
                        <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                    </ActionRow>
                    <ActionDivider />
                    <ActionRow
                        ref={faucetRef}
                        as="a"
                        href="https://faucet.circle.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={tourStep === 2 ? advanceStep2 : undefined}
                    >
                        <Droplets size={15} color="rgba(255,255,255,0.45)" />
                        <ActionLabel>Get USDC / EURC</ActionLabel>
                        <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                    </ActionRow>
                </Card>
            </SectionGroup>

            {/* ── Your Card ── */}
            <SectionGroup>
                <SectionTitle>Your Card</SectionTitle>
                {cardLoading ? (
                    <Card><CardSkeleton /></Card>
                ) : card ? (
                    <Card $noPad>
                        <VisualCard>
                            <CardTopRow>
                                <CardWordmark>koda</CardWordmark>
                                <CardBalanceAmt>{fmt(balances[activeCurrency])}</CardBalanceAmt>
                            </CardTopRow>
                            <CardMidRow>
                                <ChipBlock>
                                    <ChipSvg />
                                </ChipBlock>
                                <CardNumRow>
                                    <CardNum>{cardDetails?.last4 ? `•••• •••• •••• ${cardDetails.last4}` : '•••• •••• •••• ••••'}</CardNum>
                                    <CardBalLabel>{activeCurrency}</CardBalLabel>
                                </CardNumRow>
                            </CardMidRow>
                        </VisualCard>
                        <CardActionsRow>
                            <CardActionBtn onClick={handleViewCardDetails}>
                                <Eye size={14} /><span>Details</span>
                            </CardActionBtn>
                            <CardActionBtn onClick={handleCopyCardNumber} disabled={!cardDetails?.card_number}>
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </CardActionBtn>
                            <CardActionBtn>
                                <Snowflake size={14} /><span>Freeze</span>
                            </CardActionBtn>
                            <CardActionBtn>
                                <MoreHorizontal size={14} /><span>More</span>
                            </CardActionBtn>
                        </CardActionsRow>
                    </Card>
                ) : (
                    <NoCardPanel ref={cardPanelRef} onClick={tourStep === 4 ? advanceStep4 : () => navigate('/createcard')}>
                        <NoCardIcon><Plus size={20} /></NoCardIcon>
                        <NoCardTitle>Create your Koda card</NoCardTitle>
                        <NoCardBody>A virtual Visa card that spends TAPUSDC directly from your self-custody wallet.</NoCardBody>
                        <CreateCardBtn>Get your card</CreateCardBtn>
                    </NoCardPanel>
                )}
            </SectionGroup>

            {/* ── Spending ── */}
            {isConnected && (
                <SectionGroup>
                    <SectionTitle>Spending</SectionTitle>
                    <Card>
                        <SpendHeader>
                            <SpendLabel>Daily spending limit</SpendLabel>
                            <SetLimitBtn onClick={() => { setLimitInput(dailyLimit ? ethers.formatUnits(dailyLimit, 6) : ''); setShowLimitModal(true); }}>
                                Set limit
                            </SetLimitBtn>
                        </SpendHeader>
                        <SegBar>
                            {Array.from({ length: SEG_COUNT }, (_, i) => {
                                const active = i < Math.round(dailyUsedPct / 100 * SEG_COUNT);
                                return <Seg key={i} $active={active} style={active ? { background: segColor(i / (SEG_COUNT - 1)) } : undefined} />;
                            })}
                        </SegBar>
                        <SpendMeta>
                            {limitStatus !== 'loading' && (
                                <>{fmt(ethers.formatUnits(dailySpent ?? 0n, 6))} of {fmt(ethers.formatUnits(dailyLimit ?? 0n, 6))} {activeCurrency} used today</>
                            )}
                        </SpendMeta>
                    </Card>
                </SectionGroup>
            )}

            {/* ── Activity ── */}
            <SectionGroup>
                <SectionTitle>Activity</SectionTitle>
                <Card $noPad>
                    <ActivityHeader>
                        <ActivityTitle>Recent transactions</ActivityTitle>
                        {transactions.length > 0 && (
                            <SeeAllBtn onClick={() => navigate('/payments')}>See all</SeeAllBtn>
                        )}
                    </ActivityHeader>
                    {txLoading ? (
                        <EmptyState><EmptyTitle>Loading…</EmptyTitle></EmptyState>
                    ) : transactions.length === 0 ? (
                        <EmptyState>
                            <EmptyTitle>No activity yet</EmptyTitle>
                            <EmptyBody>Your transactions will appear here once you start spending.</EmptyBody>
                        </EmptyState>
                    ) : (
                        <TxList>
                            {transactions.map((tx, i) => {
                                const approved = tx.approved;
                                const formattedDate = new Date(tx.created).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div key={tx.id}>
                                        <TxRow>
                                            <TxAvatar $positive={approved}>
                                                {approved ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                            </TxAvatar>
                                            <TxMeta>
                                                <TxName>{tx.merchant || 'Card payment'}</TxName>
                                                <TxDetail>
                                                    {approved ? 'Approved' : 'Declined'}
                                                    {tx.txHash && (
                                                        <TxHashLink href={`${import.meta.env.VITE_EXPLORER_URL}/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer"> · on-chain</TxHashLink>
                                                    )}
                                                </TxDetail>
                                            </TxMeta>
                                            <TxRight>
                                                <TxAmt $positive={approved}>{approved ? '-' : ''}£{typeof tx.amount === 'number' ? tx.amount.toFixed(2) : tx.amount}</TxAmt>
                                                <TxTime>{formattedDate}</TxTime>
                                            </TxRight>
                                        </TxRow>
                                        {i < transactions.length - 1 && <TxDivider />}
                                    </div>
                                );
                            })}
                        </TxList>
                    )}
                </Card>
            </SectionGroup>

            {/* ── FX Rates ── */}
            <SectionGroup>
                <SectionTitle>FX Rates</SectionTitle>
                <Card>
                    {fxDate && <FxDate>ECB · {fxDate}</FxDate>}
                    <FxList>
                        {[
                            { label: 'GBP / USD', value: fxRates?.gbpUsd },
                            { label: 'GBP / EUR', value: fxRates?.gbpEur },
                            { label: 'EUR / USD', value: fxRates?.eurUsd },
                            { label: 'USD / EUR', value: fxRates?.usdEur },
                        ].map(({ label, value }) => (
                            <FxRow key={label}>
                                <FxLabel>{label}</FxLabel>
                                <FxValue>{value ? value.toFixed(4) : '—'}</FxValue>
                            </FxRow>
                        ))}
                    </FxList>
                </Card>
            </SectionGroup>

            {/* ── Balance History ── */}
            <SectionGroup>
                <SectionTitle>Balance History</SectionTitle>
                <Card $noPad>
                    <BalanceHistoryChart
                        tapusdcBalance={balances.TAPUSDC}
                        usdcBalance={balances.USDC}
                        tapeurcBalance={balances.TAPEURC}
                        eurcBalance={balances.EURC}
                    />
                </Card>
            </SectionGroup>

        </Page>

        {/* ── Overlays (modals) ── */}
        {showWrap && (
            <WrapComponent connector={connector} walletAddress={address}
                onClose={() => setShowWrap(false)}
                onSuccess={() => { setShowWrap(false); fetchBalances(); }} />
        )}
        {showUnwrap && (
            <UnwrapComponent connector={connector} walletAddress={address}
                onClose={() => setShowUnwrap(false)}
                onSuccess={() => { setShowUnwrap(false); fetchBalances(); }} />
        )}
        {showBridge && (
            <BridgeComponent connector={connector} walletAddress={address}
                onClose={() => setShowBridge(false)}
                onSuccess={() => { setShowBridge(false); fetchBalances(); }} />
        )}

        {showCardDetails && (
            <ModalOverlay onClick={(e) => e.target === e.currentTarget && setShowCardDetails(false)}>
                <ModalBox>
                    <ModalHead>
                        <ModalHeadTitle>Card details</ModalHeadTitle>
                        <ModalClose onClick={() => setShowCardDetails(false)}><X size={14} /></ModalClose>
                    </ModalHead>
                    {cardDetailsBusy && <ModalBody><ModalSpinner /><ModalMeta>Fetching details…</ModalMeta></ModalBody>}
                    {!cardDetailsBusy && !fetchedCard && <ModalBody><ModalMeta style={{ color: '#ef4444' }}>Could not retrieve card details.</ModalMeta></ModalBody>}
                    {!cardDetailsBusy && fetchedCard && (
                        <ModalBody>
                            <DetailRow><DetailLabel>Card number</DetailLabel><DetailValue>{fetchedCard.card_number?.replace(/(.{4})/g,'$1 ').trim()}</DetailValue></DetailRow>
                            <DetailRow><DetailLabel>Expiry</DetailLabel><DetailValue>{String(fetchedCard.exp_month).padStart(2,'0')}/{String(fetchedCard.exp_year).slice(-2)}</DetailValue></DetailRow>
                            <DetailRow><DetailLabel>CVV</DetailLabel><DetailValue>{fetchedCard.cvc}</DetailValue></DetailRow>
                            <DetailRow><DetailLabel>Name</DetailLabel><DetailValue>{fetchedCard.cardholder_name}</DetailValue></DetailRow>
                            <DetailRow>
                                <DetailLabel>Status</DetailLabel>
                                <DetailValue style={{ color: fetchedCard.status === 'active' ? '#22c55e' : '#f59e0b', textTransform: 'capitalize' }}>{fetchedCard.status}</DetailValue>
                            </DetailRow>
                            {fetchedCard.status !== 'active' && (
                                <>
                                    {activateError && <ModalNote style={{ color: '#ef4444' }}>{activateError}</ModalNote>}
                                    <ActivateBtn onClick={handleActivateCard} disabled={activating}>
                                        {activating ? <TinySpinner /> : null}{activating ? 'Activating…' : 'Activate card'}
                                    </ActivateBtn>
                                </>
                            )}
                            <ModalNote>These details are for testing only. Do not share them.</ModalNote>
                        </ModalBody>
                    )}
                </ModalBox>
            </ModalOverlay>
        )}

        {showLimitModal && (
            <ModalOverlay onClick={(e) => e.target === e.currentTarget && setShowLimitModal(false)}>
                <ModalBox>
                    <ModalHead>
                        <div>
                            <ModalHeadTitle>Set daily limit</ModalHeadTitle>
                            <ModalHeadSub>Max {activeCurrency} per day</ModalHeadSub>
                        </div>
                        <ModalClose onClick={() => setShowLimitModal(false)}><X size={14} /></ModalClose>
                    </ModalHead>
                    <ModalBody>
                        <LimitTokenBox>
                            <LimitAmtLabel>
                                <span>Daily limit</span>
                                <LimitBalHint onClick={() => setLimitInput(balances[activeCurrency] || '0')}>
                                    Balance: {fmt(balances[activeCurrency])} — Max
                                </LimitBalHint>
                            </LimitAmtLabel>
                            <LimitTokenRow>
                                <LimitInput type="number" placeholder="0.00" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} disabled={limitBusy} autoFocus />
                                <LimitToken>{activeCurrency}</LimitToken>
                            </LimitTokenRow>
                        </LimitTokenBox>
                    </ModalBody>
                    <ModalFooter>
                        <ModalConfirmBtn onClick={handleSetLimit} disabled={limitBusy || limitInput === ''}>
                            {limitBusy ? <><TinySpinner /> Confirming…</> : 'Confirm'}
                        </ModalConfirmBtn>
                    </ModalFooter>
                </ModalBox>
            </ModalOverlay>
        )}

        {/* ── Tutorial overlays ── */}
        {tourStep === 2 && faucetRect && (
            <>
                <TourSpotlight style={{ top: faucetRect.top-8, left: faucetRect.left-8, width: faucetRect.width+16, height: faucetRect.height+16 }} />
                <TourCard style={{ top: faucetRect.bottom+16, left: Math.max(8, faucetRect.left-8) }}>
                    <TourArrow style={{ left: 20, right: 'auto' }} />
                    <TourPill>Step 2 of 4</TourPill>
                    <TourTitle>Get some USDC</TourTitle>
                    <TourBody>You'll need USDC to wrap into TAPUSDC and spend with your Koda card. Click here to visit Circle's free testnet faucet. Funds arrive in seconds.</TourBody>
                    <TourSkip onClick={dismissTour}>Skip tutorial</TourSkip>
                </TourCard>
            </>
        )}
        {tourStep === 3 && wrapRect && (
            <>
                <TourSpotlight style={{ top: wrapRect.top-8, left: wrapRect.left-8, width: wrapRect.width+16, height: wrapRect.height+16 }} />
                <TourCard style={{ top: wrapRect.bottom+16, left: Math.max(8, wrapRect.left-8) }}>
                    <TourArrow style={{ left: 20, right: 'auto' }} />
                    <TourPill>Step 3 of 4</TourPill>
                    <TourTitle>Wrap your USDC</TourTitle>
                    <TourBody>Tap Wrap to convert your USDC into TAPUSDC, the spendable token on your Koda card. You can also wrap EURC into TAPEURC if you prefer euros.</TourBody>
                    <TourSkip onClick={dismissTour}>Skip tutorial</TourSkip>
                </TourCard>
            </>
        )}
        {tourStep === 4 && cardPanelRect && (
            <>
                <TourSpotlight style={{ top: cardPanelRect.top-8, left: cardPanelRect.left-8, width: cardPanelRect.width+16, height: cardPanelRect.height+16 }} />
                <TourCard style={{ top: cardPanelRect.bottom+16, left: Math.max(8, cardPanelRect.left-8) }}>
                    <TourArrow style={{ left: 20, right: 'auto' }} />
                    <TourPill>Step 4 of 4</TourPill>
                    <TourTitle>Create your card</TourTitle>
                    <TourBody>You are ready. Tap here to create your Koda virtual Visa card and start spending your TAPUSDC anywhere Visa is accepted.</TourBody>
                    <TourSkip onClick={dismissTour}>Skip tutorial</TourSkip>
                </TourCard>
            </>
        )}
      </>
    );
};

// ─── styled components ───────────────────────────────────────────────────────

const fadeIn = keyframes`from{opacity:0}to{opacity:1}`;
const spin   = keyframes`to{transform:rotate(360deg)}`;
const shimmer = keyframes`0%{background-position:-300px 0}100%{background-position:300px 0}`;
const spotPulse = keyframes`
    0%,100%{border-color:rgba(79,85,241,0.65)}
    50%{border-color:rgba(79,85,241,1);box-shadow:0 0 0 9999px rgba(0,0,0,0.62),0 0 18px rgba(79,85,241,0.25)}
`;
const tourFadeIn = keyframes`from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}`;

const Page = styled.div`
    min-height: 100%;
    background: #000000;
    padding: 16px 0 80px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: ${fadeIn} 0.25s ease both;
`;

const SectionGroup = styled.div`
    width: 95%;
    margin: 0 auto;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #ffffff05;
    padding: 10px;
    border-radius: 24px;
`;

const SectionTitle = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: rgba(255,255,255,0.8);
    margin-left: 10px;
    letter-spacing: -0.1px;
`;

const Card = styled.div`
    background: #111114;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    overflow: hidden;
    box-sizing: border-box;
    ${p => !p.$noPad && css`padding: 16px;`}
`;

// Wallet card
const CurrencyToggleBar = styled.div`
    display: flex;
    background: rgba(255,255,255,0.05);
    border-radius: 10px;
    padding: 3px;
    margin-bottom: 14px;
    gap: 2px;
`;

const CurrencyOpt = styled.button`
    flex: 1;
    padding: 6px;
    border-radius: 8px;
    border: none;
    background: ${p => p.$active ? 'rgba(255,255,255,0.1)' : 'transparent'};
    color: ${p => p.$active ? '#ffffff' : 'rgba(255,255,255,0.35)'};
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.2px;
`;

const WalletRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
`;

const WalletBadge = styled.div`display: flex; align-items: center; gap: 10px;`;

const WalletLogo = styled.img`
    width: 32px; height: 32px;
    border-radius: 50%;
    object-fit: contain;
`;

const WalletFallback = styled.div`
    width: 32px; height: 32px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
    display: grid; place-items: center;
    color: rgba(255,255,255,0.5);
`;

const WalletMeta = styled.div`display: flex; flex-direction: column; gap: 1px;`;
const WalletNameRow = styled.div`display: flex; align-items: center; gap: 4px;`;

const WalletName = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
`;

const WalletAddr = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.35);
`;

const ViewBtn = styled.button`
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.12);
    background: transparent;
    color: rgba(255,255,255,0.55);
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    &:hover { border-color: rgba(255,255,255,0.25); color: #ffffff; }
`;

const BalancePad = styled.div``;
const BalanceLabel = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 500;
    color: rgba(255,255,255,0.35);
    margin: 0 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const BalanceRow = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;

const BalanceAmt = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 34px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -1px;
    line-height: 1;
`;

const CurrencyPill = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 6px;
    background: rgba(255,255,255,0.07);
    border-radius: 20px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 700;
    color: rgba(255,255,255,0.55);
    letter-spacing: 0.3px;
`;

const EyeToggle = styled.button`
    background: none; border: none; padding: 0;
    display: grid; place-items: center;
    color: rgba(255,255,255,0.45); cursor: pointer;
    transition: color 0.15s;
    &:hover { color: #ffffff; }
`;

const SecondaryRow = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 6px;
`;

const SecondaryAmt = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.5);
`;

const SecondaryCcy = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.3);
`;

const SecondaryDot = styled.div`
    width: 2px; height: 2px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
`;

const SecondaryHint = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.25);
`;

// Actions
const ActionRow = styled.button`
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 14px 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.12s;
    &:hover { background: rgba(255,255,255,0.04); }
    &:active { background: rgba(255,255,255,0.07); }
`;

const ActionLabel = styled.span`
    flex: 1;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.8);
    text-align: left;
`;

const ActionDivider = styled.div`
    height: 1px;
    background: rgba(255,255,255,0.05);
    margin: 0 16px;
`;

// Visual card
const VisualCard = styled.div`
    margin: 16px;
    border-radius: 14px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    overflow: hidden;
    &::after {
        content: '';
        position: absolute;
        top: -40%;
        right: -20%;
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(79,85,241,0.12) 0%, transparent 70%);
        pointer-events: none;
    }
`;

const CardTopRow = styled.div`display: flex; align-items: flex-start; justify-content: space-between;`;

const CardWordmark = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 17px;
    font-weight: 800;
    color: rgba(255,255,255,0.9);
    letter-spacing: -0.3px;
`;

const CardBalanceAmt = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
`;

const CardMidRow = styled.div`display: flex; align-items: center; justify-content: space-between;`;

const ChipBlock = styled.div``;

const CardNumRow = styled.div`display: flex; flex-direction: column; align-items: flex-end; gap: 2px;`;

const CardNum = styled.span`
    font-family: 'Google Sans Flex', monospace;
    font-size: 13px;
    color: rgba(255,255,255,0.75);
    letter-spacing: 1px;
`;

const CardBalLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    color: rgba(255,255,255,0.35);
    letter-spacing: 0.3px;
    text-transform: uppercase;
`;

const CardActionsRow = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border-top: 1px solid rgba(255,255,255,0.06);
`;

const CardActionBtn = styled.button`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 12px 4px;
    background: none;
    border: none;
    border-right: 1px solid rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.5);
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.15s, background 0.12s;
    &:last-child { border-right: none; }
    &:hover:not(:disabled) { color: #ffffff; background: rgba(255,255,255,0.04); }
    &:disabled { opacity: 0.3; cursor: not-allowed; }
`;

const CardSkeleton = styled.div`
    height: 140px;
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 600px 100%;
    animation: ${shimmer} 1.4s ease infinite;
    margin: 16px;
    border-radius: 12px;
`;

// No card
const NoCardPanel = styled.button`
    width: 100%;
    padding: 24px 20px;
    background: #111114;
    border: 1.5px dashed rgba(255,255,255,0.1);
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    box-sizing: border-box;
    transition: border-color 0.15s;
    &:hover { border-color: rgba(79,85,241,0.4); }
`;

const NoCardIcon = styled.div`
    width: 40px; height: 40px;
    border-radius: 12px;
    background: rgba(79,85,241,0.1);
    border: 1px solid rgba(79,85,241,0.2);
    display: grid; place-items: center;
    color: #7b81f5;
`;

const NoCardTitle = styled.p`
    font-family: 'Saira', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
`;

const NoCardBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    line-height: 1.5;
    margin: 0;
    text-align: center;
    max-width: 260px;
`;

const CreateCardBtn = styled.span`
    margin-top: 4px;
    padding: 8px 20px;
    background: #4F55F1;
    color: #ffffff;
    border-radius: 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 700;
`;

// Spending
const SpendHeader = styled.div`display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;`;

const SpendLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.6);
`;

const SetLimitBtn = styled.button`
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.12);
    background: transparent;
    color: rgba(255,255,255,0.55);
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    &:hover { border-color: rgba(255,255,255,0.25); color: #ffffff; }
`;

const SegBar = styled.div`
    display: flex;
    gap: 2px;
    margin-bottom: 8px;
`;

const Seg = styled.div`
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: ${p => p.$active ? undefined : 'rgba(255,255,255,0.08)'};
`;

const SpendMeta = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    margin: 0;
`;

// Activity
const ActivityHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
`;

const ActivityTitle = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.6);
`;

const SeeAllBtn = styled.button`
    background: none; border: none;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px; font-weight: 600;
    color: rgba(79,85,241,0.8);
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
    &:hover { color: #7b81f5; }
`;

const EmptyState = styled.div`
    padding: 28px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
`;

const EmptyTitle = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    margin: 0;
`;

const EmptyBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.2);
    margin: 0;
    text-align: center;
`;

const TxList = styled.div`padding: 4px 0;`;

const TxRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
`;

const TxAvatar = styled.div`
    width: 32px; height: 32px;
    border-radius: 10px;
    background: ${p => p.$positive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};
    color: ${p => p.$positive ? '#22c55e' : '#ef4444'};
    display: grid; place-items: center;
    flex-shrink: 0;
`;

const TxMeta = styled.div`flex: 1; min-width: 0;`;

const TxName = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.85);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const TxDetail = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    margin: 0;
`;

const TxHashLink = styled.a`
    color: rgba(79,85,241,0.7);
    text-decoration: none;
    &:hover { color: #7b81f5; }
`;

const TxRight = styled.div`display: flex; flex-direction: column; align-items: flex-end; gap: 2px;`;

const TxAmt = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: ${p => p.$positive ? '#ef4444' : 'rgba(255,255,255,0.5)'};
    font-variant-numeric: tabular-nums;
`;

const TxTime = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    color: rgba(255,255,255,0.2);
`;

const TxDivider = styled.div`height: 1px; background: rgba(255,255,255,0.04); margin: 0 16px;`;

// FX
const FxDate = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.25);
    margin: 0 0 10px;
`;

const FxList = styled.div`display: flex; flex-direction: column; gap: 10px;`;

const FxRow = styled.div`display: flex; align-items: center; justify-content: space-between;`;

const FxLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.45);
`;

const FxValue = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    font-variant-numeric: tabular-nums;
`;

// Modals
const ModalOverlay = styled.div`
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 0 env(safe-area-inset-bottom, 0);
    z-index: 200;
`;

const ModalBox = styled.div`
    width: 100%;
    max-width: 480px;
    background: #18181c;
    border-radius: 24px 24px 0 0;
    border: 1px solid rgba(255,255,255,0.08);
    overflow: hidden;
`;

const ModalHead = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 18px 14px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
`;

const ModalHeadTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
`;

const ModalHeadSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.35);
    margin: 2px 0 0;
`;

const ModalClose = styled.button`
    width: 28px; height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.5);
    display: grid; place-items: center;
    cursor: pointer;
    &:hover { color: #ffffff; }
`;

const ModalBody = styled.div`
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const ModalSpinner = styled.div`
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.15);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
    margin: 0 auto;
`;

const ModalMeta = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.4);
    margin: 0;
    text-align: center;
`;

const DetailRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    &:last-of-type { border-bottom: none; }
`;

const DetailLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.35);
`;

const DetailValue = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.85);
    font-variant-numeric: tabular-nums;
`;

const ModalNote = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.25);
    margin: 0;
`;

const ModalFooter = styled.div`padding: 0 18px 18px;`;

const ModalConfirmBtn = styled.button`
    width: 100%;
    padding: 13px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 0.2s;
    &:hover:not(:disabled) { opacity: 0.85; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const ActivateBtn = styled(ModalConfirmBtn)`background: #22c55e;`;

const LimitTokenBox = styled.div`
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const LimitAmtLabel = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.35);
`;

const LimitBalHint = styled.button`
    background: none; border: none; padding: 0;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(79,85,241,0.7);
    cursor: pointer;
    &:hover { color: #7b81f5; }
`;

const LimitTokenRow = styled.div`display: flex; align-items: center; gap: 10px;`;

const LimitInput = styled.input`
    flex: 1;
    background: none;
    border: none;
    font-family: 'Saira', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    outline: none;
    min-width: 0;
    &::placeholder { color: rgba(255,255,255,0.15); }
    &:disabled { opacity: 0.4; }
`;

const LimitToken = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.35);
    letter-spacing: 0.3px;
    white-space: nowrap;
`;

const TinySpinner = styled.div`
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
    flex-shrink: 0;
`;

// Tutorial
const TourSpotlight = styled.div`
    position: fixed;
    border-radius: 12px;
    border: 2px solid rgba(79,85,241,0.65);
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.62);
    pointer-events: none;
    z-index: 500;
    animation: ${spotPulse} 2.2s ease infinite;
`;

const TourCard = styled.div`
    position: fixed;
    z-index: 501;
    width: min(288px, calc(100vw - 24px));
    background: #13131f;
    border: 1px solid rgba(79,85,241,0.3);
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(79,85,241,0.08) inset;
    animation: ${tourFadeIn} 0.35s ease both;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const TourArrow = styled.div`
    position: absolute;
    top: -7px;
    right: 22px;
    width: 12px; height: 12px;
    background: #13131f;
    border-top: 1px solid rgba(79,85,241,0.3);
    border-left: 1px solid rgba(79,85,241,0.3);
    transform: rotate(45deg);
`;

const TourPill = styled.span`
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
    background: none; border: none; padding: 0;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.22);
    cursor: pointer;
    text-align: left;
    transition: color 0.2s;
    &:hover { color: rgba(255,255,255,0.55); }
`;

// SVG chip (reused from desktop)
const ChipSvg = () => (
    <svg width="32" height="24" viewBox="0 0 36 28" fill="none">
        <rect width="36" height="28" rx="5" fill="url(#chipM)" />
        <rect x="13" y="0"  width="10" height="28" fill="rgba(0,0,0,0.08)" />
        <rect x="0"  y="9"  width="36" height="10" fill="rgba(0,0,0,0.08)" />
        <rect x="13" y="9"  width="10" height="10" fill="rgba(0,0,0,0.05)" />
        <defs>
            <linearGradient id="chipM" x1="0" y1="0" x2="36" y2="28" gradientUnits="userSpaceOnUse">
                <stop stopColor="#f6d365" />
                <stop offset="1" stopColor="#c9a227" />
            </linearGradient>
        </defs>
    </svg>
);

export default MobileDashboardPage;
