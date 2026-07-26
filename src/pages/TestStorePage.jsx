import { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import axios from 'axios';
import { ShoppingCart, X, CheckCircle, AlertCircle, ChevronRight, Zap, Shield, RotateCcw } from 'lucide-react';
import { useWallet } from '../context/WalletContext.js';

const PROCESSOR_ADDRESS = '0x03440A93942EF5609348b3102B2E6fA89f6056F2';

const PRODUCTS = [
    {
        id: 1,
        name: 'Stanley FatMax Tape Measure',
        spec: '5m · Blade lock · Impact resistant casing',
        category: 'MEASURING',
        price: '2.99',
        color: '#E8A020',
        bg: '#FFF8E7',
        emoji: '📏',
        badge: 'BESTSELLER',
        badgeColor: '#22C55E',
        stock: 47,
    },
    {
        id: 2,
        name: 'Bahco Adjustable Wrench',
        spec: '250mm · Chrome vanadium steel',
        category: 'HAND TOOLS',
        price: '3.99',
        color: '#C0392B',
        bg: '#FEF2F2',
        emoji: '🔧',
        badge: null,
        stock: 19,
    },
    {
        id: 3,
        name: 'DeWalt Drill Bit Set',
        spec: '25-piece · HSS · 1–13mm · Metal case',
        category: 'ACCESSORIES',
        price: '5.99',
        color: '#E85A00',
        bg: '#FFF4ED',
        emoji: '⚡',
        badge: 'HOT',
        badgeColor: '#E85A00',
        stock: 8,
    },
    {
        id: 4,
        name: 'Werner Aluminium Step Ladder',
        spec: '3-step · 150kg rated · Ribbed platform',
        category: 'LADDERS & ACCESS',
        price: '9.99',
        color: '#2563EB',
        bg: '#EFF6FF',
        emoji: '🪜',
        badge: null,
        stock: 12,
    },
    {
        id: 5,
        name: 'Sealey Mobile Tool Cabinet',
        spec: '3-drawer · Steel · Central lock · Castors',
        category: 'STORAGE',
        price: '14.99',
        color: '#1A1A2E',
        bg: '#F1F1F8',
        emoji: '🧰',
        badge: 'PRO PICK',
        badgeColor: '#7C3AED',
        stock: 4,
    },
];

const fmt = (b) => {
    if (!b) return '0.00';
    const n = parseFloat(b);
    return n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TestStorePage = () => {
    const { isConnected, address, balances, connect, connecting } = useWallet();

    // Resolve cardId — localStorage first, fallback to API
    const [cardId, setCardId] = useState(() => localStorage.getItem('cardId') || null);

    useEffect(() => {
        if (cardId) return;
        const token = localStorage.getItem('authToken');
        if (!token) return;
        axios.get('https://chainfree.site:7001/user/cards', {
            headers: { Authorization: `Bearer ${token}` },
        }).then(res => {
            if (res.data.success && res.data.data?.length > 0) {
                const id = res.data.data[0].card_id;
                setCardId(id);
                localStorage.setItem('cardId', id);
            }
        }).catch(() => {});
    }, [cardId]);

    const [cart,        setCart]        = useState(null);
    const [paying,      setPaying]      = useState(false);
    const [payStatus,   setPayStatus]   = useState(null);
    const [txHash,      setTxHash]      = useState('');
    const [payError,    setPayError]    = useState('');

    const [cardNumber,       setCardNumber]       = useState('');
    const [expiry,           setExpiry]           = useState('');
    const [cvv,              setCvv]              = useState('');
    const [nameOnCard,       setNameOnCard]       = useState('');
    const [cardErrors,  setCardErrors]  = useState({});

    // Card input formatters
    const handleCardNumber = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
        const formatted = digits.replace(/(.{4})/g, '$1 ').trim();
        setCardNumber(formatted);
        setCardErrors(p => ({ ...p, number: '' }));
    };

    const handleExpiry = (e) => {
        const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
        const formatted = raw.length >= 3 ? raw.slice(0, 2) + '/' + raw.slice(2) : raw;
        setExpiry(formatted);
        setCardErrors(p => ({ ...p, expiry: '' }));
    };

    const handleCvv = (e) => {
        setCvv(e.target.value.replace(/\D/g, '').slice(0, 4));
        setCardErrors(p => ({ ...p, cvv: '' }));
    };

    // Detect card brand from first digit
    const cardBrand = () => {
        const d = cardNumber.replace(/\s/g, '');
        if (d.startsWith('4')) return 'VISA';
        if (d.startsWith('5') || d.startsWith('2')) return 'MC';
        if (d.startsWith('3')) return 'AMEX';
        return null;
    };

    // Validation
    const validateCard = () => {
        const errs = {};
        const digits = cardNumber.replace(/\s/g, '');
        if (digits.length < 16) errs.number = 'Enter a valid 16-digit card number';

        if (expiry.length < 5) {
            errs.expiry = 'Enter expiry as MM/YY';
        } else {
            const [mm, yy] = expiry.split('/');
            const month = parseInt(mm, 10);
            const year  = 2000 + parseInt(yy, 10);
            const now   = new Date();
            if (month < 1 || month > 12) errs.expiry = 'Invalid month';
            else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1))
                errs.expiry = 'Card has expired';
        }

        if (cvv.length < 3) errs.cvv = 'Enter CVV';
        if (!nameOnCard.trim()) errs.name = 'Enter name on card';
        return errs;
    };

    const formComplete = () => {
        const digits = cardNumber.replace(/\s/g, '');
        return digits.length === 16 && expiry.length === 5 && cvv.length >= 3 && nameOnCard.trim().length > 0;
    };

    const openCart = (product) => {
        setCart(product);
        setPayStatus(null);
        setPayError('');
        setTxHash('');
        setCardNumber('');
        setExpiry('');
        setCvv('');
        setNameOnCard('');
        setCardErrors({});
    };

    const closeCart = () => {
        if (paying) return;
        setCart(null);
        setPayStatus(null);
    };

    const handlePay = async () => {
        if (!isConnected || !address || !cart) return;

        const errs = validateCard();
        if (Object.keys(errs).length > 0) { setCardErrors(errs); return; }

        if (!cardId) {
            setPayError('No Koda card found. Please create a card in the dashboard first.');
            return;
        }

        const delivery = parseFloat(cart.price) >= 10 ? 0 : 2.99;
        const total    = parseFloat(cart.price) + delivery;

        const balance = parseFloat(balances.TAPUSDC || '0');
        if (balance < total) {
            setPayError(`Insufficient balance. You need ${total.toFixed(2)} TAPUSDC but have ${fmt(balances.TAPUSDC)}.`);
            return;
        }

        setPaying(true);
        setPayError('');

        try {
            const res = await axios.post('https://chainfree.site:7000/simulate-card-purchase', {
                cardId,
                amount:       total,
                merchantName: 'Bolt & Board Co.',
                category:     'hardware_stores',
            });

            if (res.data.success && res.data.authorization?.approved) {
                setTxHash(res.data.authorization.id);
                setPayStatus('success');
            } else if (res.data.success && res.data.authorization?.approved === false) {
                const authId = res.data.authorization?.id || '—';
                setPayError(`Declined — ref: ${authId}`);
                setPayStatus('error');
            }
        } catch (err) {
            setPayError(err.response?.data?.message || err.message || 'Payment failed.');
            setPayStatus('error');
        } finally {
            setPaying(false);
        }
    };

    const tapusdcBalance = parseFloat(balances.TAPUSDC || '0');

    return (
        <StorePage>
            {// Top announcement strip}
            <AnnouncementStrip>
                <Zap size={12} />
                FREE DELIVERY OVER £10 &nbsp;·&nbsp; SAME DAY DISPATCH BEFORE 2PM &nbsp;·&nbsp; 30-DAY RETURNS
                <Shield size={12} />
            </AnnouncementStrip>

            {// Store header}
            <StoreHeader>
                <StoreBrand>
                    <StoreLogo>⚒</StoreLogo>
                    <StoreName>
                        Bolt <span>&amp;</span> Board
                        <StoreTagline>Hardware Co.</StoreTagline>
                    </StoreName>
                </StoreBrand>
                <StoreHeaderMid>
                    <SearchBar>
                        <SearchIcon>🔍</SearchIcon>
                        <SearchInput placeholder="Search tools, fixings, storage…" readOnly />
                    </SearchBar>
                </StoreHeaderMid>
                <StoreHeaderRight>
                    {isConnected ? (
                        <WalletChip>
                            <WalletDot />
                            <span>Koda Card ready</span>
                        </WalletChip>
                    ) : (
                        <ConnectChip onClick={connect} disabled={connecting}>
                            {connecting ? 'Connecting…' : 'Add payment method'}
                        </ConnectChip>
                    )}
                </StoreHeaderRight>
            </StoreHeader>

            {// Category nav}
            <CategoryNav>
                {['All Departments', 'Power Tools', 'Hand Tools', 'Measuring', 'Ladders & Access', 'Storage', 'Fixings'].map(c => (
                    <CategoryPill key={c} $active={c === 'All Departments'}>{c}</CategoryPill>
                ))}
            </CategoryNav>

            {// Hero banner}
            <HeroBanner>
                <HeroStripes />
                <HeroContent>
                    <HeroBadge>
                        <Zap size={11} /> FREE UK DELIVERY OVER £10
                    </HeroBadge>
                    <HeroHeadline>The Right Tool<br />for Every Job.</HeroHeadline>
                    <HeroSub>Professional grade. Fair prices. Pay direct from your wallet.</HeroSub>
                    <HeroCta>
                        Shop now <ChevronRight size={16} />
                    </HeroCta>
                </HeroContent>
                <HeroVisual>
                    <HeroEmoji>🔨</HeroEmoji>
                    <HeroRing />
                </HeroVisual>
            </HeroBanner>

            {// Products}
            <ProductsSection>
                <ProductsSectionHeader>
                    <ProductsSectionTitle>Featured Products</ProductsSectionTitle>
                    <ProductsCount>5 items</ProductsCount>
                </ProductsSectionHeader>

                <ProductGrid>
                    {PRODUCTS.map(product => (
                        <ProductCard key={product.id}>
                            {product.badge && (
                                <ProductBadge style={{ background: product.badgeColor }}>
                                    {product.badge}
                                </ProductBadge>
                            )}

                            <ProductImageWrap style={{ background: product.bg }}>
                                <ProductEmojiDisplay>{product.emoji}</ProductEmojiDisplay>
                                <ProductImagePlaceholder>
                                    IMG PLACEHOLDER
                                </ProductImagePlaceholder>
                            </ProductImageWrap>

                            <ProductBody>
                                <ProductCategory style={{ color: product.color }}>
                                    {product.category}
                                </ProductCategory>
                                <ProductName>{product.name}</ProductName>
                                <ProductSpec>{product.spec}</ProductSpec>

                                <ProductFooter>
                                    <ProductPriceBlock>
                                        <ProductCurrencySymbol>£</ProductCurrencySymbol>
                                        <ProductPrice>{product.price}</ProductPrice>
                                    </ProductPriceBlock>
                                    <StockNote $low={product.stock <= 10}>
                                        {product.stock <= 10 ? `Only ${product.stock} left` : `In stock`}
                                    </StockNote>
                                </ProductFooter>

                                <BuyButton
                                    onClick={() => openCart(product)}
                                    $color={product.color}
                                    disabled={!isConnected}
                                    title={!isConnected ? 'Add a payment method to purchase' : undefined}
                                >
                                    <ShoppingCart size={14} />
                                    {isConnected ? 'Buy Now' : 'Add payment method'}
                                </BuyButton>
                            </ProductBody>
                        </ProductCard>
                    ))}
                </ProductGrid>
            </ProductsSection>

            {// Footer}
            <StoreFooter>
                <FooterLogo>⚒ Bolt &amp; Board Co.</FooterLogo>
                <FooterMeta>
                    Test environment · Powered by <strong>Koda</strong> · Built on Arc Testnet
                </FooterMeta>
            </StoreFooter>

            {// Payment modal}
            {cart && (
                <ModalOverlay onClick={(e) => e.target === e.currentTarget && closeCart()}>
                    <PayModal>
                        {/* Header */}
                        <PayModalHeader>
                            <span>Complete purchase</span>
                            {!paying && <CloseBtn onClick={closeCart}><X size={16} /></CloseBtn>}
                        </PayModalHeader>

                        {payStatus === 'success' ? (
                            // Success
                            <SuccessBody>
                                <SuccessRing>
                                    <CheckCircle size={36} color="#22C55E" />
                                </SuccessRing>
                                <SuccessTitle>Payment approved</SuccessTitle>
                                <SuccessItem>{cart.name}</SuccessItem>
                                <SuccessAmount>£{cart.price}</SuccessAmount>
                                <SuccessRef>Auth ref: {txHash || '—'}</SuccessRef>
                                <SuccessSettled>
                                    ⛓ Settled on-chain via TAPUSDC
                                </SuccessSettled>
                                <DoneBtn onClick={closeCart}>Done</DoneBtn>
                            </SuccessBody>
                        ) : (
                            // Checkout
                            <>
                                {/* Order summary */}
                                <OrderSummary>
                                    <OrderImageWrap style={{ background: cart.bg }}>
                                        <span style={{ fontSize: 28 }}>{cart.emoji}</span>
                                    </OrderImageWrap>
                                    <OrderDetails>
                                        <OrderCategory style={{ color: cart.color }}>{cart.category}</OrderCategory>
                                        <OrderName>{cart.name}</OrderName>
                                        <OrderSpec>{cart.spec}</OrderSpec>
                                    </OrderDetails>
                                    <OrderPrice>
                                        <OrderPriceAmount>£{cart.price}</OrderPriceAmount>
                                    </OrderPrice>
                                </OrderSummary>

                                <PayDivider />

                                {/* Card entry form */}
                                <CardFormSection>
                                    <PaymentMethodLabel>Card details</PaymentMethodLabel>

                                    <CardField $error={!!cardErrors.number}>
                                        <CardFieldLabel>Card number</CardFieldLabel>
                                        <CardNumberWrap>
                                            <CardInput
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="1234 5678 9012 3456"
                                                value={cardNumber}
                                                onChange={handleCardNumber}
                                                disabled={paying}
                                                autoFocus
                                            />
                                            {cardBrand() && (
                                                <CardBrandBadge $brand={cardBrand()}>
                                                    {cardBrand()}
                                                </CardBrandBadge>
                                            )}
                                        </CardNumberWrap>
                                        {cardErrors.number && <CardFieldError>{cardErrors.number}</CardFieldError>}
                                    </CardField>

                                    <CardField>
                                        <CardFieldLabel>Name on card</CardFieldLabel>
                                        <CardInput
                                            type="text"
                                            placeholder="J SMITH"
                                            value={nameOnCard}
                                            onChange={(e) => { setNameOnCard(e.target.value.toUpperCase()); setCardErrors(p => ({ ...p, name: '' })); }}
                                            disabled={paying}
                                            style={{ textTransform: 'uppercase' }}
                                        />
                                        {cardErrors.name && <CardFieldError>{cardErrors.name}</CardFieldError>}
                                    </CardField>

                                    <CardFieldRow>
                                        <CardField $error={!!cardErrors.expiry}>
                                            <CardFieldLabel>Expiry</CardFieldLabel>
                                            <CardInput
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="MM/YY"
                                                value={expiry}
                                                onChange={handleExpiry}
                                                disabled={paying}
                                                maxLength={5}
                                            />
                                            {cardErrors.expiry && <CardFieldError>{cardErrors.expiry}</CardFieldError>}
                                        </CardField>
                                        <CardField $error={!!cardErrors.cvv}>
                                            <CardFieldLabel>CVV</CardFieldLabel>
                                            <CardInput
                                                type="password"
                                                inputMode="numeric"
                                                placeholder="•••"
                                                value={cvv}
                                                onChange={handleCvv}
                                                disabled={paying}
                                                maxLength={4}
                                            />
                                            {cardErrors.cvv && <CardFieldError>{cardErrors.cvv}</CardFieldError>}
                                        </CardField>
                                    </CardFieldRow>
                                </CardFormSection>

                                <PayDivider />

                                {/* Order breakdown */}
                                <WalletStatusSection>
                                    <WalletStatusRow>
                                        <WalletStatusLabel>Subtotal</WalletStatusLabel>
                                        <WalletStatusValue>£{cart.price}</WalletStatusValue>
                                    </WalletStatusRow>
                                    <WalletStatusRow>
                                        <WalletStatusLabel>Delivery</WalletStatusLabel>
                                        <WalletStatusValue style={{ color: '#22C55E' }}>
                                            {parseFloat(cart.price) >= 10 ? 'FREE' : '£2.99'}
                                        </WalletStatusValue>
                                    </WalletStatusRow>
                                    <WalletStatusRow>
                                        <WalletStatusLabel>Merchant</WalletStatusLabel>
                                        <WalletStatusValue>Bolt &amp; Board Co.</WalletStatusValue>
                                    </WalletStatusRow>
                                </WalletStatusSection>

                                <PayDivider />

                                <PayTotalRow>
                                    <PayTotalLabel>Total</PayTotalLabel>
                                    <PayTotalAmount>
                                        £{parseFloat(cart.price) >= 10
                                            ? cart.price
                                            : (parseFloat(cart.price) + 2.99).toFixed(2)}
                                    </PayTotalAmount>
                                </PayTotalRow>

                                {payError && (
                                    <PayErrorBox>
                                        <AlertCircle size={14} />
                                        <span>{payError}</span>
                                    </PayErrorBox>
                                )}

                                <PayConfirmBtn
                                    onClick={handlePay}
                                    disabled={paying || !formComplete()}
                                    $color={cart.color}
                                >
                                    {paying ? (
                                        <><PaySpinner /> Processing payment…</>
                                    ) : (
                                        <>🔒 Pay £{parseFloat(cart.price) >= 10
                                            ? cart.price
                                            : (parseFloat(cart.price) + 2.99).toFixed(2)}</>
                                    )}
                                </PayConfirmBtn>

                                <SecureNote>
                                    <Shield size={11} /> Secured by Koda · 256-bit encryption
                                </SecureNote>
                            </>
                        )}
                    </PayModal>
                </ModalOverlay>
            )}
        </StorePage>
    );
};

// Animations

const fadeUp  = keyframes`from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}`;
const fadeIn  = keyframes`from{opacity:0}to{opacity:1}`;
const spinAni = keyframes`to{transform:rotate(360deg)}`;
const popIn   = keyframes`0%{transform:scale(0.85);opacity:0}100%{transform:scale(1);opacity:1}`;
const stripe  = keyframes`0%{background-position:0 0}100%{background-position:60px 60px}`;

// Page shell

const StorePage = styled.div`
    min-height: 100vh;
    background: #F5F0E8;
    font-family: 'Sora', sans-serif;
    display: flex;
    flex-direction: column;
    animation: ${fadeIn} 0.3s ease;
`;

// Announcement strip

const AnnouncementStrip = styled.div`
    background: #1A1A2E;
    color: rgba(255,255,255,0.7);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
`;

// Store header

const StoreHeader = styled.header`
    background: #1A1A2E;
    padding: 0 32px;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 24px;
    position: sticky;
    top: 0;
    z-index: 20;
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);

    @media (max-width: 768px) { padding: 0 16px; gap: 12px; }
`;

const StoreBrand = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
`;

const StoreLogo = styled.div`
    font-size: 24px;
    line-height: 1;
`;

const StoreName = styled.div`
    font-size: 16px;
    font-weight: 900;
    color: #FFFFFF;
    letter-spacing: -0.3px;
    line-height: 1.1;

    span { color: #E85A00; }
`;

const StoreTagline = styled.div`
    font-size: 9px;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    letter-spacing: 1.5px;
    text-transform: uppercase;
`;

const StoreHeaderMid = styled.div`
    flex: 1;
    max-width: 480px;

    @media (max-width: 768px) { display: none; }
`;

const SearchBar = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 0 14px;
    height: 38px;
`;

const SearchIcon = styled.span`font-size: 14px; opacity: 0.5;`;

const SearchInput = styled.input`
    background: none;
    border: none;
    outline: none;
    font-family: 'Sora', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    flex: 1;
    cursor: default;
    &::placeholder { color: rgba(255,255,255,0.3); }
`;

const StoreHeaderRight = styled.div`
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
`;

const WalletChip = styled.div`
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 14px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
`;

const WalletDot = styled.div`
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #22C55E;
`;

const ConnectChip = styled.button`
    padding: 7px 16px;
    background: #E85A00;
    border: none;
    border-radius: 20px;
    font-family: 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    transition: background 0.15s;
    &:hover:not(:disabled) { background: #cf4f00; }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

// Category nav

const CategoryNav = styled.nav`
    background: #232338;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 32px;
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar { display: none; }

    @media (max-width: 768px) { padding: 0 16px; }
`;

const CategoryPill = styled.button`
    padding: 10px 14px;
    background: none;
    border: none;
    border-bottom: 2px solid ${p => p.$active ? '#E85A00' : 'transparent'};
    font-family: 'Sora', sans-serif;
    font-size: 12px;
    font-weight: ${p => p.$active ? '700' : '500'};
    color: ${p => p.$active ? '#fff' : 'rgba(255,255,255,0.45)'};
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
    &:hover { color: rgba(255,255,255,0.8); }
`;

// Hero banner

const HeroBanner = styled.section`
    background: #1A1A2E;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 48px 32px;
    min-height: 260px;

    @media (max-width: 768px) { padding: 32px 20px; }
`;

const HeroStripes = styled.div`
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
        45deg,
        rgba(232,90,0,0.03) 0px,
        rgba(232,90,0,0.03) 2px,
        transparent 2px,
        transparent 20px
    );
    animation: ${stripe} 4s linear infinite;
    pointer-events: none;
`;

const HeroContent = styled.div`
    position: relative;
    z-index: 1;
    max-width: 520px;
`;

const HeroBadge = styled.div`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(232,90,0,0.15);
    border: 1px solid rgba(232,90,0,0.35);
    color: #FF8A3D;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.2px;
    padding: 5px 12px;
    border-radius: 4px;
    margin-bottom: 18px;
    text-transform: uppercase;
`;

const HeroHeadline = styled.h1`
    font-size: clamp(32px, 4vw, 52px);
    font-weight: 900;
    color: #FFFFFF;
    line-height: 1.1;
    letter-spacing: -1px;
    margin: 0 0 16px;
`;

const HeroSub = styled.p`
    font-size: 15px;
    color: rgba(255,255,255,0.5);
    line-height: 1.6;
    margin: 0 0 24px;
`;

const HeroCta = styled.button`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 13px 24px;
    background: #E85A00;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
    &:hover { background: #cf4f00; transform: translateY(-1px); }
`;

const HeroVisual = styled.div`
    position: relative;
    width: 180px;
    height: 180px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    @media (max-width: 640px) { display: none; }
`;

const HeroEmoji = styled.div`
    font-size: 80px;
    line-height: 1;
    position: relative;
    z-index: 1;
    animation: ${popIn} 0.6s ease 0.2s both;
    filter: drop-shadow(0 8px 24px rgba(0,0,0,0.4));
`;

const HeroRing = styled.div`
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(232,90,0,0.2);
    animation: ${keyframes`0%{transform:scale(0.9);opacity:0}100%{transform:scale(1);opacity:1}`} 0.5s ease both;

    &::after {
        content: '';
        position: absolute;
        inset: 16px;
        border-radius: 50%;
        border: 1px solid rgba(232,90,0,0.1);
    }
`;

// Products section

const ProductsSection = styled.section`
    flex: 1;
    padding: 32px 32px 48px;

    @media (max-width: 768px) { padding: 24px 16px 40px; }
`;

const ProductsSectionHeader = styled.div`
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 20px;
`;

const ProductsSectionTitle = styled.h2`
    font-size: 18px;
    font-weight: 800;
    color: #1A1A2E;
    margin: 0;
`;

const ProductsCount = styled.span`
    font-size: 12px;
    color: #8A8A9A;
    font-weight: 500;
`;

const ProductGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;

    @media (max-width: 1200px) { grid-template-columns: repeat(3, 1fr); }
    @media (max-width: 860px)  { grid-template-columns: repeat(2, 1fr); }
    @media (max-width: 480px)  { grid-template-columns: 1fr; }
`;

const ProductCard = styled.div`
    background: #FFFFFF;
    border-radius: 10px;
    overflow: hidden;
    position: relative;
    border: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    animation: ${fadeUp} 0.4s ease both;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
`;

const ProductBadge = styled.div`
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 2;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: #fff;
    padding: 3px 8px;
    border-radius: 3px;
`;

const ProductImageWrap = styled.div`
    height: 160px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;

    &::after {
        content: '';
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 1px;
        background: rgba(0,0,0,0.06);
    }
`;

const ProductEmojiDisplay = styled.div`
    font-size: 56px;
    line-height: 1;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
`;

const ProductImagePlaceholder = styled.div`
    position: absolute;
    bottom: 8px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.8px;
    color: rgba(0,0,0,0.2);
    text-transform: uppercase;
    border: 1px dashed rgba(0,0,0,0.15);
    padding: 2px 8px;
    border-radius: 3px;
`;

const ProductBody = styled.div`
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const ProductCategory = styled.span`
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
`;

const ProductName = styled.h3`
    font-size: 13px;
    font-weight: 800;
    color: #1A1A2E;
    margin: 0;
    line-height: 1.3;
`;

const ProductSpec = styled.p`
    font-size: 11px;
    color: #6B7280;
    margin: 0;
    line-height: 1.4;
`;

const ProductFooter = styled.div`
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-top: 4px;
`;

const ProductPriceBlock = styled.div`
    display: flex;
    align-items: baseline;
    gap: 4px;
`;

const ProductCurrencySymbol = styled.span`
    font-size: 15px;
    font-weight: 800;
    color: #1A1A2E;
    margin-bottom: 3px;
`;

const ProductPrice = styled.span`
    font-family: Michroma, sans-serif;
    font-size: 22px;
    font-weight: 900;
    color: #1A1A2E;
    letter-spacing: -0.5px;
`;

const ProductCurrency = styled.span`
    font-size: 9px;
    font-weight: 800;
    color: #6B7280;
    letter-spacing: 0.5px;
    text-transform: uppercase;
`;

const StockNote = styled.span`
    font-size: 10px;
    font-weight: 600;
    color: ${p => p.$low ? '#DC2626' : '#6B7280'};
`;

const BuyButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    padding: 10px;
    margin-top: 6px;
    background: ${p => p.disabled ? '#E5E7EB' : p.$color || '#E85A00'};
    color: ${p => p.disabled ? '#9CA3AF' : '#fff'};
    border: none;
    border-radius: 6px;
    font-family: 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 700;
    cursor: ${p => p.disabled ? 'not-allowed' : 'pointer'};
    transition: filter 0.15s, transform 0.15s;
    &:hover:not(:disabled) { filter: brightness(0.9); transform: translateY(-1px); }
`;

// Store footer

const StoreFooter = styled.footer`
    background: #1A1A2E;
    padding: 24px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
`;

const FooterLogo = styled.span`
    font-size: 14px;
    font-weight: 800;
    color: rgba(255,255,255,0.6);
`;

const FooterMeta = styled.p`
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    margin: 0;
    strong { color: rgba(255,255,255,0.5); }
`;

// Payment modal

const ModalOverlay = styled.div`
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 200px 20px 20px; z-index: 50;
    animation: ${fadeIn} 0.2s ease;

    @media (max-width: 768px) {
        align-items: flex-start;
        padding: 16px;
    }
`;

const PayModal = styled.div`
    width: 100%; max-width: 440px;
    background: #FFFFFF;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0,0,0,0.3);
    animation: ${popIn} 0.25s ease both;
    font-family: 'Sora', sans-serif;
`;

const PayModalHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    background: #1A1A2E;
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.8);
    letter-spacing: 0.3px;
`;

const CloseBtn = styled.button`
    width: 28px; height: 28px;
    display: grid; place-items: center;
    background: rgba(255,255,255,0.08);
    border: none; border-radius: 6px;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    &:hover { background: rgba(255,255,255,0.15); color: #fff; }
`;

const OrderSummary = styled.div`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 20px;
`;

const OrderImageWrap = styled.div`
    width: 56px; height: 56px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    font-size: 28px;
`;

const OrderDetails = styled.div`flex: 1; min-width: 0;`;
const OrderCategory = styled.p`font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 3px;`;
const OrderName = styled.p`font-size: 13px; font-weight: 800; color: #1A1A2E; margin: 0 0 2px;`;
const OrderSpec = styled.p`font-size: 11px; color: #6B7280; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;

const OrderPrice = styled.div`text-align: right; flex-shrink: 0;`;
const OrderPriceAmount = styled.p`font-family: Michroma, sans-serif; font-size: 18px; font-weight: 900; color: #1A1A2E; margin: 0;`;

const PaymentMethodSection = styled.div`padding: 14px 20px;`;
const PaymentMethodLabel = styled.p`font-size: 11px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.6px; margin: 0 0 10px;`;

// Card entry form

const CardFormSection = styled.div`padding: 14px 20px 6px;`;

const CardField = styled.div`
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 12px;
`;

const CardFieldRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
`;

const CardFieldLabel = styled.label`
    font-size: 11px;
    font-weight: 700;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
`;

const CardNumberWrap = styled.div`
    position: relative;
    display: flex;
    align-items: center;
`;

const CardInput = styled.input`
    width: 100%;
    padding: 11px 14px;
    background: #F9FAFB;
    border: 1.5px solid ${p => p.$error ? '#EF4444' : '#E5E7EB'};
    border-radius: 8px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 14px;
    color: #1A1A2E;
    outline: none;
    letter-spacing: 0.5px;
    box-sizing: border-box;
    transition: border-color 0.15s, background 0.15s;

    &::placeholder { color: #C4C9D4; font-family: 'SF Mono', monospace; }
    &:focus { border-color: #1A1A2E; background: #FFFFFF; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const CardBrandBadge = styled.span`
    position: absolute;
    right: 12px;
    font-size: 10px;
    font-weight: 900;
    font-style: italic;
    letter-spacing: 0.5px;
    color: ${p => p.$brand === 'VISA' ? '#1A1A80' : p.$brand === 'MC' ? '#EB001B' : '#2E77BC'};
    font-family: Georgia, serif;
    pointer-events: none;
`;

const CardFieldError = styled.span`
    font-size: 11px;
    color: #EF4444;
    font-weight: 500;
`;

const SecureNote = styled.p`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 11px;
    color: #9CA3AF;
    margin: 0;
    padding: 8px 20px 16px;
`;

const KodaCardChip = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #F9FAFB;
    border: 1.5px solid #E5E7EB;
    border-radius: 10px;
`;

const KodaCardIcon = styled.div`font-size: 22px; line-height: 1;`;

const KodaCardDetails = styled.div`flex: 1;`;
const KodaCardName = styled.p`font-size: 13px; font-weight: 700; color: #1A1A2E; margin: 0 0 2px;`;
const KodaCardNumber = styled.p`font-family: 'SF Mono', monospace; font-size: 11px; color: #6B7280; margin: 0; letter-spacing: 1px;`;

const KodaCardBadge = styled.span`
    font-size: 13px;
    font-weight: 900;
    font-style: italic;
    color: #1A1A80;
    font-family: Georgia, serif;
    letter-spacing: -0.5px;
`;

const PayDivider = styled.div`height: 1px; background: #F3F4F6; margin: 0 20px;`;

const WalletStatusSection = styled.div`padding: 16px 20px; display: flex; flex-direction: column; gap: 10px;`;
const WalletStatusRow = styled.div`display: flex; align-items: center; justify-content: space-between;`;
const WalletStatusLabel = styled.span`font-size: 12px; color: #6B7280;`;
const WalletStatusValue = styled.span`
    font-size: 12px;
    font-weight: 700;
    color: ${p => p.$ok === false ? '#DC2626' : p.$ok ? '#15803d' : '#1A1A2E'};
    font-family: ${p => p.$mono ? "'SF Mono', monospace" : 'inherit'};
    display: flex; align-items: center; gap: 6px;
`;

const InsufficientBadge = styled.span`
    font-size: 9px; font-weight: 700; padding: 2px 6px;
    background: #FEF2F2; color: #DC2626; border-radius: 4px;
`;

const NetDot = styled.div`width: 7px; height: 7px; border-radius: 50%; background: #22C55E;`;

const PayTotalRow = styled.div`
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px;
    background: #F9FAFB;
`;

const PayTotalLabel = styled.span`font-size: 13px; font-weight: 700; color: #1A1A2E;`;
const PayTotalAmount = styled.span`font-family: Michroma, sans-serif; font-size: 20px; font-weight: 900; color: #1A1A2E;`;
const PayTotalCurrency = styled.span`font-size: 11px; font-weight: 700; color: #6B7280; margin-left: 4px;`;

const PayErrorBox = styled.div`
    display: flex; align-items: center; gap: 8px;
    background: #FEF2F2; padding: 10px 20px;
    font-size: 12px; color: #DC2626; font-weight: 500;
`;

const PayConfirmBtn = styled.button`
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 16px 20px;
    background: ${p => p.$color || '#E85A00'};
    color: #fff; border: none;
    font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 800;
    cursor: pointer;
    transition: filter 0.15s;
    &:hover:not(:disabled) { filter: brightness(0.9); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PaySpinner = styled.div`
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%;
    animation: ${spinAni} 0.7s linear infinite;
`;

const PayDisclaimer = styled.p`
    font-size: 11px; color: #9CA3AF; text-align: center;
    padding: 8px 20px 14px; margin: 0; line-height: 1.5;
`;

// Success state

const SuccessBody = styled.div`
    padding: 40px 24px 32px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    text-align: center;
    animation: ${fadeUp} 0.4s ease;
`;

const SuccessRing = styled.div`
    width: 72px; height: 72px;
    border-radius: 50%;
    background: #F0FDF4;
    border: 2px solid #bbf7d0;
    display: grid; place-items: center;
    margin-bottom: 4px;
    animation: ${popIn} 0.4s ease;
`;

const SuccessTitle  = styled.h3`font-family: Michroma, sans-serif; font-size: 20px; font-weight: 900; color: #1A1A2E; margin: 0;`;
const SuccessItem   = styled.p`font-size: 13px; color: #6B7280; margin: 0;`;
const SuccessAmount = styled.p`font-family: Michroma, sans-serif; font-size: 28px; font-weight: 900; color: #22C55E; margin: 0; letter-spacing: -1px;`;
const SuccessRef      = styled.p`font-size: 11px; color: #9CA3AF; margin: 0; font-family: 'SF Mono', monospace;`;
const SuccessSettled  = styled.p`font-size: 11px; color: #15803d; margin: 4px 0 0; font-weight: 600;`;

const TxLink = styled.a`
    font-size: 12px; font-weight: 600; color: #E85A00;
    text-decoration: none; margin-top: 4px;
    &:hover { text-decoration: underline; }
`;

const DoneBtn = styled.button`
    margin-top: 12px; padding: 12px 32px;
    background: #1A1A2E; color: #fff; border: none; border-radius: 8px;
    font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 700;
    cursor: pointer;
    &:hover { background: #2D2D44; }
`;

export default TestStorePage;
