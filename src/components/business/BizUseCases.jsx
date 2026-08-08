import styled from 'styled-components';
import { Smartphone, QrCode, Globe, ArrowLeftRight, Building2 } from 'lucide-react';

const USE_CASES = [
    {
        icon: Smartphone,
        label: 'Neobanks & super-apps',
        title: 'Add stablecoin settlement to your existing payment product',
        body: 'You already have the card programme, the KYC stack, the customer relationship. Koda slots in behind your existing auth flow — when your processor approves a transaction, we handle the TAPUSDC pull and delivery. Your users get self-custody payments. You get the interchange.',
        callout: 'No new card programme needed. Works with your existing processor.',
    },
    {
        icon: QrCode,
        label: 'QR & alternative payment rails',
        title: 'Not just cards — any payment trigger works',
        body: 'QR code payment at a merchant? In-app payment link? Open banking push? If the flow results in a webhook, Koda can settle it. We work with you to map your processor\'s event structure once — then it just works.',
        callout: 'We map to your webhook. The rail is irrelevant to us.',
    },
    {
        icon: Globe,
        label: 'Cross-border & FX platforms',
        title: 'Settle cross-border payments in stablecoins, instantly',
        body: 'If your product moves money across borders, stablecoin settlement on Arc removes the correspondent banking layer entirely. Your user\'s TAPUSDC settles on-chain in milliseconds — no SWIFT, no T+2, no nostro/vostro.',
        callout: 'Instant finality. Immutable receipt. No intermediary banks.',
    },
    {
        icon: ArrowLeftRight,
        label: 'Crypto wallets & exchanges',
        title: 'Turn self-custody balances into spendable real-world money',
        body: 'Your users already hold TAPUSDC in self-custody. Koda lets you offer a spend layer on top — tied to whatever payment rail you support — without you ever touching the underlying funds. Settlement is triggered by your platform, executed by the chain.',
        callout: 'You own the product. Koda owns the settlement.',
    },
];

const BizUseCases = () => (
    <Section id="for-fintechs">
        <Inner>
            <Header>
                <Kicker>Who it's for</Kicker>
                <Title>Any fintech that wants to offer<br />stablecoin spending</Title>
                <Desc>
                    If your users hold stablecoins — or you want them to —
                    Koda is the layer that makes those balances spendable everywhere.
                </Desc>
            </Header>

            <Grid>
                {USE_CASES.map(({ icon: Icon, label, title, body, callout }) => (
                    <Card key={label}>
                        <CardHead>
                            <LabelRow>
                                <LabelIcon>
                                    <Icon size={12} strokeWidth={2} />
                                </LabelIcon>
                                <Label>{label}</Label>
                            </LabelRow>
                            <CardTitle>{title}</CardTitle>
                        </CardHead>
                        <CardBody>{body}</CardBody>
                        <Callout>{callout}</Callout>
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
    letter-spacing: -1.5px;
    margin: 0 0 16px;
    text-wrap: balance;
`;

const Desc = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 16px;
    color: rgba(255,255,255,0.35);
    line-height: 1.65;
    max-width: 500px;
    margin: 0 auto;
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    @media (max-width: 768px) { grid-template-columns: 1fr; }
`;

const Card = styled.div`
    background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, #08080f 100%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 0;
    transition: border-color 0.2s, transform 0.2s;
    &:hover { border-color: rgba(79,85,241,0.2); transform: translateY(-2px); }
`;

const CardHead = styled.div`
    margin-bottom: 14px;
`;

const LabelRow = styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
`;

const LabelIcon = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4F55F1;
`;

const Label = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: #4F55F1;
    text-transform: uppercase;
    letter-spacing: 0.8px;
`;

const CardTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 19px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.5px;
    margin: 0;
    line-height: 1.25;
`;

const CardBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    color: #8D969E;
    line-height: 1.65;
    margin: 0 0 16px;
    flex: 1;
`;

const Callout = styled.div`
    background: rgba(200,255,62,0.05);
    border: 1px solid rgba(79,85,241,0.12);
    border-radius: 8px;
    padding: 10px 14px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(79,85,241,0.7);
    line-height: 1.4;
`;

export default BizUseCases;
