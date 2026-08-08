import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled, { createGlobalStyle, keyframes } from 'styled-components';
import WidgetConnect from '../components/widget/WidgetConnect.jsx';
import WidgetWrap    from '../components/widget/WidgetWrap.jsx';
import WidgetRedeem  from '../components/widget/WidgetRedeem.jsx';

const VALID_ACTIONS = ['connect', 'wrap', 'redeem'];

const post = (payload) => {
    const target = window.opener || window.parent;
    if (target && target !== window) target.postMessage(payload, '*');
};

const WidgetPage = () => {
    const [params]       = useSearchParams();
    const action         = params.get('action');
    const userId         = params.get('user_id') || '';
    const initialAmount  = params.get('amount')  || '';

    const [step,          setStep]          = useState('connect');
    const [connector,     setConnector]     = useState(null);
    const [walletAddress, setWalletAddress] = useState(null);
    const [connectDone,   setConnectDone]   = useState(false);

    if (!VALID_ACTIONS.includes(action)) {
        return (
            <Shell>
                <GlobalStyle />
                <ErrorCard>Invalid action. Use <code>?action=connect</code>, <code>wrap</code>, or <code>redeem</code>.</ErrorCard>
            </Shell>
        );
    }

    const handleConnected = ({ address, connector: conn, signature, message }) => {
        setConnector(conn);
        setWalletAddress(address);

        if (action === 'connect') {
            post({ type: 'koda:success', action: 'connect', wallet_address: address, user_id: userId, signature, message });
            setConnectDone(true);
        } else {
            setStep('action');
        }
    };

    return (
        <Shell>
            <GlobalStyle />
            <Header>
                <KodaMark>K</KodaMark>
                <KodaLabel>Koda</KodaLabel>
            </Header>

            {step === 'connect' && !connectDone && (
                <WidgetConnect
                    userId={userId}
                    actionLabel={ACTION_LABELS[action]}
                    onConnected={handleConnected}
                    onError={(msg) => post({ type: 'koda:error', action, message: msg })}
                />
            )}

            {step === 'connect' && connectDone && (
                <SuccessCard>
                    <SuccessTick>✓</SuccessTick>
                    <SuccessTitle>Wallet connected</SuccessTitle>
                    <SuccessAddr>{walletAddress}</SuccessAddr>
                    <SuccessHint>You can close this window.</SuccessHint>
                </SuccessCard>
            )}

            {step === 'action' && action === 'wrap' && (
                <WidgetWrap
                    connector={connector}
                    walletAddress={walletAddress}
                    initialAmount={initialAmount}
                    onSuccess={(p) => post({ type: 'koda:success', action: 'wrap', ...p })}
                    onError={(msg) => post({ type: 'koda:error', action: 'wrap', message: msg })}
                />
            )}

            {step === 'action' && action === 'redeem' && (
                <WidgetRedeem
                    connector={connector}
                    walletAddress={walletAddress}
                    initialAmount={initialAmount}
                    onSuccess={(p) => post({ type: 'koda:success', action: 'redeem', ...p })}
                    onError={(msg) => post({ type: 'koda:error', action: 'redeem', message: msg })}
                />
            )}

            <Footer>Secured by Koda · Arc Network</Footer>
        </Shell>
    );
};

const ACTION_LABELS = {
    connect: 'Connect wallet',
    wrap:    'Make spendable',
    redeem:  'Redeem TAPUSDC',
};

// ─── Global & layout ─────────────────────────────────────────────────────────

const GlobalStyle = createGlobalStyle`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #07070f; }
`;

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const Shell = styled.div`
    min-height: 100vh;
    background: #07070f;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 20px 24px;
    font-family: 'Google Sans Flex', 'Sora', system-ui, sans-serif;
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 32px;
    animation: ${fadeIn} 0.3s ease both;
`;

const KodaMark = styled.div`
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: #4F55F1;
    color: #fff;
    font-size: 16px;
    font-weight: 800;
    display: grid;
    place-items: center;
`;

const KodaLabel = styled.span`
    font-size: 17px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.4px;
`;

const Footer = styled.p`
    margin-top: auto;
    padding-top: 24px;
    font-size: 11px;
    color: rgba(255,255,255,0.18);
    letter-spacing: 0.2px;
`;

const ErrorCard = styled.div`
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    border-radius: 14px;
    padding: 20px 24px;
    color: #f87171;
    font-size: 14px;
    code { font-family: monospace; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; }
`;

const SuccessCard = styled.div`
    width: 100%;
    max-width: 380px;
    background: #111118;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 36px 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    animation: ${fadeIn} 0.3s ease both;
`;

const SuccessTick = styled.div`
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(79,85,241,0.12);
    border: 1px solid rgba(79,85,241,0.25);
    color: #4F55F1;
    font-size: 22px;
    display: grid;
    place-items: center;
    margin-bottom: 4px;
`;

const SuccessTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 20px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.4px;
`;

const SuccessAddr = styled.p`
    font-size: 12px;
    font-family: monospace;
    color: rgba(255,255,255,0.35);
    word-break: break-all;
`;

const SuccessHint = styled.p`
    font-size: 13px;
    color: rgba(255,255,255,0.3);
    margin-top: 4px;
`;

export default WidgetPage;
