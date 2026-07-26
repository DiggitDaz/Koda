import { useState, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { ethers } from 'ethers';
import axios from 'axios';
import { Plus, X, Check, Loader, Repeat, Music, Play, Package, Cloud, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useWallet } from '../context/WalletContext.js';
import { arcProvider } from '../lib/arcRpc.js';

const TAPUSDC_ADDR    = '0x69053637FF706bD2691ABCEbc9D36E61445343Cf';
const CONTRACT_ADDR   = '';
const API_BASE        = 'https://chainfree.site:7001';

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
];

const AUTO_PULL_ABI = [
    'function subscribe(string memory subscriptionName, uint256 amount, uint256 nextPaymentDate, uint256 numPayments) external',
];

const GET_SUBS_ABI = [{
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getUserActiveSubscriptions',
    outputs: [
        { internalType: 'string[]', name: 'subscriptionNames', type: 'string[]' },
        {
            internalType: 'struct AutoPullPayment.Subscription[]',
            name: 'subscriptionData',
            type: 'tuple[]',
            components: [
                { internalType: 'uint256', name: 'amount', type: 'uint256' },
                { internalType: 'uint256', name: 'nextPaymentDate', type: 'uint256' },
                { internalType: 'uint256', name: 'remaining', type: 'uint256' },
                { internalType: 'uint256', name: 'totalPayments', type: 'uint256' },
                { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
                { internalType: 'bool',    name: 'isActive', type: 'bool' },
            ],
        },
    ],
    stateMutability: 'view',
    type: 'function',
}];

const subIcon = (name) => {
    const n = name?.toLowerCase() || '';
    if (n.includes('netflix')) return Play;
    if (n.includes('spotify')) return Music;
    if (n.includes('amazon')) return Package;
    if (n.includes('cloud') || n.includes('storage')) return Cloud;
    return Repeat;
};

const EMPTY_FORM = { name: '', amount: '', numPayments: '', date: '' };

const SubscriptionsPage = () => {
    const { user } = useAuth();
    const { isConnected, address, connector, connect, connecting } = useWallet();

    const [subs,        setSubs]        = useState([]);
    const [loading,     setLoading]     = useState(false);
    const [showModal,   setShowModal]   = useState(false);
    const [form,        setForm]        = useState(EMPTY_FORM);
    const [approved,    setApproved]    = useState(false);
    const [submitting,  setSubmitting]  = useState(false);
    const [error,       setError]       = useState('');

    const contractDeployed = !!CONTRACT_ADDR;

    const fetchSubs = useCallback(async () => {
        if (!address || !contractDeployed) return;
        try {
            setLoading(true);
            const provider = arcProvider;
            const c = new ethers.Contract(CONTRACT_ADDR, GET_SUBS_ABI, provider);
            const [names, data] = await c.getUserActiveSubscriptions(address);
            setSubs(names.map((name, i) => ({
                name,
                amount: ethers.formatUnits(data[i].amount, 6),
                nextPaymentDate: new Date(Number(data[i].nextPaymentDate) * 1000).toLocaleDateString('en-GB'),
                remaining: Number(data[i].remaining),
                totalPayments: Number(data[i].totalPayments),
                isActive: data[i].isActive,
            })));
        } catch (err) {
            console.error('Fetch subs error:', err);
        } finally {
            setLoading(false);
        }
    }, [address, contractDeployed]);

    useEffect(() => {
        if (address) fetchSubs();
    }, [address, fetchSubs]);

    const handleFormChange = (e) => {
        setForm(p => ({ ...p, [e.target.name]: e.target.value }));
        if (error) setError('');
    };

    const handleApprove = async () => {
        if (!connector || !form.amount || !form.numPayments || !address) {
            setError('Fill in amount and number of payments first.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const total = ethers.parseUnits(form.amount, 6) * BigInt(parseInt(form.numPayments));
            const provider = arcProvider;
            const tokenRead = new ethers.Contract(TAPUSDC_ADDR, ERC20_ABI, provider);
            const allowance = await tokenRead.allowance(address, CONTRACT_ADDR);

            if (allowance < total) {
                const iface = new ethers.Interface(ERC20_ABI);
                const data  = iface.encodeFunctionData('approve', [CONTRACT_ADDR, total]);
                const txHash = await connector.provider.request({
                    method: 'eth_sendTransaction',
                    params: [{ from: address, to: TAPUSDC_ADDR, data, chainId: '0x4CEF52' }],
                });
                await provider.waitForTransaction(txHash);
            }
            setApproved(true);
        } catch (err) {
            setError(err.code === 4001 ? 'Transaction rejected.' : `Approval failed: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubscribe = async () => {
        if (!approved) { setError('Approve tokens first.'); return; }
        if (!form.name || !form.date) { setError('Fill in all fields.'); return; }
        setSubmitting(true);
        setError('');
        try {
            const ts     = Math.floor(new Date(form.date).getTime() / 1000);
            const amount = ethers.parseUnits(form.amount, 6);
            const iface  = new ethers.Interface(AUTO_PULL_ABI);
            const data   = iface.encodeFunctionData('subscribe', [form.name, amount, ts, parseInt(form.numPayments)]);

            const txHash = await connector.provider.request({
                method: 'eth_sendTransaction',
                params: [{ from: address, to: CONTRACT_ADDR, data, chainId: '0x4CEF52' }],
            });
            const provider = arcProvider;
            await provider.waitForTransaction(txHash);

            axios.post(`${API_BASE}/user/link-subscription`, {
                subscription_name: form.name, wallet_address: address,
                amount: form.amount, num_payments: parseInt(form.numPayments),
                next_payment_date: ts,
            }).catch(() => {});

            setForm(EMPTY_FORM);
            setApproved(false);
            setShowModal(false);
            await fetchSubs();
        } catch (err) {
            setError(`Failed: ${err.message}`);
        } finally {
            setSubmitting(false);
        }
    };

    const totalMonthly = subs.filter(s => s.isActive).reduce((sum, s) => sum + parseFloat(s.amount), 0);

    if (!isConnected) {
        return (
            <Page>
                <PageTitle style={{ marginBottom: 28 }}>Subscriptions</PageTitle>
                <StateCard>
                    <StateEmoji>🔄</StateEmoji>
                    <StateTitle>Connect to view subscriptions</StateTitle>
                    <StateBody>Connect your self-custody wallet to manage automated recurring payments.</StateBody>
                    <ConnectBtn onClick={connect} disabled={connecting}>
                        {connecting ? 'Connecting…' : 'Connect wallet'}
                    </ConnectBtn>
                </StateCard>
            </Page>
        );
    }

    if (!contractDeployed) {
        return (
            <Page>
                <PageTitle style={{ marginBottom: 28 }}>Subscriptions</PageTitle>
                <StateCard>
                    <StateIcon><Clock size={36} /></StateIcon>
                    <StateTitle>Coming soon to Arc Testnet</StateTitle>
                    <StateBody>
                        The subscription manager contract is being deployed to Arc Testnet.
                        Once live, you'll be able to set up automated recurring TAPUSDC payments here.
                    </StateBody>
                </StateCard>
            </Page>
        );
    }

    return (
        <Page>
            <HeaderRow>
                <PageTitle>Subscriptions</PageTitle>
                <NewBtn onClick={() => { setError(''); setShowModal(true); }}>
                    <Plus size={14} /> New subscription
                </NewBtn>
            </HeaderRow>

            {subs.length > 0 && (
                <SummaryStrip>
                    <SummaryItem>
                        <SummaryValue>{subs.length}</SummaryValue>
                        <SummaryLabel>Active plans</SummaryLabel>
                    </SummaryItem>
                    <SummaryDivider />
                    <SummaryItem>
                        <SummaryValue>${totalMonthly.toFixed(2)}</SummaryValue>
                        <SummaryLabel>Monthly cost</SummaryLabel>
                    </SummaryItem>
                    <SummaryDivider />
                    <SummaryItem>
                        <ActiveDot />
                        <SummaryValue style={{ color: '#4ade80' }}>Active</SummaryValue>
                        <SummaryLabel>Status</SummaryLabel>
                    </SummaryItem>
                </SummaryStrip>
            )}

            {loading && (
                <LoadingRow><SpinIcon /><span>Loading subscriptions…</span></LoadingRow>
            )}

            {!loading && subs.length === 0 && (
                <StateCard>
                    <StateEmoji>🔄</StateEmoji>
                    <StateTitle>No subscriptions yet</StateTitle>
                    <StateBody>Create your first automated TAPUSDC payment to get started.</StateBody>
                    <NewBtn onClick={() => { setError(''); setShowModal(true); }}>
                        <Plus size={14} /> Create subscription
                    </NewBtn>
                </StateCard>
            )}

            {!loading && subs.map((sub, i) => {
                const Icon = subIcon(sub.name);
                const progress = sub.totalPayments > 0
                    ? ((sub.totalPayments - sub.remaining) / sub.totalPayments) * 100
                    : 0;
                return (
                    <SubCard key={i}>
                        <SubCardTop>
                            <SubLeft>
                                <SubIconWrap><Icon size={18} /></SubIconWrap>
                                <div>
                                    <SubName>{sub.name}</SubName>
                                    <SubDate>Next: {sub.nextPaymentDate}</SubDate>
                                </div>
                            </SubLeft>
                            <SubRight>
                                <SubAmount>${sub.amount}</SubAmount>
                                <SubStatus $active={sub.isActive}>
                                    <StatusDot $active={sub.isActive} />
                                    {sub.isActive ? 'Active' : 'Paused'}
                                </SubStatus>
                            </SubRight>
                        </SubCardTop>
                        <ProgressTrack>
                            <ProgressFill style={{ width: `${progress}%` }} />
                        </ProgressTrack>
                        <SubFooter>
                            <ProgressLabel>{sub.totalPayments - sub.remaining} / {sub.totalPayments} payments</ProgressLabel>
                            <SubActions>
                                <SubActionBtn>Pause</SubActionBtn>
                                <SubCancelBtn>Cancel</SubCancelBtn>
                            </SubActions>
                        </SubFooter>
                    </SubCard>
                );
            })}

            {showModal && (
                <ModalOverlay onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
                    <Modal>
                        <ModalHeader>
                            <div>
                                <ModalTitle>New subscription</ModalTitle>
                                <ModalSub>Set up an automated recurring payment</ModalSub>
                            </div>
                            <CloseBtn onClick={() => setShowModal(false)}><X size={16} /></CloseBtn>
                        </ModalHeader>

                        {error && <ErrorBanner>{error}</ErrorBanner>}

                        <FormGroup>
                            <FormLabel>Subscription name</FormLabel>
                            <FormInput name="name" placeholder="Netflix, Spotify…" value={form.name} onChange={handleFormChange} />
                        </FormGroup>
                        <FormRow>
                            <FormGroup>
                                <FormLabel>Amount per payment (TAPUSDC)</FormLabel>
                                <FormInput name="amount" type="number" placeholder="10.00" value={form.amount} onChange={handleFormChange} />
                            </FormGroup>
                            <FormGroup>
                                <FormLabel>Total payments</FormLabel>
                                <FormInput name="numPayments" type="number" placeholder="12" value={form.numPayments} onChange={handleFormChange} />
                            </FormGroup>
                        </FormRow>
                        <FormGroup>
                            <FormLabel>First payment date</FormLabel>
                            <FormInput name="date" type="datetime-local" value={form.date} onChange={handleFormChange} />
                        </FormGroup>

                        {form.amount && form.numPayments && (
                            <TotalPreview>
                                <TotalLabel>Total commitment</TotalLabel>
                                <TotalValue>
                                    ${(parseFloat(form.amount || 0) * parseInt(form.numPayments || 0)).toFixed(2)} TAPUSDC
                                </TotalValue>
                            </TotalPreview>
                        )}

                        <ModalActions>
                            <StepBtn onClick={handleApprove} disabled={submitting} $done={approved}>
                                <StepNum $done={approved}>
                                    {approved ? <Check size={12} /> : '1'}
                                </StepNum>
                                {submitting && !approved ? <SpinIcon $small /> : (approved ? 'Approved' : 'Approve TAPUSDC')}
                            </StepBtn>
                            <StepBtn $primary onClick={handleSubscribe} disabled={!approved || submitting}>
                                <StepNum $primary>2</StepNum>
                                {submitting && approved ? <SpinIcon $small /> : 'Create subscription'}
                            </StepBtn>
                        </ModalActions>
                    </Modal>
                </ModalOverlay>
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

const SpinIcon = styled(Loader)`
    animation: ${spin} 1s linear infinite;
    width: ${p => p.$small ? 14 : 20}px;
    height: ${p => p.$small ? 14 : 20}px;
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

const HeaderRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
    gap: 12px;
    flex-wrap: wrap;
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

const NewBtn = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
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

const ConnectBtn = styled(NewBtn)``;

// State cards

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

const StateIcon = styled.div`
    color: rgba(255,255,255,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
`;

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

// Summary strip

const SummaryStrip = styled.div`
    display: flex;
    align-items: center;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 24px 32px;
    margin-bottom: 24px;
    gap: 24px;
    flex-wrap: wrap;
    box-shadow: 0 8px 14px rgba(0,0,0,0.25);
    @media (max-width: 600px) { padding: 18px 20px; }
`;

const SummaryItem = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
`;

const SummaryValue = styled.span`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(18px, 3vw, 22px);
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.5px;
`;

const SummaryLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
`;

const SummaryDivider = styled.div`width: 1px; height: 36px; background: rgba(255,255,255,0.08);`;

const ActiveDot = styled.div`
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #4ade80;
    margin-bottom: 2px;
`;

// Loading

const LoadingRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 24px 32px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    box-shadow: 0 8px 14px rgba(0,0,0,0.25);
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    margin-bottom: 16px;
`;

// Subscription cards

const SubCard = styled.div`
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 12px;
    box-shadow: 0 8px 14px rgba(0,0,0,0.25);
`;

const SubCardTop = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
`;

const SubLeft = styled.div`display: flex; align-items: center; gap: 12px;`;

const SubIconWrap = styled.div`
    width: 42px; height: 42px;
    border-radius: 12px;
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.5);
    display: grid; place-items: center;
    flex-shrink: 0;
`;

const SubName = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 3px;
`;

const SubDate = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    margin: 0;
`;

const SubRight = styled.div`display: flex; flex-direction: column; align-items: flex-end; gap: 6px;`;

const SubAmount = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(16px, 2.5vw, 20px);
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.5px;
`;

const SubStatus = styled.span`
    display: inline-flex; align-items: center; gap: 5px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 10px; font-weight: 700;
    padding: 2px 8px; border-radius: 20px;
    background: ${p => p.$active ? 'rgba(74,222,128,0.10)' : 'rgba(248,113,113,0.10)'};
    color: ${p => p.$active ? '#4ade80' : '#f87171'};
    border: 1px solid ${p => p.$active ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'};
`;

const StatusDot = styled.div`
    width: 6px; height: 6px;
    border-radius: 50%;
    background: ${p => p.$active ? '#4ade80' : '#f87171'};
`;

const ProgressTrack = styled.div`
    height: 5px;
    background: rgba(255,255,255,0.06);
    border-radius: 99px;
    overflow: hidden;
    margin-bottom: 10px;
`;

const ProgressFill = styled.div`
    height: 100%;
    background: #4F55F1;
    border-radius: 99px;
    transition: width 0.4s ease;
`;

const SubFooter = styled.div`display: flex; justify-content: space-between; align-items: center;`;

const ProgressLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.35);
`;

const SubActions = styled.div`display: flex; gap: 8px;`;

const SubActionBtn = styled.button`
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px; font-weight: 600;
    color: rgba(255,255,255,0.75); cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(255,255,255,0.08); }
`;

const SubCancelBtn = styled.button`
    padding: 6px 12px;
    border-radius: 8px;
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px; font-weight: 600;
    color: #ef4444; cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(248,113,113,0.15); }
`;

// Modal

const ModalOverlay = styled.div`
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(6px);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 16px;
    z-index: 50;

    @media (min-width: 600px) {
        align-items: flex-start;
        padding: 200px 24px 24px;
    }
`;

const Modal = styled.div`
    width: 100%;
    max-width: 480px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 28px 24px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    box-shadow: 0 8px 40px rgba(0,0,0,0.4);
`;

const ModalHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
`;

const ModalTitle = styled.h2`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 20px; font-weight: 800;
    color: #ffffff; margin: 0 0 4px;
    letter-spacing: -0.3px;
`;

const ModalSub = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px; color: rgba(255,255,255,0.35); margin: 0;
`;

const CloseBtn = styled.button`
    width: 32px; height: 32px;
    display: grid; place-items: center;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    color: rgba(255,255,255,0.4); cursor: pointer;
    transition: background 0.15s, color 0.15s;
    &:hover { background: rgba(255,255,255,0.08); color: #ffffff; }
`;

const ErrorBanner = styled.div`
    background: rgba(180,40,40,0.15);
    border: 1px solid rgba(200,60,60,0.3);
    border-radius: 10px;
    padding: 12px 14px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px; color: rgba(255,120,120,0.9); font-weight: 500;
    margin-bottom: 20px;
`;

const FormGroup = styled.div`display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; flex: 1;`;
const FormRow = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 12px;`;

const FormLabel = styled.label`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.45);
`;

const FormInput = styled.input`
    padding: 10px 12px;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px; color: #ffffff; outline: none;
    color-scheme: dark;
    transition: border-color 0.15s;
    &::placeholder { color: rgba(255,255,255,0.25); }
    &:focus { border-color: rgba(79,85,241,0.55); background: rgba(255,255,255,0.06); }
`;

const TotalPreview = styled.div`
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 20px;
    text-align: center;
`;

const TotalLabel = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px; color: rgba(255,255,255,0.35); margin: 0 0 4px;
`;

const TotalValue = styled.p`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(18px, 3vw, 22px); font-weight: 800;
    color: #ffffff; margin: 0; letter-spacing: -0.5px;
`;

const ModalActions = styled.div`display: flex; flex-direction: column; gap: 10px;`;

const StepBtn = styled.button`
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 13px; border-radius: 10px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px; font-weight: 700; cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    background: ${p => p.$primary ? '#4F55F1' : (p.$done ? 'rgba(74,222,128,0.10)' : 'rgba(255,255,255,0.04)')};
    color: ${p => p.$primary ? '#fff' : (p.$done ? '#4ade80' : 'rgba(255,255,255,0.75)')};
    border: 1px solid ${p => p.$primary ? 'transparent' : (p.$done ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.1)')};
    &:hover:not(:disabled) {
        background: ${p => p.$primary ? '#3f45d6' : (p.$done ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.08)')};
    }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const StepNum = styled.span`
    width: 22px; height: 22px;
    border-radius: 11px;
    display: grid; place-items: center;
    font-size: 11px; font-weight: 800;
    background: ${p => p.$primary ? 'rgba(255,255,255,0.2)' : (p.$done ? '#4ade80' : 'rgba(255,255,255,0.08)')};
    color: ${p => p.$primary ? '#fff' : (p.$done ? '#fff' : 'rgba(255,255,255,0.75)')};
`;

export default SubscriptionsPage;
