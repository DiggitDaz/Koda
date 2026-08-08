import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import KODALOGO from '../../assets/koda-logo.png';

const BizNav = () => {
    const navigate = useNavigate();
    return (
        <Nav>
            <Inner>
                <Logo onClick={() => navigate('/')}>
                    <LogoImg src={KODALOGO} alt="Koda" />
                    <LogoText>Koda</LogoText>
                    <InfraBadge>Infrastructure</InfraBadge>
                </Logo>
                <Links>
                    <NavA href="#how-it-works">Integration</NavA>
                    <NavA href="#features">Capabilities</NavA>
                    <NavA href="#for-fintechs">Use cases</NavA>
                    <NavA href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer">Docs</NavA>
                </Links>
                <NavRight>
                    <GhostBtn onClick={() => navigate('/')}>Back to Koda</GhostBtn>
                    <PrimaryBtn href="#contact">Talk to us</PrimaryBtn>
                </NavRight>
            </Inner>
        </Nav>
    );
};

const Nav = styled.nav`
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
`;

const Inner = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 40px;
    @media (max-width: 768px) { padding: 0 20px; }
`;

const Logo = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
`;

const LogoImg = styled.img`
    width: 26px;
    height: 26px;
    border-radius: 6px;
`;

const LogoText = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.5px;
`;

const InfraBadge = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: #4F55F1;
    background: rgba(79,85,241,0.08);
    border: 1px solid rgba(79,85,241,0.2);
    border-radius: 4px;
    padding: 2px 6px;
`;

const Links = styled.div`
    display: flex;
    align-items: center;
    gap: 28px;
    flex: 1;
    @media (max-width: 768px) { display: none; }
`;

const NavA = styled.a`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.45);
    text-decoration: none;
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,0.85); }
`;

const NavRight = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    @media (max-width: 768px) { display: none; }
`;

const GhostBtn = styled.button`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 14px;
    border-radius: 8px;
    transition: color 0.15s, background 0.15s;
    &:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.05); }
`;

const PrimaryBtn = styled.a`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    background: #4F55F1;
    border: none;
    border-radius: 8px;
    padding: 9px 18px;
    cursor: pointer;
    text-decoration: none;
    transition: opacity 0.15s, transform 0.15s;
    &:hover { opacity: 0.85; transform: translateY(-1px); }
`;

export default BizNav;
