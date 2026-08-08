import styled, { keyframes } from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { ArrowRight, ChevronDown } from 'lucide-react';
import ARCLOGO from '../assets/Arc_Logo_Navy.png';

const HeroSection = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <Section>
            <RainbowBase />
            <Centre>
                <ArcBadge>
                    Settled on
                    <ArcLogoImg src={ARCLOGO} alt="Arc" />
                </ArcBadge>
                <TitleWrap>
                    <TitleGlow aria-hidden="true">Spend stablecoins from true self-custody</TitleGlow>
                    <Title>Spend stablecoins from true self-custody</Title>
                </TitleWrap>
                <Tagline>Any payment rail. Any processor. One settlement layer.</Tagline>
                <BtnRow>
                    <PrimaryBtn onClick={() => navigate(user ? '/dashboard' : '/signup')}>
                        {user ? 'Open app' : 'Get started'} 
                    </PrimaryBtn>
                    <GhostBtn onClick={() => window.scrollBy({ top: window.innerHeight * 0.7, behavior: 'smooth' })}>
                        Learn more <ChevronDown size={15} strokeWidth={2.5} />
                    </GhostBtn>
                </BtnRow>
            </Centre>
        </Section>
    );
};

const rise = keyframes`
    0%   { opacity: 0.5; transform: scaleY(1); }
    50%  { opacity: 0.8; transform: scaleY(1.08); }
    100% { opacity: 0.5; transform: scaleY(1); }
`;

const Section = styled.section`
    position: relative;
    width: 100%;
    height: 70vh;
    background: #000000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    @media (max-width: 768px) {
        height: calc(100vh - 64px);
    }
`;

const RainbowBase = styled.div`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 38%;
    background: linear-gradient(
        to top,
        rgba(255, 0, 128, 0.55)   0%,
        rgba(255, 80, 0, 0.38)   18%,
        rgba(255, 200, 0, 0.22)  36%,
        rgba(0, 220, 180, 0.12)  58%,
        rgba(80, 80, 255, 0.05)  78%,
        transparent              100%
    ),
    linear-gradient(
        to right,
        rgba(120, 0, 255, 0.4)   0%,
        rgba(255, 0, 128, 0.4)  25%,
        rgba(255, 120, 0, 0.35) 50%,
        rgba(0, 200, 255, 0.35) 75%,
        rgba(120, 0, 255, 0.4) 100%
    );
    mask-image: linear-gradient(to top, black 0%, transparent 100%);
    -webkit-mask-image: linear-gradient(to top, black 0%, transparent 100%);
    animation: ${rise} 6s ease-in-out infinite;
    pointer-events: none;
`;

const Centre = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 1;

    @media (max-width: 768px) {
        padding: 0 20px;
        width: 100%;
    }
`;

const TitleWrap = styled.div`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const titleStyles = `
    font-family: 'Saira', sans-serif;
    font-size: clamp(35px, 5.5vw, 80px);
    font-weight: 900;
    letter-spacing: -2px;
    line-height: 1.05;
    text-align: center;
    max-width: 860px;
    padding: 0 32px;

    @media (max-width: 768px) {
        font-size: clamp(32px, 9vw, 48px);
        letter-spacing: -1px;
        padding: 0;
        max-width: 100%;
    }
`;

const TitleGlow = styled.h1`
    ${titleStyles}
    position: absolute;
    color: transparent;
    background: linear-gradient(
        100deg,
        rgba(255,120,180,0.7)   0%,
        rgba(255,100,40,0.7)   30%,
        rgba(255,210,0,0.6)    50%,
        rgba(0,210,255,0.7)    70%,
        rgba(140,60,255,0.7)  100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: blur(18px);
    opacity: 0.35;
    user-select: none;
    pointer-events: none;
`;

const Title = styled.h1`
    ${titleStyles}
    position: relative;
    color: #ffffff;
    margin: 0;
`;

const BtnRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 32px;
    flex-wrap: wrap;
    justify-content: center;

    @media (max-width: 768px) {
        flex-direction: column;
        width: 100%;
        margin-top: 28px;
        gap: 10px;
    }
`;

const PrimaryBtn = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 13px 26px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
    &:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(79,85,241,0.35); }

    @media (max-width: 768px) {
        width: 100%;
        justify-content: center;
        padding: 15px 26px;
        font-size: 16px;
    }
`;

const GhostBtn = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 13px 26px;
    background: rgba(255,255,255,0.05);
    color: rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    &:hover { background: rgba(255,255,255,0.09); color: #fff; border-color: rgba(255,255,255,0.22); }

    @media (max-width: 768px) {
        width: 100%;
        justify-content: center;
        padding: 15px 26px;
        font-size: 16px;
    }
`;

const Tagline = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: clamp(14px, 1.4vw, 18px);
    font-weight: 400;
    color: #8D969E;
    text-align: center;
    margin: 18px 0 0;
    letter-spacing: 0.1px;

    @media (max-width: 768px) {
        font-size: 15px;
        margin: 14px 0 0;
    }
`;

const ArcBadge = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.1px;
`;

const ArcLogoImg = styled.img`
    width: 35px;
    height: 35px;
    object-fit: contain;
    filter: brightness(0) invert(1);
    opacity: 0.5;
`;

export default HeroSection;
