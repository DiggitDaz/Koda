import styled from 'styled-components';
import { Link2, Webhook, Zap } from 'lucide-react';

const STEPS = [
    {
        num: '01',
        icon: Link2,
        title: 'Connect and share your webhook structure',
        body: 'Integrate with the Koda API and tell us how your payment processor structures its auth events — the payload format, the fields we need to read, the flow it follows. That\'s all we need. Card network, QR, open banking, SEPA: we map to your format.',
        detail: 'REST API · Test sandbox · Works with any payment processor',
    },
    {
        num: '02',
        icon: Webhook,
        title: 'Your processor fires — we listen',
        body: 'You handle everything on your side: KYC, auth, compliance, customer relationship. When a payment is approved by your processor, the webhook hits Koda\'s endpoint. That\'s the handoff. Nothing changes in your existing flow.',
        detail: 'You own KYC and auth · Koda screens wallets on-chain · Clean separation',
    },
    {
        num: '03',
        icon: Zap,
        title: 'Koda pulls, unwraps, and delivers in under 100ms',
        body: 'On receipt of the webhook, Koda pulls TAPUSDC from the user\'s self-custody wallet, unwraps it to USDC, and delivers it to you on-chain via Arc. You keep the fees, interchange, and any FX spread. We confirm back to your endpoint when it\'s done.',
        detail: 'Sub-100ms · USDC to your wallet · Immutable Arc receipt',
    },
];

const BizHowItWorks = () => (
    <Section id="how-it-works">
        <Inner>
            <Header>
                <Kicker>Integration</Kicker>
                <Title>From API key to live payments in days</Title>
                <Desc>
                    No new banking licences. No custody requirements.
                    Just a clean API that plugs into the platform you already have.
                </Desc>
            </Header>

            <Steps>
                {STEPS.map(({ num, icon: Icon, title, body, detail }, i) => (
                    <Step key={num}>
                        <StepLeft>
                            <NumBadge>{num}</NumBadge>
                            {i < STEPS.length - 1 && <Connector />}
                        </StepLeft>
                        <StepCard>
                            <StepTop>
                                <IconWrap>
                                    <Icon size={16} strokeWidth={1.75} />
                                </IconWrap>
                                <StepTitle>{title}</StepTitle>
                            </StepTop>
                            <StepBody>{body}</StepBody>
                            <DetailPill>{detail}</DetailPill>
                        </StepCard>
                    </Step>
                ))}
            </Steps>
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
    max-width: 900px;
    margin: 0 auto;
`;

const Header = styled.div`
    text-align: center;
    margin-bottom: 72px;
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
    max-width: 480px;
    margin: 0 auto;
`;

const Steps = styled.div`
    display: flex;
    flex-direction: column;
`;

const Step = styled.div`
    display: grid;
    grid-template-columns: 52px 1fr;
    gap: 24px;
    align-items: flex-start;
`;

const StepLeft = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 22px;
`;

const NumBadge = styled.div`
    width: 38px;
    height: 38px;
    border-radius: 9px;
    background: rgba(79,85,241,0.07);
    border: 1px solid rgba(79,85,241,0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Saira', sans-serif;
    font-size: 12px;
    font-weight: 800;
    color: #4F55F1;
    flex-shrink: 0;
`;

const Connector = styled.div`
    width: 1px;
    flex: 1;
    min-height: 40px;
    background: linear-gradient(to bottom, rgba(79,85,241,0.25), rgba(200,255,62,0.03));
    margin: 6px 0;
`;

const StepCard = styled.div`
    background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, #08080f 100%);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 16px;
    transition: border-color 0.2s;
    &:hover { border-color: rgba(79,85,241,0.18); }
`;

const StepTop = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
`;

const IconWrap = styled.div`
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(79,85,241,0.07);
    border: 1px solid rgba(79,85,241,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4F55F1;
    flex-shrink: 0;
`;

const StepTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.4px;
    margin: 0;
`;

const StepBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    color: #8D969E;
    line-height: 1.65;
    margin: 0 0 14px;
`;

const DetailPill = styled.div`
    display: inline-flex;
    align-items: center;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 100px;
    padding: 4px 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 500;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.2px;
`;

export default BizHowItWorks;
