import styled, { keyframes } from 'styled-components';
import { ArrowRight, Zap, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BizHero = () => {
    const navigate = useNavigate();
    return (
        <Section>
            <OrbLeft />
            <OrbRight />
            <DotGrid />

            <Inner>
                <Left>
                    

                    <Headline>
                        Any payment rail.
                        <br />Any processor.
                        <br /><GradSpan>One settlement layer.</GradSpan>
                    </Headline>

                    <Sub>
                        Koda sits behind your existing payment flow — card, QR code,
                        open banking, whatever you use. When your processor fires a webhook,
                        Koda pulls TAPUSDC from the user's self-custody wallet, unwraps it
                        to USDC, and delivers it to you. The rail doesn't matter.
                    </Sub>

                    <Actions>
                        <PrimaryBtn href="#contact">
                            Talk to our team <ArrowRight size={15} strokeWidth={2.5} />
                        </PrimaryBtn>
                        <GhostBtn href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer">
                            Read the docs
                        </GhostBtn>
                    </Actions>

                    
                </Left>

                <Right>
                    <ArchCard>
                        <ArchLabel>How it connects</ArchLabel>

                        <FlowRow>
                            <FlowNode $highlight>
                                <NodeDot $lime />
                                <NodeTitle>Any payment rail</NodeTitle>
                                <NodeSub>Card · QR · Open banking<br />SEPA · Any processor</NodeSub>
                            </FlowNode>

                            <Arrow>
                                <ArrowLine />
                                <ArrowLabel>webhook</ArrowLabel>
                                <ArrowLine />
                            </Arrow>

                            <FlowNode>
                                <NodeDot $indigo />
                                <NodeTitle>Koda layer</NodeTitle>
                                <NodeSub>Pull · unwrap · deliver<br />Sub-100ms</NodeSub>
                            </FlowNode>

                            <Arrow>
                                <ArrowLine />
                                <ArrowLabel>Arc network</ArrowLabel>
                                <ArrowLine />
                            </Arrow>

                            <FlowNode>
                                <NodeDot $teal />
                                <NodeTitle>User's wallet</NodeTitle>
                                <NodeSub>Self-custodied TAPUSDC<br />Pulled at settlement only</NodeSub>
                            </FlowNode>
                        </FlowRow>

                        <SettleRow>
                            <SettlePill>
                                <SettleDot />
                                Settlement: &lt;100ms
                            </SettlePill>
                            <SettlePill>
                                <SettleDot $teal />
                                Rail-agnostic · any webhook format
                            </SettlePill>
                        </SettleRow>

                        <ArchDivider />

                        <TxPreview>
                            <TxRow>
                                <TxIcon>↗</TxIcon>
                                <TxInfo>
                                    <TxTitle>Partner webhook received</TxTitle>
                                    <TxSub>Auth approved · Café Procope · EUR</TxSub>
                                </TxInfo>
                                <TxStatus $ok>Received ✓</TxStatus>
                            </TxRow>
                            <TxRow>
                                <TxIcon>⬡</TxIcon>
                                <TxInfo>
                                    <TxTitle>TAPUSDC pulled → unwrapped</TxTitle>
                                    <TxSub>0x4f2…a91 · Arc Testnet</TxSub>
                                </TxInfo>
                                <TxStatus $ok>Settled ✓</TxStatus>
                            </TxRow>
                            <TxRow $dim>
                                <TxIcon>$</TxIcon>
                                <TxInfo>
                                    <TxTitle>USDC delivered to partner</TxTitle>
                                    <TxSub>Fees + interchange retained by partner</TxSub>
                                </TxInfo>
                                <TxStatus>Confirmed</TxStatus>
                            </TxRow>
                        </TxPreview>
                    </ArchCard>
                </Right>
            </Inner>
        </Section>
    );
};

// ─── Keyframes ────────────────────────────────────────────────────────────────

const fadeUp = keyframes`
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const cardIn = keyframes`
    from { opacity: 0; transform: perspective(800px) rotateY(-3deg) rotateX(2deg) translateY(40px); }
    to   { opacity: 1; transform: perspective(800px) rotateY(-3deg) rotateX(2deg) translateY(0); }
`;

const pulse = keyframes`
    0%, 100% { box-shadow: 0 0 0 0 rgba(79,85,241,0.5); }
    60%       { box-shadow: 0 0 0 6px rgba(200,255,62,0); }
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const Section = styled.section`
    position: relative;
    background: #000000;
    overflow: hidden;
    padding: 100px 40px 120px;
    @media (max-width: 768px) { padding: 72px 24px 80px; }
`;

const OrbLeft = styled.div`
    position: absolute;
    top: -10%;
    left: -10%;
    width: 55vw;
    max-width: 640px;
    aspect-ratio: 1;
    background: radial-gradient(circle, rgba(79,85,241,0.07) 0%, transparent 65%);
    border-radius: 50%;
    pointer-events: none;
`;

const OrbRight = styled.div`
    position: absolute;
    bottom: -15%;
    right: -8%;
    width: 45vw;
    max-width: 520px;
    aspect-ratio: 1;
    background: radial-gradient(circle, rgba(79,85,241,0.1) 0%, transparent 65%);
    border-radius: 50%;
    pointer-events: none;
`;

const DotGrid = styled.div`
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 32px 32px;
    pointer-events: none;
`;

const Inner = styled.div`
    position: relative;
    z-index: 1;
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 72px;
    align-items: center;
    @media (max-width: 960px) { grid-template-columns: 1fr; gap: 56px; }
`;

// ─── Left ─────────────────────────────────────────────────────────────────────

const Left = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    animation: ${fadeUp} 0.8s cubic-bezier(0.23,1,0.32,1) both;
`;

const Eyebrow = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(79,85,241,0.06);
    border: 1px solid rgba(79,85,241,0.15);
    border-radius: 100px;
    padding: 6px 14px 6px 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
    color: rgba(255,255,255,0.45);
    margin-bottom: 28px;
`;

const EyebrowDot = styled.div`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4F55F1;
    flex-shrink: 0;
    animation: ${pulse} 2.5s ease-in-out infinite;
`;

const Headline = styled.h1`
    font-family: 'Saira', sans-serif;
    font-size: clamp(38px, 4.5vw, 66px);
    font-weight: 800;
    color: #ffffff;
    line-height: 1.06;
    letter-spacing: -2.5px;
    margin: 0 0 22px;
    text-wrap: balance;
    @media (max-width: 768px) { letter-spacing: -1.5px; }
`;

const GradSpan = styled.span`
    background: linear-gradient(120deg, #4F55F1 0%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
`;

const Sub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 17px;
    color: rgba(255,255,255,0.4);
    line-height: 1.7;
    margin: 0 0 38px;
    max-width: 460px;
    @media (max-width: 768px) { font-size: 15px; }
`;

const Actions = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 36px;
`;

const PrimaryBtn = styled.a`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 26px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    text-decoration: none;
    transition: transform 0.18s, box-shadow 0.18s;
    &:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(79,85,241,0.3); }
    &:active { transform: translateY(0); }
`;

const GhostBtn = styled.a`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 24px;
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.55);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.18s, border-color 0.18s, color 0.18s;
    &:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.85); }
`;

const Proof = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
`;

const ProofItem = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255,255,255,0.3);
`;

const ProofDot = styled.div`
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
`;

// ─── Right — architecture card ─────────────────────────────────────────────────

const Right = styled.div`
    animation: ${cardIn} 0.9s cubic-bezier(0.23,1,0.32,1) 0.15s both;
    @media (max-width: 960px) { display: none; }
`;

const ArchCard = styled.div`
    background: linear-gradient(145deg, rgba(255,255,255,0.04) 0%, #080810 100%);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    padding: 28px;
    box-shadow: 0 40px 100px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05);
`;

const ArchLabel = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
    margin: 0 0 20px;
`;

const FlowRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 16px;
`;

const FlowNode = styled.div`
    flex: 1;
    background: ${p => p.$highlight ? 'rgba(200,255,62,0.05)' : 'rgba(255,255,255,0.03)'};
    border: 1px solid ${p => p.$highlight ? 'rgba(79,85,241,0.18)' : 'rgba(255,255,255,0.07)'};
    border-radius: 10px;
    padding: 12px;
    min-width: 0;
`;

const NodeDot = styled.div`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${p => p.$lime ? '#4F55F1' : p.$teal ? '#00FFB2' : p.$indigo ? '#4F55F1' : '#8D969E'};
    margin-bottom: 8px;
`;

const NodeTitle = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.75);
    margin: 0 0 4px;
`;

const NodeSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    color: #8D969E;
    margin: 0;
    line-height: 1.5;
`;

const Arrow = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 0 6px;
    flex-shrink: 0;
`;

const ArrowLine = styled.div`
    width: 14px;
    height: 1px;
    background: rgba(255,255,255,0.12);
`;

const ArrowLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 9px;
    color: rgba(255,255,255,0.2);
    white-space: nowrap;
`;

const SettleRow = styled.div`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 16px;
`;

const SettlePill = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 100px;
    padding: 4px 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 500;
    color: rgba(255,255,255,0.3);
    white-space: nowrap;
`;

const SettleDot = styled.div`
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: ${p => p.$teal ? '#00FFB2' : '#4F55F1'};
    flex-shrink: 0;
`;

const ArchDivider = styled.div`
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin-bottom: 16px;
`;

const TxPreview = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const TxRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 8px;
    border-radius: 8px;
    opacity: ${p => p.$dim ? 0.5 : 1};
    transition: background 0.15s;
    &:hover { background: rgba(255,255,255,0.03); }
`;

const TxIcon = styled.span`
    width: 28px;
    height: 28px;
    border-radius: 7px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.07);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    flex-shrink: 0;
`;

const TxInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const TxTitle = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.75);
    margin: 0 0 2px;
`;

const TxSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    color: #8D969E;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const TxStatus = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 600;
    color: ${p => p.$ok ? '#22c55e' : '#8D969E'};
    flex-shrink: 0;
    white-space: nowrap;
`;

export default BizHero;
