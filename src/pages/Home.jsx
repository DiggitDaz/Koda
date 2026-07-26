import { useState } from 'react';
import styled, { keyframes } from "styled-components";
import { useNavigate } from "react-router-dom";
import { Shield, Zap, Lock, CreditCard, RefreshCw, Globe, ArrowRight } from "lucide-react";
import ARCLOGO    from '../assets/Arc_Logo_Navy.png';
import CIRCLELOGO  from '../assets/circle-logo.png';
import STRIPELOGO  from '../assets/stripe-logo.png';
import TRMLOGO     from '../assets/trm-labs-logo.png';
import KODALOGO    from '../assets/koda-logo.png';
import { useAuth } from '../context/AuthContext.js';
import HEROLEFT from '../assets/hero-left.png';
import HEROBG from '../assets/hero-bg.jpg';
import LEFTBG from '../assets/left-bg.webp';
import STEP01 from '../assets/01.jpeg';
import STEP02 from '../assets/02.jpg';
import STEP03 from '../assets/03.jpg';
import GB from 'country-flag-icons/react/1x1/GB';
import US from 'country-flag-icons/react/1x1/US';
import EU from 'country-flag-icons/react/1x1/EU';
import JP from 'country-flag-icons/react/1x1/JP';
import SG from 'country-flag-icons/react/1x1/SG';
import AU from 'country-flag-icons/react/1x1/AU';

// UI Mockups (CSS-art)

const WalletMockup = () => (
    <Mockup>
        <MockupHeader>
            <MockupPill />
            <MockupLabel>Connect a wallet</MockupLabel>
        </MockupHeader>
        <MockupDivider />
        {[
            { emoji: '🦊', name: 'MetaMask',        sub: 'Browser extension' },
            { emoji: '🔗', name: 'WalletConnect',   sub: 'Scan with any wallet', active: true },
            { emoji: '🔵', name: 'Coinbase Wallet',  sub: 'Mobile & extension' },
        ].map(w => (
            <WalletOption key={w.name} $active={w.active}>
                <WalletEmoji>{w.emoji}</WalletEmoji>
                <WalletMeta>
                    <WalletName>{w.name}</WalletName>
                    <WalletSub>{w.sub}</WalletSub>
                </WalletMeta>
                <WalletChevron $active={w.active}>›</WalletChevron>
            </WalletOption>
        ))}
    </Mockup>
);

const WrapMockup = () => (
    <Mockup>
        <MockupHeader>
            <MockupPill />
            <MockupLabel>Wrap USDC</MockupLabel>
        </MockupHeader>
        <SwapBox>
            <SwapBoxLabel>You pay</SwapBoxLabel>
            <SwapBoxRow>
                <SwapAmount>10.00</SwapAmount>
                <SwapToken>USDC</SwapToken>
            </SwapBoxRow>
        </SwapBox>
        <SwapArrowRow><SwapArrowCircle>↓</SwapArrowCircle></SwapArrowRow>
        <SwapBox $accent>
            <SwapBoxLabel>You receive</SwapBoxLabel>
            <SwapBoxRow>
                <SwapAmount>10.00</SwapAmount>
                <SwapToken $accent>TAPUSDC</SwapToken>
            </SwapBoxRow>
        </SwapBox>
        <MockupDivider />
        <SwapInfo>
            <SwapInfoRow><span>Rate</span><span>1 USDC = 1 TAPUSDC</span></SwapInfoRow>
            <SwapInfoRow><span>Fee</span><span>None</span></SwapInfoRow>
        </SwapInfo>
        <MockupBtn>Wrap USDC</MockupBtn>
    </Mockup>
);

const SpendMockup = () => (
    <Mockup>
        <MockupHeader>
            <MockupPill />
            <MockupLabel>Confirm payment</MockupLabel>
        </MockupHeader>
        <MockupDivider />
        <MockupRow>
            <MockupKey>From</MockupKey>
            <MockupVal mono>0x3f4a···8b2c</MockupVal>
        </MockupRow>
        <MockupRow>
            <MockupKey>Merchant</MockupKey>
            <MockupVal>Bolt &amp; Board Co.</MockupVal>
        </MockupRow>
        <MockupRow>
            <MockupKey>Amount</MockupKey>
            <MockupVal>£5.99</MockupVal>
        </MockupRow>
        <MockupRow>
            <MockupKey>Token</MockupKey>
            <MockupVal>TAPUSDC</MockupVal>
        </MockupRow>
        <MockupDivider />
        <MockupBtn>Pay with Koda card</MockupBtn>
    </Mockup>
);

const BalanceMockup = () => (
    <Mockup $light>
        <MockupEyebrow>Spendable balance</MockupEyebrow>
        <MockupBigNum>13.00 <MockupCcy>TAPUSDC</MockupCcy></MockupBigNum>
        <MockupNetRow>
            <MockupDot /><MockupNetLabel>Arc Testnet · Live</MockupNetLabel>
        </MockupNetRow>
        <MockupBars>
            {[40, 65, 50, 80, 55, 90, 70].map((h, i) => (
                <MockupBar key={i} $h={h} />
            ))}
        </MockupBars>
        <MockupBarLabel>TAPUSDC balance · last 7 days</MockupBarLabel>
    </Mockup>
);

const SPEND_TXS = [
    { Flag: GB, currency: 'GBP', merchant: 'Bolt & Board Co.',     amount: '-£5.99',   time: '2 min ago',   color: '#012169' },
    { Flag: EU, currency: 'EUR', merchant: 'Café Procope',          amount: '-€12.50',  time: '1 hr ago',    color: '#003399' },
    { Flag: US, currency: 'USD', merchant: 'Stripe Atlas',          amount: '-$49.00',  time: 'Yesterday',   color: '#B22234' },
    { Flag: JP, currency: 'JPY', merchant: 'FamilyMart Tokyo',      amount: '-¥840',    time: '2 days ago',  color: '#BC002D' },
    { Flag: SG, currency: 'SGD', merchant: 'Grab Singapore',        amount: '-S$8.20',  time: '3 days ago',  color: '#EF3340' },
    { Flag: AU, currency: 'AUD', merchant: 'Woolworths Online',     amount: '-A$22.10', time: '4 days ago',  color: '#00008B' },
];

const SpendingMockup = () => (
    <HeroMockupCard>
        <HeroMockupHeader>
            <HeroMockupHeaderLeft>
                <HeroMockupPill />
                <HeroMockupTitle>Koda Card · Recent</HeroMockupTitle>
            </HeroMockupHeaderLeft>
            <HeroMockupBadge>Live</HeroMockupBadge>
        </HeroMockupHeader>
        <HeroMockupBalance>
            <HeroMockupBalLabel>Spendable balance</HeroMockupBalLabel>
            <HeroMockupBalNum>243.00 <HeroMockupBalCcy>TAPUSDC</HeroMockupBalCcy></HeroMockupBalNum>
        </HeroMockupBalance>
        <HeroMockupDivider />
        {SPEND_TXS.map(({ Flag, currency, merchant, amount, time }) => (
            <HeroMockupTx key={merchant}>
                <HeroFlagWrap>
                    <Flag style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                </HeroFlagWrap>
                <HeroMockupTxMeta>
                    <HeroMockupTxName>{merchant}</HeroMockupTxName>
                    <HeroMockupTxSub>{currency} · {time}</HeroMockupTxSub>
                </HeroMockupTxMeta>
                <HeroMockupTxAmt>{amount}</HeroMockupTxAmt>
            </HeroMockupTx>
        ))}
    </HeroMockupCard>
);

// Data

const PARTNERS = [
    { name: 'Arc',      logo: ARCLOGO    },
    { name: 'Circle',   logo: CIRCLELOGO },
    { name: 'Stripe',   logo: STRIPELOGO },
    { name: 'TRM Labs', logo: TRMLOGO    },
];

const STEP_CONFIGS = [
    {
        n: '01',
        title: 'Connect your wallet',
        body:  'Link any self-custody wallet via WalletConnect. MetaMask, Coinbase Wallet, or any EVM-compatible wallet. Your private keys never leave your device.',
        image: STEP01,
        overlay: 'Link your self-custody wallet in seconds.',
    },
    {
        n: '02',
        title: 'Wrap USDC to TAPUSDC',
        body:  'Deposit USDC into the wrapper contract and receive TAPUSDC 1:1. Redeemable at any time. Your funds stay in your wallet — Koda never takes custody.',
        image: STEP02,
        overlay: 'Convert USDC to TAPUSDC at a fixed 1:1.',
    },
    {
        n: '03',
        title: 'Spend anywhere Visa is accepted',
        body:  'Your Koda virtual Visa card draws directly from your TAPUSDC balance. Every payment settles on-chain in seconds. Koda never holds your funds.',
        image: STEP03,
        overlay: 'Use your Koda card wherever Visa is accepted.',
    },
];

const FEATURES = [
    { icon: Lock,       title: 'Self-custody',         body: 'Your private keys never leave your device. Koda settles on-chain and releases custody the moment a payment clears.',      gradient: '#233f00',   light: false },
    { icon: CreditCard, title: 'Virtual Visa card',    body: 'A real Visa card issued to you — accepted anywhere Visa is taken, online or in-app, worldwide.',                          gradient: '#0f0f1130', light: true  },
    { icon: Zap,        title: 'Real-time settlement', body: 'TAPUSDC is locked for seconds while your payment clears, then released atomically. No overnight holds, ever.',            gradient: '#ffffff',   light: true  },
    { icon: Shield,     title: 'Compliance built in',  body: 'Every wallet is screened at connection. Sanctioned addresses are blocked at the contract level — not just the UI.',       gradient: '#233f00',   light: false },
    { icon: RefreshCw,  title: '1:1 USDC backed',      body: 'Every TAPUSDC is redeemable for exactly one USDC from the wrapper contract reserves at any time. No algorithmic risk.',  gradient: '#0f0f1130', light: true  },
    { icon: Globe,      title: 'Built on Arc',          body: 'Powered by Circle\'s Arc Testnet — a payments-native blockchain built from the ground up for USDC settlement at scale.', gradient: '#ffffff',   light: true  },
];

// Abstract shape

const CtaAbstract = () => (
    <CtaAbstractSvg viewBox="0 0 520 520" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer irregular shape */}
        <path
            d="M420 200 C440 280 400 380 320 420 C240 460 130 430 80 360 C30 290 50 170 120 110 C190 50 290 40 360 80 C430 120 400 120 420 200Z"
            stroke="rgba(255,255,255,0.13)" strokeWidth="1.5"
        />
        {/* Second ring — slightly different curve */}
        <path
            d="M380 210 C395 275 360 355 295 388 C230 421 135 397 95 335 C55 273 72 170 132 118 C192 66 278 58 338 93 C398 128 365 145 380 210Z"
            stroke="rgba(255,255,255,0.11)" strokeWidth="1.5"
        />
        {/* Third ring */}
        <path
            d="M340 218 C352 272 320 336 266 362 C212 388 132 367 100 310 C68 253 82 168 135 122 C188 76 264 70 316 104 C368 138 328 164 340 218Z"
            stroke="rgba(255,255,255,0.09)" strokeWidth="1.5"
        />
        {/* Fourth ring */}
        <path
            d="M302 224 C312 265 285 315 240 336 C195 357 132 338 106 286 C80 234 93 165 140 128 C187 91 254 87 296 118 C338 149 292 183 302 224Z"
            stroke="rgba(255,255,255,0.07)" strokeWidth="1.5"
        />
        {/* Fifth — tight inner */}
        <path
            d="M265 228 C272 258 252 294 218 308 C184 322 140 308 120 268 C100 228 112 178 148 155 C184 132 232 132 258 160 C284 188 258 198 265 228Z"
            stroke="rgba(255,255,255,0.05)" strokeWidth="1.5"
        />
        {/* Core */}
        <path
            d="M230 234 C235 252 222 272 200 280 C178 288 154 276 144 254 C134 232 144 206 164 194 C184 182 216 186 228 208 C234 220 225 216 230 234Z"
            stroke="rgba(255,255,255,0.04)" strokeWidth="1.5"
        />
    </CtaAbstractSvg>
);

// Component

const Home = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <Page>
            {/* Testnet banner */}
            <TestnetBanner>
                <TestnetDot />
                <TestnetText>
                    You are on <TestnetStrong>Arc Testnet</TestnetStrong> — all transactions are simulations.
                    Card payments use <TestnetStrong>Stripe sandbox</TestnetStrong> and no real funds are moved.
                </TestnetText>
            </TestnetBanner>

            {/* Nav */}
            <Nav>
                <NavInner>
                    <Logo href="/">
                        <LogoImg src={KODALOGO} alt="Koda" />
                        <LogoText>Koda</LogoText>
                    </Logo>
                    <NavLinks>
                        <NavA href="#how-it-works">How it works</NavA>
                        <NavA href="#features">Features</NavA>
                        <NavA href="https://kodafi.xyz" target="_blank" rel="noopener noreferrer">About</NavA>
                        <NavA href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer">Docs</NavA>
                    </NavLinks>
                    <NavRight>
                        {!user && <NavSignIn onClick={() => navigate('/login')}>Sign in</NavSignIn>}
                        <NavCta onClick={() => navigate(user ? '/dashboard' : '/signup')}>
                            {user ? 'Open app' : 'Get started'}
                        </NavCta>
                    </NavRight>
                    <HamburgerBtn onClick={() => setMenuOpen(m => !m)} $open={menuOpen} aria-label="Toggle menu">
                        <HamLine $open={menuOpen} $pos="top" />
                        <HamLine $open={menuOpen} $pos="mid" />
                        <HamLine $open={menuOpen} $pos="bot" />
                    </HamburgerBtn>
                </NavInner>
                {menuOpen && (
                    <MobileMenu>
                        <MobileMenuLink href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</MobileMenuLink>
                        <MobileMenuLink href="#features" onClick={() => setMenuOpen(false)}>Features</MobileMenuLink>
                        <MobileMenuLink href="https://kodafi.xyz" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>About</MobileMenuLink>
                        <MobileMenuLink href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>Docs</MobileMenuLink>
                        <MobileMenuActions>
                            {!user && (
                                <MobileMenuSignIn onClick={() => { setMenuOpen(false); navigate('/login'); }}>Sign in</MobileMenuSignIn>
                            )}
                            <MobileMenuCta onClick={() => { setMenuOpen(false); navigate(user ? '/dashboard' : '/signup'); }}>
                                {user ? 'Open app' : 'Get started'}
                            </MobileMenuCta>
                        </MobileMenuActions>
                    </MobileMenu>
                )}
            </Nav>

            {/* Hero */}
            <Hero>
                <HeroInner>
                    <HeroLeft>
                        <HeroTitle>Spend USDC from your <span>own wallet, anywhere.</span></HeroTitle>
                        <HeroDesc>No custodian, no compromise. Your virtual Visa card settles directly on-chain.</HeroDesc>
                        <HeroArrowLink onClick={() => navigate(user ? '/dashboard' : '/signup')}>
                            <HeroArrowCircle><ArrowRight size={16} /></HeroArrowCircle>
                            {user ? 'Open dashboard' : 'Try it free'}
                        </HeroArrowLink>
                    </HeroLeft>
                    <HeroRightPanel>
                        <SpendingMockup />
                    </HeroRightPanel>
                </HeroInner>
            </Hero>

              {/* Features */}
            <FeaturesSection id="features">
                <FeaturesLayout>
                    <FeaturesLeft>
                        <FeaturesHeading>Built for<br />self-custody,<br />end to end.</FeaturesHeading>
                        <FeaturesSub>
                            Every decision, from the smart contract design to the card issuing rails, is made with one principle: you own your funds at every step.
                        </FeaturesSub>
                        <FeatCta onClick={() => navigate(user ? '/dashboard' : '/signup')}>
                            <ArrowCircle><ArrowRight size={14} /></ArrowCircle>
                            {user ? 'Open dashboard' : 'Create your card'}
                        </FeatCta>
                    </FeaturesLeft>

                    <FeaturesRight>
                        <FeaturesGrid>
                            {FEATURES.map(({ icon: Icon, title, body, gradient, light }) => (
                                <FeatCard key={title} style={{ background: gradient }} $light={light}>
                                    <FeatDots $light={light} />
                                    <FeatIconWrap $light={light}>
                                        <Icon size={20} />
                                    </FeatIconWrap>
                                    <FeatTitle $light={light}>{title}</FeatTitle>
                                    <FeatBody $light={light}>{body}</FeatBody>
                                </FeatCard>
                            ))}
                        </FeaturesGrid>
                    </FeaturesRight>
                </FeaturesLayout>
            </FeaturesSection>


          

               {/* Feature cards */}
            <CardsSection>
                <CardSectionTitle>Balance Stays on-chain, at all times!</CardSectionTitle>

                <CardsGrid>
                    {/* Card 1 */}
                    <FeatureCardWrap>
                        <CardVisual $purple>
                            <CardVisualBg />
                            <SpendMockup />
                        </CardVisual>
                        <CardInfo>
                            <CardTitle>Self-custody card payments</CardTitle>
                            <CardBody>
                                Pay directly from your self-custody wallet with a Koda virtual Visa card.
                                Funds never leave your control until the moment of settlement.
                            </CardBody>
                            <CardLink onClick={() => navigate(user ? '/dashboard' : '/signup')}>
                                <ArrowCircle><ArrowRight size={14} /></ArrowCircle>
                                {user ? 'Go to dashboard' : 'Try the Demo'}
                            </CardLink>
                        </CardInfo>
                    </FeatureCardWrap>

                    {/* Card 2 */}
                    <FeatureCardWrap>
                        <CardVisual $teal>
                            <CardVisualBg $teal />
                            <BalanceMockup />
                        </CardVisual>
                        <CardInfo>
                            <CardTitle>On-chain balance in real time</CardTitle>
                            <CardBody>
                                Your TAPUSDC balance updates on-chain with every transaction.
                                Full transparency! every movement is verifiable on Arc Testnet.
                            </CardBody>
                            <CardLink onClick={() => navigate(user ? '/wallet' : '/signup')}>
                                <ArrowCircle><ArrowRight size={14} /></ArrowCircle>
                                {user ? 'View your wallet' : 'See how it works'}
                            </CardLink>
                        </CardInfo>
                    </FeatureCardWrap>
                </CardsGrid>
            </CardsSection>

         

           

            {/* How it works */}
            <StepsSection id="how-it-works">
                <StepsHeader>
                    <SectionHeading>Up and running in three steps</SectionHeading>
                    <SectionSub>Get set up in under 3 minutes!</SectionSub>
                </StepsHeader>

                {STEP_CONFIGS.map((s, i) => (
                    <StepRow key={s.n} $reverse={i % 2 !== 0}>
                        {/* Visual */}
                        <StepVisualCol>
                            <StepVisualCard>
                                <StepImage src={s.image} alt={s.title} />
                                <StepOverlay>
                                    <StepOverlayText>{s.overlay}</StepOverlayText>
                                    <StepLearnBtn>
                                        <StepLearnArrow><ArrowRight size={14} /></StepLearnArrow>
                                        Learn more
                                    </StepLearnBtn>
                                </StepOverlay>
                            </StepVisualCard>
                        </StepVisualCol>

                        {/* Text */}
                        <StepTextCol>
                            <StepWatermark>{s.n}</StepWatermark>
                            <StepBadge>{s.n}</StepBadge>
                            <StepTitle>{s.title}</StepTitle>
                            <StepBody>{s.body}</StepBody>
                        </StepTextCol>
                    </StepRow>
                ))}
            </StepsSection>


            {/* CTA */}
            <CtaSection>
                <CtaCard>
                    <CtaHeading>
                        Ready to spend<br />from self-custody?
                    </CtaHeading>
                    <CtaSub>
                        Create your Koda card in minutes.<br />
                        No KYC required for testnet.
                    </CtaSub>
                    <CtaActions>
                        <CtaPrimaryBtn onClick={() => navigate(user ? '/dashboard' : '/signup')}>
                            {user ? 'Go to dashboard' : 'Create your free card'}
                        </CtaPrimaryBtn>
                        <CtaSecondaryBtn href="#how-it-works">
                            How it works
                        </CtaSecondaryBtn>
                    </CtaActions>
                </CtaCard>
            </CtaSection>

            {/* Footer */}
            <Footer>
                <FooterTop>
                    <FooterBrand>
                        <FooterLogoRow>
                            <LogoImg src={KODALOGO} alt="Koda" style={{ width: 28, height: 28 }} />
                            <FooterName>Koda</FooterName>
                        </FooterLogoRow>
                        <FooterTagline>
                            Self-custody payments,<br />powered by Arc.
                        </FooterTagline>
                    </FooterBrand>
                    <FooterNav>
                        <FooterNavGroup>
                            <FooterNavLabel>Product</FooterNavLabel>
                            <FooterA href="#how-it-works">How it works</FooterA>
                            <FooterA href="#features">Features</FooterA>
                            <FooterA as="button" onClick={() => navigate(user ? '/dashboard' : '/signup')}>
                                {user ? 'Dashboard' : 'Get started'}
                            </FooterA>
                        </FooterNavGroup>
                        <FooterNavGroup>
                            <FooterNavLabel>Company</FooterNavLabel>
                            <FooterA href="https://kodafi.xyz" target="_blank" rel="noopener noreferrer">About</FooterA>
                            <FooterA href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer">Docs</FooterA>
                            <FooterA as="button" onClick={() => navigate('/login')}>Sign in</FooterA>
                        </FooterNavGroup>
                        <FooterNavGroup>
                            <FooterNavLabel>Built with</FooterNavLabel>
                            <FooterA>Arc Testnet</FooterA>
                            <FooterA>Circle USDC</FooterA>
                            <FooterA>Stripe Issuing</FooterA>
                        </FooterNavGroup>
                    </FooterNav>
                </FooterTop>
                <FooterDivider />
                <FooterBottom>
                    <FooterCopy>© 2026 Koda. All rights reserved.</FooterCopy>
                    <FooterNetStatus>
                        <FooterNetDot />
                        Arc Testnet · Live
                    </FooterNetStatus>
                </FooterBottom>
            </Footer>
        </Page>
    );
};

// Animations
const fadeUp = keyframes`from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}`;

// Page
const Page = styled.div`
    min-height: 100vh;
    background: #ffffff;
    font-family: 'Sora', sans-serif;
    overflow-x: hidden;
    color: #06001A;
`;

// Nav
// Testnet banner
const TestnetBanner = styled.div`
    background: #0f0f11;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 9px 20px;
    @media(max-width: 600px) { padding: 8px 16px; }
`;

const TestnetDot = styled.div`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #7bdc05;
    flex-shrink: 0;
`;

const TestnetText = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: rgba(255,255,255,0.5);
    margin: 0;
    text-align: center;
    line-height: 1.5;
`;

const TestnetStrong = styled.span`
    color: rgba(255,255,255,0.85);
    font-weight: 700;
`;

// Nav
const Nav = styled.nav`
    position: sticky;
    top: 0;
    z-index: 100;
    background: #ffffff;
    border-bottom: 1px solid rgba(15,15,17,0.07);
`;

const NavInner = styled.div`
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 40px;
    height: 76px;
    display: flex;
    align-items: center;
    gap: 0;
    width: 100%;
    box-sizing: border-box;

    @media(max-width:768px) { padding: 0 20px; height: 64px; }
`;

const Logo = styled.a`
    display: flex; align-items: center; gap: 12px;
    text-decoration: none; margin-right: auto; flex-shrink: 0;
`;
const LogoImg = styled.img`width: 34px; height: 34px;`;
const LogoText = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 22px; font-weight: 800; color: #0f0f11; letter-spacing: -0.5px;
`;

const NavLinks = styled.div`
    display: flex; align-items: center; gap: 4px;
    @media(max-width:680px) { display: none; }
`;
const NavA = styled.a`
    font-size: 15px; font-weight: 500; color: #0f0f1170;
    text-decoration: none; padding: 10px 16px; border-radius: 8px;
    font-family: 'Google Sans Flex', sans-serif;
    transition: color 0.2s, background 0.2s; white-space: nowrap;
    &:hover { color: #0f0f11; background: rgba(15,15,17,0.05); }
`;
const NavRight = styled.div`
    display: flex; align-items: center; gap: 10px; margin-left: 20px; flex-shrink: 0;
    @media(max-width:768px) { display: none; }
`;
const NavSignIn = styled.button`
    font-size: 14px; font-weight: 600; color: #0f0f11;
    background: none; border: 1.5px solid rgba(15,15,17,0.18);
    border-radius: 8px; padding: 10px 20px;
    font-family: 'Google Sans Flex', sans-serif; cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    &:hover { border-color: rgba(15,15,17,0.4); background: rgba(15,15,17,0.04); }
`;
const NavCta = styled.button`
    padding: 10px 22px;
    background: #233f00; color: #fff;
    border: none; border-radius: 8px;
    font-family: 'Google Sans Flex', sans-serif; font-size: 14px; font-weight: 700;
    cursor: pointer; white-space: nowrap;
    transition: opacity 0.2s, transform 0.15s;
    &:hover { opacity: 0.82; transform: translateY(-1px); }
`;

// Mobile nav
const mobileMenuSlide = keyframes`
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const HamburgerBtn = styled.button`
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 5px;
    width: 40px;
    height: 40px;
    background: none;
    border: 1px solid rgba(15,15,17,0.15);
    border-radius: 9px;
    cursor: pointer;
    padding: 0;
    margin-left: 12px;
    flex-shrink: 0;

    @media(max-width:768px) { display: flex; }
`;

const HamLine = styled.span`
    display: block;
    width: 18px;
    height: 2px;
    background: #0f0f11;
    border-radius: 2px;
    transition: transform 0.22s ease, opacity 0.22s ease;

    ${p => p.$open && p.$pos === 'top' && `transform: translateY(7px) rotate(45deg);`}
    ${p => p.$open && p.$pos === 'mid' && `opacity: 0; transform: scaleX(0);`}
    ${p => p.$open && p.$pos === 'bot' && `transform: translateY(-7px) rotate(-45deg);`}
`;

const MobileMenu = styled.div`
    display: none;
    flex-direction: column;
    padding: 8px 20px 24px;
    background: #ffffff;
    border-top: 1px solid rgba(15,15,17,0.07);
    animation: ${mobileMenuSlide} 0.2s ease both;

    @media(max-width:768px) { display: flex; }
`;

const MobileMenuLink = styled.a`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 17px;
    font-weight: 500;
    color: #0f0f1175;
    text-decoration: none;
    padding: 16px 4px;
    border-bottom: 1px solid rgba(15,15,17,0.06);
    transition: color 0.15s;
    &:hover { color: #0f0f11; }
`;

const MobileMenuActions = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 20px;
`;

const MobileMenuSignIn = styled.button`
    padding: 14px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 600;
    color: #0f0f11;
    background: none;
    border: 1.5px solid rgba(15,15,17,0.18);
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    &:hover { border-color: rgba(15,15,17,0.4); background: rgba(15,15,17,0.04); }
`;

const MobileMenuCta = styled.button`
    padding: 14px;
    background: #233f00;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s;
    &:hover { opacity: 0.82; }
`;

// Hero
const Hero = styled.section`
    background: #ffffff;
    padding: 80px 40px 100px;
    @media(max-width: 768px) { padding: 56px 20px 64px; }
`;

const HeroInner = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
    @media(max-width: 900px) {
        grid-template-columns: 1fr;
        gap: 48px;
    }
`;

const HeroLeft = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
`;



const HeroTitle = styled.h1`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: clamp(32px, 3.8vw, 60px);
    font-weight: 800;
    color: #0f0f11;
    line-height: 1.1;
    letter-spacing: -1.5px;
    margin: 0 0 18px;
    span { color: #233f00; }
`;

const HeroDesc = styled.p`
    font-size: 16px;
    font-family: 'Google Sans Flex', sans-serif;
    color: #0f0f1180;
    line-height: 1.65;
    margin: 0 0 32px;
    max-width: 400px;
`;

const HeroArrowLink = styled.button`
    display: flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    padding: 0;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #0f0f11;
    cursor: pointer;
    transition: gap 0.2s;
    &:hover { gap: 14px; }
`;

const HeroArrowCircle = styled.div`
    width: 36px; height: 36px;
    border-radius: 50%;
    background: #233f00;
    display: grid; place-items: center;
    color: #fff;
    flex-shrink: 0;
    transition: opacity 0.2s;
    ${HeroArrowLink}:hover & { opacity: 0.7; }
`;

// Hero right panel
const HeroRightPanel = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0f0f1130;
    border-radius: 28px;
    padding: 28px;
    @media(max-width: 900px) { display: none; }
`;

const HeroMockupCard = styled.div`
    background: #ffffff;
    border-radius: 20px;
    padding: 24px;
    width: 100%;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
`;

const HeroMockupHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
`;

const HeroMockupHeaderLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const HeroMockupPill = styled.div`
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #233f00;
`;

const HeroMockupTitle = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #0f0f11;
`;

const HeroMockupBadge = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: #233f00;
    background: #233f0015;
    border-radius: 20px;
    padding: 3px 10px;
`;

const HeroMockupBalance = styled.div`
    margin-bottom: 14px;
`;

const HeroMockupBalLabel = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #0f0f1160;
    margin: 0 0 4px;
`;

const HeroMockupBalNum = styled.p`
    font-family: 'Saira', sans-serif;
    font-size: 26px;
    font-weight: 800;
    color: #0f0f11;
    letter-spacing: -0.5px;
    margin: 0;
`;

const HeroMockupBalCcy = styled.span`
    font-size: 14px;
    font-weight: 600;
    color: #0f0f1160;
`;

const HeroMockupDivider = styled.div`
    height: 1px;
    background: #0f0f1110;
    margin: 14px 0;
`;

const HeroMockupTx = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 0;
    border-bottom: 1px solid #0f0f1108;
    &:last-child { border-bottom: none; }
`;

const HeroFlagWrap = styled.div`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    border: 1.5px solid #0f0f1110;
    display: flex;
    align-items: center;
    justify-content: center;
`;

const HeroMockupTxMeta = styled.div`
    flex: 1;
    min-width: 0;
`;

const HeroMockupTxName = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #0f0f11;
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const HeroMockupTxSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: #0f0f1160;
    margin: 0;
`;

const HeroMockupTxAmt = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #0f0f11;
    flex-shrink: 0;
`;

/* Right cards panel */
const HeroRight = styled.div`
    display: flex;
    flex-direction: column;
    gap: 25px;
    @media(max-width: 768px) { display: none};
`;

const HeroCardRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px;
    flex: 1;
    @media(max-width:900px) { grid-template-columns: 1fr; gap: 16px; }
`;

const HeroCard = styled.div`
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-radius: 15px;
    gap: 12px;
    padding: 28px;
    transition: filter 0.2s;
    &:hover { filter: brightness(1.08); }
    @media(max-width:768px) { padding: 22px 20px; gap: 10px; }

    /* Dark card — rings centred top-left */
    ${p => p.$dark && `
        background:
            radial-gradient(circle at 12% 18%, #2e4d72 0%, #2e4d72 8%,  transparent 8%),
            radial-gradient(circle at 12% 18%, #254262 0%, #254262 17%, transparent 17%),
            radial-gradient(circle at 12% 18%, #1e3450 0%, #1e3450 28%, transparent 28%),
            radial-gradient(circle at 12% 18%, #192a40 0%, #192a40 42%, transparent 42%),
            radial-gradient(circle at 12% 18%, #162035 0%, #162035 58%, transparent 58%),
            #0f1928;
    `}

    /* Light card — rings centred bottom-right */
    ${p => !p.$dark && !p.$accent && `
        background:
            radial-gradient(circle at 82% 85%, #d8dce8 0%, #d8dce8 8%,  transparent 8%),
            radial-gradient(circle at 82% 85%, #dfe2ec 0%, #dfe2ec 18%, transparent 18%),
            radial-gradient(circle at 82% 85%, #e6e8f1 0%, #e6e8f1 30%, transparent 30%),
            radial-gradient(circle at 82% 85%, #eceff5 0%, #eceff5 44%, transparent 44%),
            radial-gradient(circle at 82% 85%, #f1f2f7 0%, #f1f2f7 60%, transparent 60%),
            #F4F6F9;
    `}

    /* Accent card — rings centred top-right */
    ${p => p.$accent && `
        background:
            radial-gradient(circle at 80% 15%, #857e00 0%, #857e00 8%,  transparent 8%),
            radial-gradient(circle at 80% 15%, #787200 0%, #787200 18%, transparent 18%),
            radial-gradient(circle at 80% 15%, #6e6800 0%, #6e6800 30%, transparent 30%),
            radial-gradient(circle at 80% 15%, #696400 0%, #696400 44%, transparent 44%),
            radial-gradient(circle at 80% 15%, #636000 0%, #636000 60%, transparent 60%),
            #585600;
    `}
`;

const HeroCardIcon = styled.div`
    position: relative;
    z-index: 1;
    width: 150px; height: 150px;
    border-radius: 50%;
    display: grid; place-items: center;
    background: ${p => p.$dark   ? 'rgba(255,255,255,0.1)'
                       : p.$accent ? 'rgba(255,255,255,0.15)'
                       : '#06001A'};
    color: ${p => (p.$dark || p.$accent) ? '#ffffff' : '#ffffff'};
    flex-shrink: 0;
    @media(max-width:768px) { width: 96px; height: 96px; }
`;

const HeroCardBody = styled.div`flex: 1; position: relative; z-index: 1;`;

const HeroCardTitle = styled.h3`
    font-size: 32px;
    font-family: Saira, Sans serif;
    text-align: center;
    font-weight: 800;
    margin: 0 0 6px;
    letter-spacing: -0.2px;
    color: ${p => p.$dark ? '#ffffff' : '#06001A'};
    @media(max-width:768px) { font-size: 22px; }
`;

const HeroCardDesc = styled.p`
    font-size: 14px;
    text-align: center;
    font-family: Google Sans Flex, Sans serif;
    line-height: 1.6;
    margin: 0;
    color: ${p => p.$dark ? 'rgba(255,255,255,0.6)' : 'rgba(6,0,26,0.55)'};
    @media(max-width:768px) { font-size: 13px; }
`;

const HeroCardLink = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    padding: 0;
    font-family: 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: ${p => p.$dark || p.$accent ? '#ffffff' : '#06001A'};
    cursor: pointer;
    transition: gap 0.2s;
    margin-top: auto;
    &:hover { gap: 12px; }
`;

const HeroCardArrow = styled.div`
    width: 28px; height: 28px;
    border-radius: 50%;
    display: grid; place-items: center;
    background: ${p => p.$dark   ? '#100196'
                       : p.$accent ? '#ffffff'
                       : '#06001A'};
    color: ${p => p.$accent ? '#100196' : '#ffffff'};
    flex-shrink: 0;
`;

// Pre-cards connector row
const PreCardsRow = styled.div`
    width: 80%;
    margin: 0 auto;
    height: 100px;
    background-color: #e2e2e2;
    grid-template-columns: 1fr 1fr;
    @media(min-width: 768px) { display: none; } 
    @media(max-width: 768px) {
        display: flex;
        flex-direction: column;
        width: 94%; 
        height: 200px; 
        clip-path: polygon(0 10%, 100% 0, 100% 100%, 0% 100%);
        align-items: center;
        justify-content: center;
 }
`;
const PreCardsLeft  = styled.div`
    position: relative;
    @media(max-width: 768px) { border-bottom-right-radius: 24px; background-color: #ffffff; }`;

const PreCardsLeftBg = styled.div`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%
    background: #e2e2e2;
    z-index: -1;
`;
const PreCardsRight = styled.div`
    background: #e2e2e2;
    @media(max-width: 768px) { border-top-right-radius: 24px; border-top-left-radius: 24px; }
`
// Cards section
const CardsSection = styled.section`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80%;
    margin: 0 auto;
    padding: 100px 0px;
    border-radius: 45px;
    background-color: #e2e2e2;
    background-image:
        radial-gradient(circle at 50% 50%, #b0b0b0 0%,  #b0b0b0 12%, transparent 12%),
        radial-gradient(circle at 50% 50%, #b8b8b8 0%,  #b8b8b8 22%, transparent 22%),
        radial-gradient(circle at 50% 50%, #c2c2c2 0%,  #c2c2c2 33%, transparent 33%),
        radial-gradient(circle at 50% 50%, #cccccc 0%,  #cccccc 45%, transparent 45%),
        radial-gradient(circle at 50% 50%, #d4d4d4 0%,  #d4d4d4 58%, transparent 58%),
        radial-gradient(circle at 50% 50%, #dadada 0%,  #dadada 72%, transparent 72%);

    @media(max-width:768px) {
        padding: 40px 24px 60px;
        width: 94%;
        border-radius: 24px;
        box-sizing: border-box;
        

    }
`;

const CardSectionTitle = styled.h3`
    font-family: Saira, Sans serif;
    font-weight: 800;
    font-size: clamp(32px, 6vw, 56px);
    color: #06001A;
    text-align: center;
    margin-top: 0;
    padding: 0 16px;
    `
const CardsGrid = styled.div`
    width: 100%;
    max-width: 1200px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    box-sizing: border-box;
    @media(max-width:900px){grid-template-columns:1fr;}
`;

const FeatureCardWrap = styled.div``;

const CardVisual = styled.div`
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    height: 340px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
    background: url(${LEFTBG});
    background-size: cover;
    @media(max-width:768px) { height: 260px; border-radius: 16px; }
`;

const CardVisualBg = styled.div`
    position: absolute; inset: 0; pointer-events: none;
    background-image: ${p => p.$teal
        ? 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)'
        : 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)'};
    background-size: 28px 28px;
`;

const CardInfo = styled.div`padding: 0 4px;`;
const CardTitle = styled.h3`
    font-size: 26px; font-family: 'Saira', Sans serif; font-weight: 800; color: #06001A; margin: 0 0 10px; letter-spacing: -0.5px;
    @media(max-width:768px) { font-size: 20px; }
`;
const CardBody = styled.p`
    font-size: 16px; font-family: 'Google Sans Flex', Sans serif; color: #06001A80; line-height: 1.7; margin: 0 0 16px;
    @media(max-width:768px) { font-size: 14px; }
`;
const CardLink = styled.button`
    display: flex; align-items: center; gap: 10px;
    background: none; border: none; padding: 0;
    font-family: 'Google Sans Flex', sans-serif; font-size: 16px; font-weight: 700;
    color: #06001A; cursor: pointer; transition: gap 0.2s;
    &:hover{gap:14px;}
`;
const ArrowCircle = styled.div`
    width: 32px; height: 32px; border-radius: 50%;
    background: #233f00;
    color: #fff;
    display: grid; place-items: center; flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s;
    ${CardLink}:hover & { opacity: 0.8; }
`;

// Mockups
const Mockup = styled.div`
    position: relative; z-index: 1;
    width: 80%; max-width: 300px;
    background: ${p => p.$light ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.12)'};
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 16px;
    padding: 20px;
`;
const MockupHeader = styled.div`display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:14px;`;
const MockupPill = styled.div`width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.3);`;
const MockupLabel = styled.p`font-size:13px;font-weight:700;color:#fff;margin:0;`;
const MockupDivider = styled.div`height:1px;background:rgba(255,255,255,0.15);margin:10px 0;`;
const MockupRow = styled.div`display:flex;justify-content:space-between;align-items:center;padding:5px 0;`;
const MockupKey = styled.span`font-size:11px;color:rgba(255,255,255,0.55);`;
const MockupVal = styled.span`
    font-size:12px;font-weight:700;color:#fff;
    font-family:${p=>p.mono?"'SF Mono',monospace":"'Sora',sans-serif"};
`;
const MockupBtn = styled.button`
    width:100%;margin-top:12px;padding:10px;
    background:#fff;color:#06001A;border:none;border-radius:8px;
    font-family:'Sora',sans-serif;font-size:12px;font-weight:800;cursor:pointer;
`;
const MockupEyebrow = styled.p`font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin:0 0 6px;`;
const MockupBigNum = styled.p`font-size:22px;font-weight:900;color:#fff;margin:0 0 6px;letter-spacing:-0.5px;`;
const MockupCcy = styled.span`font-size:13px;font-weight:600;opacity:0.6;`;
const MockupNetRow = styled.div`display:flex;align-items:center;gap:6px;margin-bottom:16px;`;
const MockupDot = styled.div`width:6px;height:6px;border-radius:50%;background:#4ADE80;`;
const MockupNetLabel = styled.span`font-size:11px;color:rgba(255,255,255,0.5);`;
const MockupBars = styled.div`display:flex;align-items:flex-end;gap:4px;height:48px;`;
const MockupBar = styled.div`
    flex:1;border-radius:3px 3px 0 0;
    height:${p=>p.$h}%;background:rgba(255,255,255,0.35);
`;
const MockupBarLabel = styled.p`font-size:9px;color:rgba(255,255,255,0.35);margin:6px 0 0;text-align:center;`;

// Steps
const StepsSection = styled.section`
    padding: 60px 0 80px;
    overflow: hidden;
`;
const StepsHeader = styled.div`
    max-width: 1300px;
    margin: 0 auto;
    padding: 0 40px;
    text-align: center;
    margin-bottom: 48px;
    @media(max-width:768px){padding:0 24px;margin-bottom:36px;}
`;
const SectionEyebrow = styled.p`
    font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;
    color:rgba(6,0,26,0.4);margin:0 0 12px;
    font-family: 'Google Sans Flex', sans-serif;
`;
const SectionHeading = styled.h2`
    font-size: clamp(28px, 4vw, 56px);
    font-weight: 800;
    font-family: 'Saira', sans-serif;
    color: #06001A;
    line-height: 1.1;
    margin: 0 0 12px;
`;
const SectionSub = styled.p`
    font-size: 18px;
    color: rgba(6,0,26,0.5);
    line-height: 1.5;
    font-family: 'Google Sans Flex', sans-serif;
    max-width: 520px;
    margin: 0 auto;
    @media(max-width:768px) { font-size: 15px; }
`;
const StepRow = styled.div`
    max-width: 1300px;
    margin: 0 auto;
    padding: 24px 40px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 72px;
    align-items: center;

    ${p => p.$reverse && `
        > :first-child { order: 2; }
        > :last-child  { order: 1; }
    `}

    @media(max-width:900px){
        grid-template-columns: 1fr;
        gap: 28px;
        padding: 24px 24px;
        > :first-child { order: 1 !important; }
        > :last-child  { order: 2 !important; }
    }
`;
const StepVisualCol = styled.div`width: 100%;`;
const StepVisualCard = styled.div`
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    height: 380px;
    box-shadow:
        0 24px 60px rgba(6,0,26,0.18),
        0 6px 20px rgba(6,0,26,0.1);
    @media(max-width:768px){height:260px;}
`;
const StepImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    filter: blur(3px);
    transform: scale(1.03);
`;
const StepOverlay = styled.div`
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    background: rgba(255,255,255,0.12);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 12px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
`;
const StepOverlayText = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 16px;
    font-weight: 500;
    color: #ffffff;
    margin: 0;
    line-height: 1.5;
    @media(max-width:768px) { font-size: 14px; }
`;
const StepLearnBtn = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #ffffff;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: gap 0.2s;
    &:hover { gap: 12px; }
`;
const StepLearnArrow = styled.div`
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #233f00;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s;
    ${StepLearnBtn}:hover & {
        background: rgba(255,255,255,0.35);
        border-color: rgba(255,255,255,0.6);
    }
`;
const StepTextCol = styled.div`
    position: relative;
    padding: 16px 0;
`;
const StepWatermark = styled.div`
    font-family: 'Saira', sans-serif;
    font-size: 140px;
    font-weight: 900;
    color: rgba(6,0,26,0.08);
    line-height: 1;
    letter-spacing: -8px;
    position: absolute;
    top: -16px;
    left: -16px;
    user-select: none;
    pointer-events: none;
    @media(max-width:768px){font-size:90px;}
`;
const StepBadge = styled.div`
    display: inline-flex;
    align-items: center;
    padding: 5px 14px;
    background: #233f00;
    color: #fff;
    border-radius: 100px;
    font-family: 'Saira', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-bottom: 18px;
    position: relative;
`;
const StepTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: clamp(22px, 2.5vw, 32px);
    font-weight: 700;
    color: #06001A;
    margin: 0 0 14px;
    letter-spacing: -0.5px;
    line-height: 1.2;
    position: relative;
`;
const StepBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 16px;
    color: rgba(6,0,26,0.55);
    line-height: 1.7;
    margin: 0;
    position: relative;
    max-width: 440px;
`;

// Wallet mockup
const WalletOption = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    border-radius: 10px;
    margin-bottom: 6px;
    cursor: pointer;
    background: ${p => p.$active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'};
    border: 1px solid ${p => p.$active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)'};
    transition: background 0.15s;
`;
const WalletEmoji = styled.span`font-size: 18px; line-height: 1; flex-shrink: 0;`;
const WalletMeta = styled.div`flex: 1;`;
const WalletName = styled.p`font-size: 13px; font-weight: 700; color: #fff; margin: 0 0 1px;`;
const WalletSub = styled.p`font-size: 10px; color: rgba(255,255,255,0.45); margin: 0;`;
const WalletChevron = styled.span`
    font-size: 18px;
    color: ${p => p.$active ? '#fff' : 'rgba(255,255,255,0.3)'};
    font-weight: 300;
`;

// Wrap mockup
const SwapBox = styled.div`
    background: ${p => p.$accent ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'};
    border: 1px solid ${p => p.$accent ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'};
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 4px;
`;
const SwapBoxLabel = styled.p`font-size: 10px; color: rgba(255,255,255,0.45); margin: 0 0 6px;`;
const SwapBoxRow = styled.div`display: flex; align-items: center; justify-content: space-between;`;
const SwapAmount = styled.span`font-size: 20px; font-weight: 800; color: #fff;`;
const SwapToken = styled.span`
    font-size: 11px; font-weight: 800;
    color: ${p => p.$accent ? '#a78bfa' : 'rgba(255,255,255,0.6)'};
    background: ${p => p.$accent ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.1)'};
    padding: 4px 10px; border-radius: 20px;
`;
const SwapArrowRow = styled.div`display: flex; justify-content: center; padding: 4px 0;`;
const SwapArrowCircle = styled.div`
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
    display: grid; place-items: center;
    font-size: 14px; color: rgba(255,255,255,0.6);
`;
const SwapInfo = styled.div`margin: 4px 0 8px;`;
const SwapInfoRow = styled.div`
    display: flex; justify-content: space-between;
    font-size: 10px; color: rgba(255,255,255,0.4);
    padding: 3px 0;
`;

// Features
const FeaturesSection = styled.section`
    padding: 100px 40px 120px;
    @media(max-width:768px) { padding: 64px 24px 80px; }
`;
const FeaturesLayout = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 80px;
    align-items: start;

    @media(max-width:1024px) { grid-template-columns: 320px 1fr; gap: 48px; }
    @media(max-width:820px)  { grid-template-columns: 1fr; gap: 48px; }
`;
const FeaturesLeft = styled.div`
    position: sticky;
    top: 100px;

    @media(max-width:820px) { position: static; }
`;
const FeaturesHeading = styled.h2`
    font-size: clamp(30px, 4vw, 48px);
    font-weight: 800;
    font-family: Saira, Sans serif;
    color: #06001A;
    letter-spacing: -1.5px;
    line-height: 1.1;
    margin: 0 0 20px;
`;
const FeaturesSub = styled.p`
    font-size: 18px;
    font-family: Google Sans Flex, Sans serif;
    color: #06001A80;
    line-height: 1.3;
    margin: 0 0 32px;
`;
const FeatCta = styled.button`
    display: flex;
    align-items: center;
    gap: 12px;
    background: none;
    border: none;
    padding: 0;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 16px;
    font-weight: 700;
    color: #06001A;
    cursor: pointer;
    transition: gap 0.2s;
    &:hover { gap: 16px; }
    &:hover ${ArrowCircle} { opacity: 0.6 }
`;
const FeaturesRight = styled.div``;
const FeaturesGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    @media(max-width:560px) { grid-template-columns: 1fr; gap: 12px; }
`;
const FeatCard = styled.div`
    position: relative;
    overflow: hidden;
    border-radius: 20px;
    padding: 28px;
    border: ${p => p.$light ? '1px solid rgba(15,15,17,0.08)' : 'none'};
    box-shadow: ${p => p.$light
        ? '0 4px 20px rgba(6,0,26,0.06), 0 1px 4px rgba(6,0,26,0.04)'
        : '0 20px 48px rgba(6,0,26,0.18), 0 4px 16px rgba(6,0,26,0.1)'};
    transition: transform 0.25s, box-shadow 0.25s;
    &:hover {
        transform: translateY(-6px);
        box-shadow: ${p => p.$light
            ? '0 12px 36px rgba(6,0,26,0.1), 0 4px 12px rgba(6,0,26,0.06)'
            : '0 32px 64px rgba(6,0,26,0.22), 0 8px 24px rgba(6,0,26,0.12)'};
    }
    @media(max-width:560px) { padding: 20px; border-radius: 16px; }
`;
const FeatDots = styled.div`
    position: absolute;
    inset: 0;
    background-image: radial-gradient(
        ${p => p.$light ? 'rgba(6,0,26,0.06)' : 'rgba(255,255,255,0.07)'} 1px,
        transparent 1px
    );
    background-size: 24px 24px;
    pointer-events: none;
`;
const FeatIconWrap = styled.div`
    position: relative;
    width: 48px; height: 48px;
    border-radius: 14px;
    background: ${p => p.$light ? 'rgba(15,15,17,0.07)' : 'rgba(255,255,255,0.18)'};
    display: grid; place-items: center;
    color: ${p => p.$light ? '#0f0f11' : '#fff'};
    margin-bottom: 20px;
`;
const FeatTitle = styled.h3`
    position: relative;
    font-size: 16px; font-weight: 800;
    color: ${p => p.$light ? '#06001A' : '#ffffff'};
    margin: 0 0 10px; letter-spacing: -0.3px;
`;
const FeatBody = styled.p`
    position: relative;
    font-size: 13px;
    color: ${p => p.$light ? 'rgba(6,0,26,0.55)' : 'rgba(255,255,255,0.6)'};
    line-height: 1.7; margin: 0;
`;

// Partners marquee

const marqueeAni = keyframes`
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
`;

const PartnersSection = styled.section`
    padding: 0 40px;
    @media(max-width:768px) { padding: 0 24px; }
`;

const PartnersInner = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    height: 80px;
    border-radius: 16px;
    overflow: hidden;
`;

const PartnersLeft = styled.div`
    display: flex;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
    padding: 0 32px;

    @media(max-width:640px) { display: none; }
`;

const PartnersStaticText = styled.p`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: rgba(6,0,26,0.35);
    line-height: 1.5;
    margin: 0;
    white-space: nowrap;
    font-family: 'Google Sans Flex', Sans serif;
`;

const PartnersRule = styled.div`
    width: 1px;
    height: 36px;
    background: rgba(6,0,26,0.12);
    margin-left: 24px;
`;

const PartnersTrackWrap = styled.div`
    flex: 1;
    overflow: hidden;
    position: relative;
    mask-image: linear-gradient(
        to right,
        transparent 0%,
        black 8%,
        black 92%,
        transparent 100%
    );
    -webkit-mask-image: linear-gradient(
        to right,
        transparent 0%,
        black 8%,
        black 92%,
        transparent 100%
    );
`;

const PartnersTrack = styled.div`
    display: flex;
    align-items: center;
    gap: 0;
    width: max-content;
    animation: ${marqueeAni} 28s linear infinite;

    &:hover { animation-play-state: paused; }
`;

const PartnerSlot = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 40px;
    border-right: 1px solid rgba(6,0,26,0.07);
    height: 80px;
    flex-shrink: 0;
    transition: background 0.2s;
    &:hover { background: rgba(255,255,255,0.5); }
`;

const PartnerImg = styled.img`
    height: 22px;
    object-fit: contain;
    opacity: 1;
    filter: grayscale(100%);
    transition: opacity 0.2s, filter 0.2s;
    ${PartnerSlot}:hover & { opacity: 1; filter: none; }
`;

const PartnerText = styled.span`
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.3px;
    white-space: nowrap;
    opacity: 0.55;
    transition: opacity 0.2s;
    ${PartnerSlot}:hover & { opacity: 1; }
`;

const ArcImg = styled.img`height: 14px; opacity: 0.65;`;

// CTA
const CtaSection = styled.section`
    padding: 40px 40px 100px;
    @media(max-width:768px) { padding: 24px 24px 80px; }
`;
const CtaCard = styled.div`
    position: relative;
    max-width: 1200px;
    margin: 0 auto;
    border-radius: 28px;
    padding: 80px 60px;
    text-align: center;
    overflow: hidden;
    box-shadow:
        0 32px 80px rgba(0,0,0,0.35),
        0 8px 24px rgba(0,0,0,0.2);

    background:
        radial-gradient(ellipse at 50% 0%, rgba(200,255,80,0.46) 0%, transparent 55%),
        radial-gradient(ellipse at 85% 110%, rgba(200,255,80,0.16) 0%, transparent 45%),
        #233f00;

    @media(max-width:768px) { padding: 56px 32px; border-radius: 20px; }
    @media(max-width:480px) { padding: 40px 20px 36px; border-radius: 16px; }
`;
const CtaEyebrow = styled.p`
    position: relative;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; color: rgba(255,255,255,0.4);
    margin: 0 0 20px;
`;
const CtaHeading = styled.h2`
    position: relative;
    font-family: 'Saira', sans-serif;
    font-size: clamp(32px, 5vw, 60px);
    font-weight: 700; color: #ffffff;
    letter-spacing: -1.5px; line-height: 1.1;
    margin: 0 0 20px;
`;
const CtaSub = styled.p`
    position: relative;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 18px; color: #ffffff80;
    line-height: 1.7; margin: 0 0 40px;
`;
const CtaActions = styled.div`
    position: relative;
    display: flex; align-items: center;
    justify-content: center; gap: 16px; flex-wrap: wrap;
    @media(max-width:480px) { flex-direction: column; width: 100%; gap: 10px; }
`;
const CtaPrimaryBtn = styled.button`
    padding: 16px 36px;
    background: #ffffff; color: #0f0f11;
    border: none; border-radius: 15px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px; font-weight: 800;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
    &:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.3); background: #f0f0f0; }
    @media(max-width:480px) { width: 100%; padding: 16px; }
`;
const CtaSecondaryBtn = styled.a`
    padding: 16px 28px;
    background: #ffffff30;
    color: #ffffff;
    border: none;
    border-radius: 15px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.75);
    text-decoration: none; cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
    &:hover { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.4); }
    @media(max-width:480px) { width: 100%; text-align: center; padding: 14px; box-sizing: border-box; }
`;

// Footer
const Footer = styled.footer`
    background: #0f0f11;
    padding: 64px 40px 32px;
    border-top: 1px solid rgba(255,255,255,0.05);
    @media(max-width:768px) { padding: 48px 24px 28px; }
`;
const FooterTop = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 80px;
    padding-bottom: 48px;
    @media(max-width:900px) { grid-template-columns: 1fr; gap: 48px; }
`;
const FooterBrand = styled.div``;
const FooterLogoRow = styled.div`display: flex; align-items: center; gap: 10px; margin-bottom: 16px;`;
const FooterName = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.3px;
`;
const FooterTagline = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px; color: rgba(255,255,255,0.3);
    line-height: 1.7; margin: 0;
`;
const FooterNav = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 40px;
    @media(max-width:600px) { grid-template-columns: repeat(2, 1fr); gap: 32px; }
`;
const FooterNavGroup = styled.div`display: flex; flex-direction: column; gap: 12px;`;
const FooterNavLabel = styled.p`
    font-family: 'Saira', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
    text-transform: uppercase; color: rgba(255,255,255,0.2); margin: 0 0 4px;
`;
const FooterA = styled.a`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.4);
    text-decoration: none; cursor: pointer; transition: color 0.2s;
    background: none; border: none;
    text-align: left; padding: 0;
    &:hover { color: rgba(255,255,255,0.85); }
`;
const FooterDivider = styled.div`
    max-width: 1200px; margin: 0 auto;
    height: 1px; background: rgba(255,255,255,0.06);
`;
const FooterBottom = styled.div`
    max-width: 1200px; margin: 24px auto 0;
    display: flex; justify-content: space-between;
    align-items: center; gap: 12px; flex-wrap: wrap;
`;
const FooterCopy = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px; color: rgba(255,255,255,0.2);
`;
const FooterNetStatus = styled.div`
    display: flex; align-items: center; gap: 7px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px; color: rgba(255,255,255,0.2); font-weight: 500;
`;
const FooterNetDot = styled.div`
    width: 6px; height: 6px; border-radius: 50%; background: #22C55E;
`;

export default Home;
