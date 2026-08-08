import styled from 'styled-components';
import { Wallet, Zap, Layers, Code2, ShieldCheck, BadgeDollarSign, RefreshCw } from 'lucide-react';

const FEATURES = [
    {
        icon: Layers,
        title: 'Rail-agnostic by design',
        body: 'Card network, QR code, open banking, SEPA push — it doesn\'t matter. If your payment processor can fire a webhook, Koda can settle against it. We just need to know the structure of your processor\'s event.',
    },
    {
        icon: Zap,
        title: 'Webhook-triggered settlement',
        body: 'Your processor authorises the payment and fires a webhook. Koda receives it, pulls TAPUSDC from the user\'s self-custody wallet, unwraps it to USDC, and delivers it to you — the whole sequence in under 100ms.',
    },
    {
        icon: Wallet,
        title: 'Zero custody',
        body: 'TAPUSDC stays in the user\'s wallet until the moment your webhook arrives. Nothing sits in escrow, nothing on your balance sheet. Settlement is the first — and only — time funds move.',
    },
    {
        icon: BadgeDollarSign,
        title: 'You keep the economics',
        body: 'Any fees you charge, FX spread, and interchange revenue are entirely yours. Koda takes nothing from the transaction. Your revenue model is unchanged — you just add a new settlement rail.',
    },
    {
        icon: ShieldCheck,
        title: 'On-chain wallet screening',
        body: 'Every wallet is screened for sanctions exposure before settlement. You retain KYC obligations as the regulated fintech — Koda handles the on-chain risk layer, and we\'ll extend this to chain analytics over time.',
    },
    {
        icon: RefreshCw,
        title: 'Confirmation callbacks',
        body: 'Once settlement completes on Arc, Koda fires a confirmation back to your platform. On-chain finality, delivered to your endpoint. No polling, no reconciliation — the chain is the source of truth.',
    },
];

const BizFeatures = () => (
    <Section id="features">
        <Inner>
            <Header>
                <Kicker>Capabilities</Kicker>
                <Title>Infrastructure that lets you move<br />without moving money</Title>
                <Desc>
                    Koda handles the hard parts — custody, settlement, compliance.
                    You ship the product.
                </Desc>
            </Header>

            <Grid>
                {FEATURES.map(({ icon: Icon, title, body }) => (
                    <Card key={title}>
                        <IconWrap>
                            <Icon size={17} strokeWidth={1.75} />
                        </IconWrap>
                        <CardTitle>{title}</CardTitle>
                        <CardBody>{body}</CardBody>
                    </Card>
                ))}
            </Grid>
        </Inner>
    </Section>
);

// ─── Styled ───────────────────────────────────────────────────────────────────

const Section = styled.section`
    background: #000000;
    padding: 100px 40px;
    border-top: 1px solid rgba(255,255,255,0.06);
    @media (max-width: 768px) { padding: 72px 24px; }
`;

const Inner = styled.div`
    max-width: 1200px;
    margin: 0 auto;
`;

const Header = styled.div`
    text-align: center;
    margin-bottom: 64px;
`;

const Kicker = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #4F55F1;
    margin: 0 0 16px;
`;

const Title = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: clamp(28px, 3.5vw, 48px);
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
    letter-spacing: -1.5px;
    margin: 0 0 16px;
    text-wrap: balance;
`;

const Desc = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 16px;
    color: rgba(255,255,255,0.35);
    line-height: 1.65;
    max-width: 480px;
    margin: 0 auto;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    @media (max-width: 960px) { grid-template-columns: repeat(2, 1fr); }
    @media (max-width: 600px)  { grid-template-columns: 1fr; }
`;

const Card = styled.div`
    background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, #08080f 100%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 28px 24px;
    transition: border-color 0.2s, transform 0.2s;
    &:hover { border-color: rgba(79,85,241,0.2); transform: translateY(-3px); }
`;

const IconWrap = styled.div`
    width: 38px;
    height: 38px;
    border-radius: 9px;
    background: rgba(79,85,241,0.07);
    border: 1px solid rgba(79,85,241,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4F55F1;
    margin-bottom: 16px;
    flex-shrink: 0;
`;

const CardTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
    margin: 0 0 10px;
`;

const CardBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    color: #8D969E;
    line-height: 1.65;
    margin: 0;
`;

export default BizFeatures;
