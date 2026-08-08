import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import KODALOGO from '../../assets/koda-logo.png';
import ARCLOGO from '../../assets/Arc_Logo_Navy.png';
import TRMLOGO from '../../assets/trm-labs-logo.png';

const BizFooter = () => {
    const navigate = useNavigate();
    return (
        <Footer>
            <Inner>
                <Left>
                    <Brand>
                        <LogoImg src={KODALOGO} alt="Koda" />
                        <LogoText>Koda</LogoText>
                        <InfraBadge>Infrastructure</InfraBadge>
                    </Brand>
                    <Tagline>
                        Self-custody payment rails<br />for fintechs and wallet providers.
                    </Tagline>
                    <PoweredBy>
                        <PoweredLabel>Powered by</PoweredLabel>
                        <PartnerLogo src={ARCLOGO} alt="Arc" $height="16px" />
                        <Dot />
                        <PoweredLabel>Wallet screening</PoweredLabel>
                        <PartnerLogo src={TRMLOGO} alt="TRM Labs" $height="14px" />
                    </PoweredBy>
                </Left>

                <Links>
                    <LinkGroup>
                        <GroupLabel>Integration</GroupLabel>
                        <FootA href="#how-it-works">How it works</FootA>
                        <FootA href="#features">Capabilities</FootA>
                        <FootA href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer">Docs</FootA>
                    </LinkGroup>
                    <LinkGroup>
                        <GroupLabel>Company</GroupLabel>
                        <FootBtn onClick={() => navigate('/')}>Personal product</FootBtn>
                        <FootA href="https://kodafi.xyz" target="_blank" rel="noopener noreferrer">About Koda</FootA>
                        <FootA href="#contact">Contact us</FootA>
                    </LinkGroup>
                </Links>
            </Inner>

            <Bottom>
                <BottomText>© {new Date().getFullYear()} Koda. All rights reserved.</BottomText>
                <NetworkPill>
                    <NetDot />
                    Arc Testnet
                </NetworkPill>
            </Bottom>
        </Footer>
    );
};

// ─── Styled ───────────────────────────────────────────────────────────────────

const Footer = styled.footer`
    background: #000000;
    border-top: 1px solid rgba(255,255,255,0.06);
    padding: 64px 40px 32px;
    @media (max-width: 768px) { padding: 48px 24px 28px; }
`;

const Inner = styled.div`
    max-width: 1200px;
    margin: 0 auto 48px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 48px;
    @media (max-width: 768px) { flex-direction: column; gap: 36px; }
`;

const Left = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 260px;
`;

const Brand = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const LogoImg = styled.img`
    width: 22px;
    height: 22px;
    border-radius: 5px;
`;

const LogoText = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 16px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.3px;
`;

const InfraBadge = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #4F55F1;
    background: rgba(79,85,241,0.08);
    border: 1px solid rgba(79,85,241,0.18);
    border-radius: 4px;
    padding: 2px 5px;
`;

const Tagline = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.28);
    margin: 0;
    line-height: 1.6;
`;

const PoweredBy = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
`;

const PoweredLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.2);
`;

const PartnerLogo = styled.img`
    height: ${p => p.$height || '14px'};
    opacity: 0.3;
    filter: brightness(10);
    object-fit: contain;
`;

const Dot = styled.div`
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
`;

const Links = styled.div`
    display: flex;
    gap: 60px;
    @media (max-width: 560px) { gap: 36px; }
`;

const LinkGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const GroupLabel = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.22);
    margin: 0 0 4px;
`;

const FootA = styled.a`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.38);
    text-decoration: none;
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,0.78); }
`;

const FootBtn = styled.button`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.38);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,0.78); }
`;

const Bottom = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 24px;
    border-top: 1px solid rgba(255,255,255,0.05);
    gap: 16px;
    @media (max-width: 560px) { flex-direction: column; align-items: flex-start; }
`;

const BottomText = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.18);
`;

const NetworkPill = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 100px;
    padding: 5px 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.25);
`;

const NetDot = styled.div`
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
`;

export default BizFooter;
