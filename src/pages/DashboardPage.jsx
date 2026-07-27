import { useState, useEffect, useCallback } from 'react';
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
import BalanceHistoryChart, { recordBalanceSnapshot } from '../components/BalanceHistoryChart.jsx';

const TAPUSDC_ADDRESS   = '0xCb96C70be34cd6484e69D1BEd5ad2F22602191e3';
const LIMIT_ABI = [
    'function getAvailableSpendingToday(address account) view returns (uint256)',
    'function dailySpendingLimit(address account) view returns (uint256)',
    'function globalDailyLimit() view returns (uint256)',
    'function setDailySpendingLimit(uint256 newLimit) external',
];

const limitIface   = new ethers.Interface(LIMIT_ABI);

async function rawLimitCall(sig, args = [], retries = 3) {
    const data = limitIface.encodeFunctionData(sig, args);
    for (let i = 0; i < retries; i++) {
        try {
            const result = await arcSend('eth_call', [{ to: TAPUSDC_ADDRESS, data }, 'latest']);
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

    useEffect(() => {
        if (balances.TAPUSDC || balances.USDC) {
            recordBalanceSnapshot(balances.TAPUSDC, balances.USDC);
        }
    }, [balances.TAPUSDC, balances.USDC]);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (!token) { setCardLoading(false); return; }

        axios.get('https://chainfree.site:7001/user/cards', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(async res => {
            if (res.data.success && res.data.data?.length > 0) {
                const userCard = res.data.data[0];
                setCard(userCard);
                try {
                    const details = await axios.post('https://chainfree.site:7000/retrieve-card-details', { cardId: userCard.card_id });
                    const d = details.data.cardDetails || details.data.card || details.data;
                    setCardDetails(d);
                } catch { /* non-fatal */ }
                try {
                    setTxLoading(true);
                    const txRes = await axios.get(`https://chainfree.site:7000/card-transactions/${userCard.card_id}`);
                    if (txRes.data.success) {
                        const auths = txRes.data.stripe_authorizations || [];
                        const dbTx  = txRes.data.database_transactions  || [];
                        const merged = auths.map(auth => {
                            const match = dbTx.find(d =>
                                Math.abs(d.usd_cents) === Math.round(auth.amount * 100) && d.transaction_hash
                            );
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

    const [dailyAvailable,   setDailyAvailable]   = useState(null);
    const [dailyLimit,       setDailyLimit]       = useState(null);
    const [showLimitModal,   setShowLimitModal]   = useState(false);
    const [limitInput,       setLimitInput]       = useState('');
    const [limitBusy,        setLimitBusy]        = useState(false);

    const fetchDailyLimit = useCallback(async () => {
        if (!address) return;
        const [available, personal, global] = await Promise.all([
            rawLimitCall('getAvailableSpendingToday', [address]),
            rawLimitCall('dailySpendingLimit', [address]),
            rawLimitCall('globalDailyLimit'),
        ]);
        const effectiveLimit = (personal != null && personal > 0n) ? personal : (global ?? 0n);
        setDailyAvailable(available ?? 0n);
        setDailyLimit(effectiveLimit);
    }, [address]);

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
            const tapusdc  = new ethers.Contract(TAPUSDC_ADDRESS, LIMIT_ABI, signer);
            const tx = await tapusdc.setDailySpendingLimit(ethers.parseUnits(limitInput, 6));
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
                'https://chainfree.site:7001/user/activate-card', {},
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
            const res = await axios.post('https://chainfree.site:7000/retrieve-card-details', { cardId: cId });
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

    return (
        <Page>
            {/* Hero row */}
            <HeroRow>
                <HeroLeftCol>
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
                                <BalanceAmount>{hidden ? '••••••' : fmt(balances.TAPUSDC)}</BalanceAmount>
                                <HeroCurrencyPill>
                                    <EyeToggle onClick={() => setHidden(h => !h)}>
                                        {hidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </EyeToggle>
                                    TAPUSDC
                                </HeroCurrencyPill>
                            </HeroBalanceRow>

                            <SecondaryBalance>
                                <SecondaryAmount>{hidden ? '••••' : fmt(balances.USDC)}</SecondaryAmount>
                                <SecondaryCurrency>USDC</SecondaryCurrency>
                                <SecondaryDivider />
                                <SecondaryLabel>in wallet</SecondaryLabel>
                            </SecondaryBalance>

                            
                        </HeroLeft>

                        <HeroLeftExtra>
                            <ExtraTitle>Actions</ExtraTitle>
                            <ActionsList>
                                <ActionRow onClick={() => setShowWrap(true)}>
                                    <ArrowDownLeft size={15} color="rgba(255,255,255,0.45)" />
                                    <ActionRowLabel>Wrap USDC</ActionRowLabel>
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
                                <ActionRow as="a" href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer">
                                    <Droplets size={15} color="rgba(255,255,255,0.45)" />
                                    <ActionRowLabel>Get USDC</ActionRowLabel>
                                    <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                                </ActionRow>
                            </ActionsList>
                        </HeroLeftExtra>
                    </HeroTopRow>

                    <BalanceHistoryChart tapusdcBalance={balances.TAPUSDC} usdcBalance={balances.USDC} />

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
                                                                href={`https://testnet.arcscan.app/tx/${tx.txHash}`}
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
                                    <CardGlow />
                                    <CardFaceTop>
                                        <NfcIcon />
                                        <CardNumExpiry>
                                            <CardNumLine>
                                                {cardDetails?.last4 ? `**** **** ${cardDetails.last4}` : '**** **** ••••'}
                                            </CardNumLine>
                                            <CardExpiryLine>
                                                {cardDetails?.exp_month && cardDetails?.exp_year
                                                    ? `${String(cardDetails.exp_month).padStart(2,'0')}/${String(cardDetails.exp_year).slice(-2)}`
                                                    : '••/••'}
                                            </CardExpiryLine>
                                        </CardNumExpiry>
                                    </CardFaceTop>
                                    <CardFaceMid>
                                        <ChipSvg />
                                    </CardFaceMid>
                                    <CardFaceBottom>
                                        <CardHolderBlock>
                                            <CardHolderLabel>Card Holder Name</CardHolderLabel>
                                            <CardHolderName>
                                                {cardDetails?.cardholder_name ?? user?.name ?? 'Koda User'}
                                            </CardHolderName>
                                        </CardHolderBlock>
                                        <VisaText>VISA</VisaText>
                                    </CardFaceBottom>
                                </KodaCard>

                                <QuickActionsCard>
                                    <QuickActionsTitle>Quick Action</QuickActionsTitle>
                                    <CardQuickActions>
                                        <Tip text="View your full card number, expiry date and CVV for online payments">
                                            <CardQuickBtn onClick={handleViewCardDetails}>
                                                <CardQuickIcon><Eye size={18} /></CardQuickIcon>
                                                <span>Details</span>
                                            </CardQuickBtn>
                                        </Tip>
                                        <Tip text="Copy your card number to clipboard">
                                            <CardQuickBtn onClick={handleCopyCardNumber} disabled={!cardDetails?.card_number}>
                                                <CardQuickIcon>{copied ? <Check size={18} /> : <Copy size={18} />}</CardQuickIcon>
                                                <span>{copied ? 'Copied' : 'Copy'}</span>
                                            </CardQuickBtn>
                                        </Tip>
                                        <Tip text="Temporarily block all new payments on this card — you can unfreeze at any time">
                                            <CardQuickBtn>
                                                <CardQuickIcon><Snowflake size={18} /></CardQuickIcon>
                                                <span>Freeze</span>
                                            </CardQuickBtn>
                                        </Tip>
                                        <Tip text="Additional card settings and options">
                                            <CardQuickBtn>
                                                <CardQuickIcon><MoreHorizontal size={18} /></CardQuickIcon>
                                                <span>More</span>
                                            </CardQuickBtn>
                                        </Tip>
                                    </CardQuickActions>
                                </QuickActionsCard>
                            </>
                        ) : (
                            <NoCardPanel onClick={() => navigate('/createcard')}>
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
                                            {fmt(ethers.formatUnits(dailySpent ?? 0n, 6))} of {fmt(ethers.formatUnits(dailyLimit ?? 0n, 6))} TAPUSDC used today
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
                                <ModalHeaderSub>Max TAPUSDC you can spend per day</ModalHeaderSub>
                            </div>
                            <ApprovalModalClose onClick={() => setShowLimitModal(false)}><X size={14} /></ApprovalModalClose>
                        </ModalHeader>

                        <ModalBody>
                            <ApprovalTokenBox>
                                <ApprovalAmountLabel>
                                    <span>Daily limit</span>
                                    <ApprovalBalanceHint onClick={() => setLimitInput(balances.TAPUSDC || '0')}>
                                        Balance: {fmt(balances.TAPUSDC)} — Max
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
                                    <ApprovalAmountToken>TAPUSDC</ApprovalAmountToken>
                                </ApprovalTokenRow>
                            </ApprovalTokenBox>
                            <ApprovalModalNote>
                                Sets the maximum amount of TAPUSDC you can spend in a single day. Set to 0 to use the global default.
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

// Card face

const KodaCard = styled.div`
    position: relative;
    background: linear-gradient(135deg, #4F55F1 0%, #2e8a6e 55%, #00A87E 100%);
    border-radius: 18px;
    padding: 22px;
    height: 210px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
`;

const CardGlow = styled.div`
    position: absolute;
    top: -80px; left: -40px;
    width: 260px; height: 260px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%);
    pointer-events: none;
`;

const CardFaceTop = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    position: relative;
    z-index: 1;
`;

const CardNumExpiry = styled.div`
    text-align: right;
`;

const CardNumLine = styled.p`
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.88);
    letter-spacing: 1.5px;
    margin: 0 0 4px;
    white-space: nowrap;
`;

const CardExpiryLine = styled.p`
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
    color: rgba(255,255,255,0.45);
    letter-spacing: 1px;
    margin: 0;
`;

const CardFaceMid = styled.div`
    position: relative;
    z-index: 1;
`;

const CardFaceBottom = styled.div`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 10px;
    position: relative;
    z-index: 1;
`;

const CardHolderBlock = styled.div`
    flex: 1;
    min-width: 0;
`;

const CardHolderLabel = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 9px;
    font-weight: 500;
    color: rgba(255,255,255,0.35);
    letter-spacing: 0.4px;
    margin: 0 0 3px;
`;

const CardHolderName = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const VisaText = styled.span`
    font-family: 'Times New Roman', Times, serif;
    font-size: 26px;
    font-weight: 900;
    font-style: italic;
    white-space: nowrap;
    letter-spacing: 1px;
    line-height: 1;
    background: linear-gradient(180deg, #ffffff 0%, #e8d48a 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: none;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
`;

// Quick actions

const QuickActionsCard = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid #ffffff20;
    border-radius: 16px;
    padding: 16px;
`;

const QuickActionsTitle = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    margin: 0;
`;

const CardQuickActions = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
`;

const CardQuickIcon = styled.div`
    width: 44px; height: 44px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    color: #ffffff;
    transition: background 0.15s;
`;

const CardQuickBtn = styled.button`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    border: none;
    padding: 10px 4px;
    width: 100%;
    background: transparent;
    border-radius: 12px;
    color: rgba(255,255,255,0.65);
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    &:hover { opacity: 0.75; }
    &:hover ${CardQuickIcon} { background: rgba(255,255,255,0.13); }
    &:disabled { opacity: 0.3; cursor: default; }
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

export default DashboardPage;
