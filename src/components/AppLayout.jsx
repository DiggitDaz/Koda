import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Wallet, CreditCard, Repeat, LogOut, ShoppingBag, Menu, X, RefreshCw, Copy, Check, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useWallet } from '../context/WalletContext.js';
import kodaLogo from '../assets/koda-logo.png';
import { arcSend } from '../lib/arcRpc.js';
import { ethers } from 'ethers';

const TAPUSDC_ADDRESS = '0xCb96C70be34cd6484e69D1BEd5ad2F22602191e3';
const USDC_ADDRESS    = '0x3600000000000000000000000000000000000000';
const WRAPPER_ADDRESS = '0x9D845625eb0010F9a63213240Da722424C684DCf';

const ERC20_IFACE = new ethers.Interface([
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
]);

const NAV_ITEMS = [
    { path: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
    { path: '/wallet',        label: 'Wallet',         icon: Wallet },
    { path: '/payments',      label: 'Payments',       icon: CreditCard },
    { path: '/subscriptions', label: 'Subscriptions',  icon: Repeat },
    { path: '/store',         label: 'Test Store',     icon: ShoppingBag, demo: true },
];

const AppLayout = () => {
    const { user, logout } = useAuth();
    const { isConnected, address, connect, disconnect, connecting, fetchBalances } = useWallet();
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [tapusdcSupply, setTapusdcSupply] = useState(null);
    const [usdcInWrapper, setUsdcInWrapper] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);

    useEffect(() => {
        async function fetchProtocolStats() {
            setStatsLoading(true);
            try {
                const [supplyRaw, balanceRaw] = await Promise.all([
                    arcSend('eth_call', [{ to: TAPUSDC_ADDRESS, data: ERC20_IFACE.encodeFunctionData('totalSupply') }, 'latest']),
                    arcSend('eth_call', [{ to: USDC_ADDRESS,    data: ERC20_IFACE.encodeFunctionData('balanceOf', [WRAPPER_ADDRESS]) }, 'latest']),
                ]);
                if (supplyRaw  && supplyRaw  !== '0x') setTapusdcSupply(ERC20_IFACE.decodeFunctionResult('totalSupply', supplyRaw)[0]);
                if (balanceRaw && balanceRaw !== '0x') setUsdcInWrapper(ERC20_IFACE.decodeFunctionResult('balanceOf', balanceRaw)[0]);
            } catch { /* silent */ }
            setStatsLoading(false);
        }
        fetchProtocolStats();
    }, []);

    const handleLogout = () => { logout(); navigate('/login'); };
    const shortAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
    const copyAddress = () => {
        if (!address) return;
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
    const firstName = user?.full_name?.split(' ')[0] || 'there';
    const fmtSupply = (b) => {
        if (b === null) return '—';
        const n = parseFloat(ethers.formatUnits(b, 6));
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const initials = user?.full_name
        ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <Layout>
            {/* Mobile header */}
            <MobileHeader>
                <MobileLogoRow>
                    <img src={kodaLogo} alt="Koda" height={28} style={{ display: 'block' }} />
                    <MobileLogoName>Koda</MobileLogoName>
                </MobileLogoRow>
                <MobileHamBtn onClick={() => setMobileOpen(m => !m)}>
                    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </MobileHamBtn>
            </MobileHeader>

            {mobileOpen && (
                <>
                    <MobileOverlay onClick={() => setMobileOpen(false)} />
                    <MobileDrawer>
                        <MobileNav>
                            {NAV_ITEMS.map(({ path, label, icon: Icon, demo }) => (
                                <MobileNavItem key={path} to={path} end={path === '/dashboard'} onClick={() => setMobileOpen(false)}>
                                    <Icon size={16} />
                                    <span>{label}</span>
                                    {demo && <DemoBadge>DEMO</DemoBadge>}
                                </MobileNavItem>
                            ))}
                            <MobileDrawerDivider />
                            <MobileDocsLink href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer" onClick={() => setMobileOpen(false)}>
                                Docs
                            </MobileDocsLink>
                        </MobileNav>
                        <MobileDrawerDivider />
                        <MobileUserRow>
                            <Avatar>{initials}</Avatar>
                            <UserInfo>
                                <UserName>{user?.full_name || 'User'}</UserName>
                                <UserEmail>{user?.email || ''}</UserEmail>
                            </UserInfo>
                            <LogoutBtn onClick={() => { setMobileOpen(false); handleLogout(); }} title="Sign out">
                                <LogOut size={15} />
                            </LogoutBtn>
                        </MobileUserRow>
                    </MobileDrawer>
                </>
            )}

            {/* Top bar */}
            <TopBar>
                <TopBarLogo>
                    <img src={kodaLogo} alt="" height="28" style={{ display: 'block' }} />
                    Koda
                </TopBarLogo>
                <MarqueeBanner>
                    <MarqueeTrack aria-hidden="true">
                        <MarqueeContent>No real funds are used in this environment&nbsp;&nbsp;·&nbsp;&nbsp;This is a test environment only&nbsp;&nbsp;·&nbsp;&nbsp;All account details, cards, transactions and balances shown are entirely fictitious&nbsp;&nbsp;·&nbsp;&nbsp;Names, card numbers, addresses and transaction histories are for demonstration purposes only&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</MarqueeContent>
                        <MarqueeContent>No real funds are used in this environment&nbsp;&nbsp;·&nbsp;&nbsp;This is a test environment only&nbsp;&nbsp;·&nbsp;&nbsp;All account details, cards, transactions and balances shown are entirely fictitious&nbsp;&nbsp;·&nbsp;&nbsp;Names, card numbers, addresses and transaction histories are for demonstration purposes only&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</MarqueeContent>
                    </MarqueeTrack>
                </MarqueeBanner>
                <TopBarRight>
                    <BalanceCluster>
                        <BalanceStat>
                            <BalanceLabel>TAPUSDC Supply</BalanceLabel>
                            <BalanceValue $dim={statsLoading}>
                                {statsLoading ? '···' : fmtSupply(tapusdcSupply)}
                            </BalanceValue>
                        </BalanceStat>
                        <BalanceDiv />
                        <BalanceStat>
                            <BalanceLabel>USDC in Wrapper</BalanceLabel>
                            <BalanceValue $dim={statsLoading}>
                                {statsLoading ? '···' : fmtSupply(usdcInWrapper)}
                            </BalanceValue>
                        </BalanceStat>
                        <TopBarRefreshBtn onClick={() => {
                            setTapusdcSupply(null);
                            setUsdcInWrapper(null);
                            setStatsLoading(true);
                            Promise.all([
                                arcSend('eth_call', [{ to: TAPUSDC_ADDRESS, data: ERC20_IFACE.encodeFunctionData('totalSupply') }, 'latest']),
                                arcSend('eth_call', [{ to: USDC_ADDRESS,    data: ERC20_IFACE.encodeFunctionData('balanceOf', [WRAPPER_ADDRESS]) }, 'latest']),
                            ]).then(([s, b]) => {
                                if (s && s !== '0x') setTapusdcSupply(ERC20_IFACE.decodeFunctionResult('totalSupply', s)[0]);
                                if (b && b !== '0x') setUsdcInWrapper(ERC20_IFACE.decodeFunctionResult('balanceOf', b)[0]);
                            }).catch(() => {}).finally(() => setStatsLoading(false));
                        }} title="Refresh protocol stats">
                            <RefreshCw size={13} />
                        </TopBarRefreshBtn>
                    </BalanceCluster>

                    <TopBarSep />

                    {isConnected ? (
                        <TopBarAddrPill onClick={copyAddress} title="Copy wallet address">
                            {copied ? <Check size={11} /> : <Copy size={11} />}
                            {shortAddr(address)}
                        </TopBarAddrPill>
                    ) : (
                        <TopBarConnectBtn onClick={connect} disabled={connecting}>
                            {connecting ? 'Connecting…' : 'Connect wallet'}
                        </TopBarConnectBtn>
                    )}

                    <TopBarSep />

                    <UserChip>
                        <UserChipAvatar>{initials}</UserChipAvatar>
                        <UserChipName>{firstName}</UserChipName>
                        <UserChipLogout onClick={handleLogout} title="Sign out">
                            <LogOut size={13} />
                        </UserChipLogout>
                    </UserChip>
                </TopBarRight>
            </TopBar>

            {/* Sidebar + content */}
            <BodyRow>
                <Sidebar>
                    <Nav>
                        {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
                            <NavItem key={path} to={path} end={path === '/dashboard'}>
                                <Icon size={20} />
                                <NavItemLabel>{label}</NavItemLabel>
                            </NavItem>
                        ))}
                    </Nav>
                    <DocsLink href="https://sprightly-biscotti-145919.netlify.app/" target="_blank" rel="noopener noreferrer">
                        <BookOpen size={20} />
                        <NavItemLabel>Docs</NavItemLabel>
                    </DocsLink>
                </Sidebar>

                <Main>
                    <Outlet />
                </Main>
            </BodyRow>
        </Layout>
    );
};

const Layout = styled.div`
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: #000000;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
`;

const TopBar = styled.header`
    flex-shrink: 0;
    background: linear-gradient(45deg, #121212 40%, #ffffff05);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 60px;
    z-index: 10;

    @media (max-width: 768px) { display: none; }
`;

const TopBarLogo = styled.span`
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
`;

const TopBarRight = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
`;

const scroll = keyframes`
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
`;

const MarqueeBanner = styled.div`
    flex: 1;
    height: 38px;
    margin: 0 20px;
    background: transparent;
    border: 1px solid #8D969E;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
`;

const MarqueeTrack = styled.div`
    display: flex;
    width: max-content;
    animation: ${scroll} 40s linear infinite;
`;

const MarqueeContent = styled.span`
    white-space: nowrap;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 500;
    color: #8D969E;
    padding: 0 0 0 16px;
`;

const BalanceCluster = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 0 4px 0 14px;
`;

const BalanceStat = styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
`;

const BalanceLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    line-height: 1;
`;

const BalanceValue = styled.span`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: -0.3px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: ${p => p.$dim ? 'rgba(255,255,255,0.2)' : '#ffffff'};
`;

const BalanceDiv = styled.div`
    width: 1px;
    height: 20px;
    background: rgba(255,255,255,0.08);
    flex-shrink: 0;
`;

const TopBarSep = styled.div`
    width: 1px;
    height: 22px;
    background: rgba(255,255,255,0.08);
    flex-shrink: 0;
    margin: 0 2px;
`;

const UserChip = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 0 4px 0 10px;
`;

const UserChipAvatar = styled.div`
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: linear-gradient(135deg, #100196, #6c63ff);
    color: #ffffff;
    display: grid;
    place-items: center;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
`;

const UserChipName = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
`;

const UserChipLogout = styled.button`
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
    &:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
`;

const TopBarConnectBtn = styled.button`
    padding: 8px 16px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 16px;
    font-weight: 400;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    white-space: nowrap;
    &:hover:not(:disabled) { opacity: 0.7; transform: translateY(-1px); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const TopBarAddrPill = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0px 16px;
    background:transparent;
    border: 1px solid #8D969E;
    border-radius: 8px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    font-weight: 600;
    color: #8D969E;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(255,255,255,0.12); }
`;

const TopBarRefreshBtn = styled.button`
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    background: transparent;
    border: none;
    border-radius: 7px;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
    &:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
`;



const BodyRow = styled.div`
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;

    @media (max-width: 768px) { flex-direction: column; }
`;

const Sidebar = styled.aside`
    width: 96px;
    flex-shrink: 0;
    height: 100%;
    box-sizing: border-box;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border-right: 1px solid rgba(255,255,255,0.07);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 0 24px;
    gap: 8px;

    @media (max-width: 768px) { display: none; }
`;


const Nav = styled.nav`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 100%;
    padding: 0 8px;
`;

const NavItem = styled(NavLink)`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    width: calc(100% - 16px);
    padding: 10px 0;
    border-radius: 12px;
    text-decoration: none;
    color: rgba(255,255,255,0.35);
    transition: background 0.15s, color 0.15s;

    &:hover {
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.75);
    }

    &.active {
        background: rgba(79,85,241,0.18);
        color: #7b81f5;
    }
`;

const NavItemLabel = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.2px;
    text-align: center;
    line-height: 1;
    color: currentColor;
`;

const DocsLink = styled.a`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    width: calc(100% - 16px);
    padding: 10px 0;
    border-radius: 12px;
    text-decoration: none;
    color: rgba(255,255,255,0.25);
    transition: background 0.15s, color 0.15s;
    margin-top: auto;
    flex-shrink: 0;

    &:hover {
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.65);
    }
`;

const Avatar = styled.div`
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: linear-gradient(135deg, #100196, #6c63ff);
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
`;

const UserInfo = styled.div`
    flex: 1;
    min-width: 0;
`;

const UserName = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const UserEmail = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    margin: 1px 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const LogoutBtn = styled.button`
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: rgba(255,255,255,0.4);
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
    &:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); }
`;

const DemoBadge = styled.span`
    margin-left: auto;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.6px;
    padding: 2px 5px;
    border-radius: 3px;
    background: rgba(232,90,0,0.12);
    color: #E85A00;
    border: 1px solid rgba(232,90,0,0.2);
`;

const Main = styled.main`
    flex: 1;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
    @media (max-width: 768px) { height: auto; min-height: 0; }
`;

// Mobile header & drawer

const MobileHeader = styled.div`
    display: none;
    @media (max-width: 768px) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        height: 56px;
        background: #000000;
        border-bottom: 1px solid rgba(255,255,255,0.07);
        flex-shrink: 0;
        z-index: 100;
    }
`;

const MobileLogoRow = styled.div`
    display: flex;
    align-items: center;
    gap: 9px;
`;


const MobileLogoName = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
`;

const MobileHamBtn = styled.button`
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 9px;
    color: rgba(255,255,255,0.75);
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(255,255,255,0.1); }
`;

const mobileSlide = keyframes`
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const MobileOverlay = styled.div`
    position: fixed;
    inset: 0;
    z-index: 97;
`;

const MobileDrawer = styled.div`
    position: fixed;
    top: 56px;
    left: 0;
    right: 0;
    z-index: 98;
    background: #000000;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    padding: 10px 12px 16px;
    animation: ${mobileSlide} 0.2s ease both;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
`;

const MobileNav = styled.nav`
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 10px;
`;

const MobileNavItem = styled(NavLink)`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 12px;
    border-radius: 10px;
    text-decoration: none;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.5);
    transition: background 0.15s, color 0.15s;
    &:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
    &.active { background: rgba(100,99,255,0.15); color: #ffffff; font-weight: 600; }
`;

const MobileDrawerDivider = styled.div`
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 8px 0;
`;

const MobileDocsLink = styled.a`
    display: flex;
    align-items: center;
    padding: 12px 12px;
    border-radius: 10px;
    text-decoration: none;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.45);
    transition: background 0.15s, color 0.15s;
    &:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }
`;

const MobileUserRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 4px;
`;


export default AppLayout;
