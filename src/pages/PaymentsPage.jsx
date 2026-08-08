import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import axios from 'axios';
import { CheckCircle, XCircle, RefreshCw, ExternalLink } from 'lucide-react';

const FILTERS = ['all', 'approved', 'declined'];

const formatDate = (d) => {
    const date = new Date(d);
    const today     = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (date.toDateString() === today.toDateString())     return `Today at ${time}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ` at ${time}`;
};

const PaymentsPage = () => {
    const [filter,    setFilter]    = useState('all');
    const [payments,  setPayments]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState('');
    const [cardId,    setCardId]    = useState(() => localStorage.getItem('cardId') || null);

    const fetchTransactions = async (cId) => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/card-transactions/${cId}`);
            if (!res.data.success) { setError('Failed to load transactions.'); return; }

            const auths = res.data.stripe_authorizations || [];
            const dbTx  = res.data.database_transactions  || [];

            const merged = auths.map(auth => {
                const match = dbTx.find(d =>
                    Math.abs(d.usd_cents) === Math.round(auth.amount * 100) &&
                    d.transaction_hash
                );
                return {
                    id:       auth.id,
                    merchant: auth.merchant,
                    amount:   auth.amount,
                    currency: (auth.currency || 'gbp').toUpperCase(),
                    approved: auth.approved,
                    date:     auth.created,
                    txHash:   match?.transaction_hash || null,
                };
            });

            merged.sort((a, b) => new Date(b.date) - new Date(a.date));
            setPayments(merged);
        } catch (err) {
            setError('Could not load payment history. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const resolve = async () => {
            let cId = cardId;
            if (!cId) {
                const token = localStorage.getItem('authToken');
                if (!token) { setLoading(false); return; }
                try {
                    const res = await axios.get(`${import.meta.env.VITE_AUTH_URL}/user/cards`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.data.success && res.data.data?.length > 0) {
                        cId = res.data.data[0].card_id;
                        setCardId(cId);
                        localStorage.setItem('cardId', cId);
                    }
                } catch { setLoading(false); return; }
            }
            if (cId) fetchTransactions(cId);
            else     setLoading(false);
        };
        resolve();
    }, []);

    const filtered = payments.filter(p =>
        filter === 'all' ? true : filter === 'approved' ? p.approved : !p.approved
    );

    const totalSpent    = payments.filter(p => p.approved).reduce((s, p) => s + p.amount, 0);
    const approvedCount = payments.filter(p => p.approved).length;
    const declinedCount = payments.filter(p => !p.approved).length;

    return (
        <Page>
            <TitleRow>
                <PageTitle>Payment history</PageTitle>
                {cardId && (
                    <IconBtn onClick={() => fetchTransactions(cardId)} disabled={loading} title="Refresh">
                        <RefreshCw size={14} />
                    </IconBtn>
                )}
            </TitleRow>

            {!cardId && !loading && (
                <StateCard>
                    <StateEmoji>💳</StateEmoji>
                    <StateTitle>No card yet</StateTitle>
                    <StateBody>Create your Koda card from the dashboard to start making payments.</StateBody>
                </StateCard>
            )}

            {loading && (
                <SkeletonPanel>
                    {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
                </SkeletonPanel>
            )}

            {error && !loading && (
                <ErrorBanner>
                    <XCircle size={14} /> {error}
                </ErrorBanner>
            )}

            {cardId && !loading && !error && (
                <>
                    <SummaryRow>
                        <SummaryCard>
                            <SummaryLabel>Total spent</SummaryLabel>
                            <SummaryValue>£{totalSpent.toFixed(2)}</SummaryValue>
                            <SummarySub>GBP · all time</SummarySub>
                        </SummaryCard>
                        <SummaryCard>
                            <SummaryLabel>Approved</SummaryLabel>
                            <SummaryValue>{approvedCount}</SummaryValue>
                            <SummarySub>transactions</SummarySub>
                        </SummaryCard>
                        <SummaryCard $warn={declinedCount > 0}>
                            <SummaryLabel>Declined</SummaryLabel>
                            <SummaryValue>{declinedCount}</SummaryValue>
                            <SummarySub>transactions</SummarySub>
                        </SummaryCard>
                    </SummaryRow>

                    <SectionEyebrow>Transactions</SectionEyebrow>

                    <FilterRow>
                        {FILTERS.map(f => (
                            <FilterTab key={f} $active={filter === f} onClick={() => setFilter(f)}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </FilterTab>
                        ))}
                    </FilterRow>

                    {filtered.length === 0 && (
                        <StateCard>
                            <StateEmoji>🧾</StateEmoji>
                            <StateTitle>No {filter === 'all' ? '' : filter} payments yet</StateTitle>
                            <StateBody>
                                {filter === 'all'
                                    ? 'Use the Bolt & Board test store to make your first payment.'
                                    : `No ${filter} transactions found.`}
                            </StateBody>
                        </StateCard>
                    )}

                    {filtered.length > 0 && (
                        <PaymentList>
                            {filtered.map((p, i) => (
                                <div key={p.id}>
                                    <PaymentRow>
                                        <StatusIcon $approved={p.approved}>
                                            {p.approved
                                                ? <CheckCircle size={16} />
                                                : <XCircle    size={16} />}
                                        </StatusIcon>
                                        <PaymentInfo>
                                            <MerchantName>{p.merchant}</MerchantName>
                                            <PaymentMeta>
                                                {formatDate(p.date)}
                                                {p.txHash && (
                                                    <TxLink
                                                        href={`${import.meta.env.VITE_EXPLORER_URL}/tx/${p.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        · on-chain <ExternalLink size={10} />
                                                    </TxLink>
                                                )}
                                            </PaymentMeta>
                                            <AuthRef>{p.id}</AuthRef>
                                        </PaymentInfo>
                                        <PaymentRight>
                                            <PaymentAmount $approved={p.approved}>
                                                {p.approved ? '-' : ''}£{p.amount.toFixed(2)}
                                            </PaymentAmount>
                                            <StatusBadge $approved={p.approved}>
                                                {p.approved ? 'Approved' : 'Declined'}
                                            </StatusBadge>
                                        </PaymentRight>
                                    </PaymentRow>
                                    {i < filtered.length - 1 && <PaymentDivider />}
                                </div>
                            ))}
                        </PaymentList>
                    )}
                </>
            )}
        </Page>
    );
};

// Animations

const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const shimmer = keyframes`
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
`;

const spin = keyframes`to { transform: rotate(360deg); }`;

// Layout

const Page = styled.div`
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.12);
    padding: 36px 40px 60px;
    max-width: 760px;
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
`;

const IconBtn = styled.button`
    width: 36px; height: 36px;
    display: grid; place-items: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: #8D969E;
    cursor: pointer;
    transition: opacity 0.15s;
    &:hover:not(:disabled) { opacity: 0.7; }
    &:disabled { opacity: 0.4; cursor: not-allowed; animation: ${spin} 1s linear infinite; }
`;

// Empty states

const StateCard = styled.div`
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
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

// Skeleton

const SkeletonPanel = styled.div`
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 20px;
    overflow: hidden;
`;

const SkeletonRow = styled.div`
    height: 72px;
    background: linear-gradient(90deg, #1e2530 25%, #252d3a 50%, #1e2530 75%);
    background-size: 600px 100%;
    animation: ${shimmer} 1.4s ease infinite;
    & + & { border-top: 1px solid rgba(255,255,255,0.05); }
`;

// Error

const ErrorBanner = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    border-radius: 12px;
    padding: 12px 16px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #f87171;
`;

// Summary

const SummaryRow = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 28px;
    @media (max-width: 600px) { grid-template-columns: 1fr; }
`;

const SummaryCard = styled.div`
    background: rgba(255,255,255,0.05);
    border: 1px solid ${p => p.$warn ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.07)'};
    border-radius: 16px;
    padding: 20px 22px;
`;

const SummaryLabel = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #8D969E;
    margin: 0 0 6px;
`;

const SummaryValue = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(22px, 3vw, 28px);
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 2px;
    letter-spacing: -0.5px;
`;

const SummarySub = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: #8D969E;
    margin: 0;
`;

// Section label + filters

const SectionEyebrow = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #ffffff;
    margin: 0 0 12px;
`;

const FilterRow = styled.div`
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
`;

const FilterTab = styled.button`
    padding: 7px 16px;
    border-radius: 20px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    border: 1px solid ${p => p.$active ? '#4F55F1' : 'rgba(255,255,255,0.15)'};
    background: ${p => p.$active ? '#4F55F1' : 'transparent'};
    color: ${p => p.$active ? '#ffffff' : '#8D969E'};
    &:hover { color: #ffffff; border-color: rgba(255,255,255,0.35); }
`;

// Payment list

const PaymentList = styled.div`
    background: rgba(255,255,255,0.05);
    border-radius: 20px;
    padding: 0 24px;
    box-shadow: 0 8px 14px rgba(0,0,0,0.25);
    @media (max-width: 768px) { padding: 0 18px; }
`;

const PaymentRow = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px 0;
    @media (max-width: 480px) { padding: 16px 0; gap: 12px; }
`;

const StatusIcon = styled.div`
    width: 40px; height: 40px;
    flex-shrink: 0;
    border-radius: 20px;
    display: grid; place-items: center;
    background: ${p => p.$approved ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)'};
    color: ${p => p.$approved ? '#4ade80' : '#f87171'};
`;

const PaymentInfo = styled.div`flex: 1; min-width: 0;`;

const MerchantName = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const PaymentMeta = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: #8D969E;
    margin: 0 0 2px;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
`;

const TxLink = styled.a`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 600;
    color: #4F55F1;
    text-decoration: none;
    transition: opacity 0.15s;
    &:hover { opacity: 0.75; }
`;

const AuthRef = styled.p`
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 10px;
    color: rgba(255,255,255,0.15);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const PaymentRight = styled.div`
    text-align: right;
    flex-shrink: 0;
`;

const PaymentAmount = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(16px, 2.5vw, 20px);
    font-weight: 800;
    color: ${p => p.$approved ? '#ffffff' : 'rgba(255,255,255,0.25)'};
    margin: 0 0 4px;
    letter-spacing: -0.3px;
    text-decoration: ${p => p.$approved ? 'none' : 'line-through'};
`;

const StatusBadge = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 20px;
    background: ${p => p.$approved ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)'};
    color: ${p => p.$approved ? '#4ade80' : '#f87171'};
    border: 1px solid ${p => p.$approved ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'};
`;

const PaymentDivider = styled.div`
    height: 1px;
    background: #8D969E30;
    margin-left: 54px;
`;

export default PaymentsPage;
