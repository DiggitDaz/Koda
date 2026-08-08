import { useState, useEffect, useRef } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import KODALOGO from '../assets/koda-logo.png';

// Stripe Issuing on a UK account only supports EEA + UK billing addresses.
const COUNTRIES = [
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AT', name: 'Austria' },
    { code: 'BE', name: 'Belgium' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IT', name: 'Italy' },
    { code: 'LU', name: 'Luxembourg' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NO', name: 'Norway' },
    { code: 'PT', name: 'Portugal' },
    { code: 'ES', name: 'Spain' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
];

const EMPTY = {
    firstName: '', lastName: '', email: '',
    address: '', city: '', state: '', postalCode: '',
};

const CreateCardPage = () => {
    const navigate = useNavigate();
    const [form,    setForm]    = useState(EMPTY);
    const [phone,   setPhone]   = useState('');
    const [country, setCountry] = useState('');
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');

    const [showTip,   setShowTip]   = useState(() => !localStorage.getItem('koda_createcard_tip_done'));
    const formCardRef = useRef(null);
    const [cardRect,  setCardRect]  = useState(null);

    const dismissTip = () => {
        setShowTip(false);
        localStorage.setItem('koda_createcard_tip_done', '1');
    };

    useEffect(() => {
        if (!showTip) return;
        const measure = () => {
            if (!formCardRef.current) return;
            const r = formCardRef.current.getBoundingClientRect();
            setCardRect({ top: r.top, left: r.left, right: r.right, width: r.width, height: r.height, bottom: r.bottom, winW: window.innerWidth });
        };
        const t = setTimeout(measure, 520);
        window.addEventListener('resize', measure);
        return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
    }, [showTip]);

    const set = (field) => (e) => {
        setForm(p => ({ ...p, [field]: e.target.value }));
        if (error) setError('');
    };

    const isValid =
        Object.values(form).every(v => v.trim() !== '') &&
        country !== '' &&
        phone && isValidPhoneNumber(phone);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isValid) return;

        setLoading(true);
        setError('');

        const token = localStorage.getItem('authToken');
        const authHeader = { Authorization: `Bearer ${token}` };

        try {
            try {
                const existing = await axios.get(`${import.meta.env.VITE_AUTH_URL}/user/cards`, {
                    headers: authHeader,
                });
                if (existing.data.success && existing.data.data?.length > 0) {
                    localStorage.setItem('cardId', existing.data.data[0].card_id);
                    navigate('/dashboard');
                    return;
                }
            } catch { /* no existing card */ }

            const cardholderRes = await axios.post(`${import.meta.env.VITE_API_URL}/create-cardholder`, {
                firstName:   form.firstName,
                lastName:    form.lastName,
                email:       form.email,
                phoneNumber: phone,
                address:     form.address,
                city:        form.city,
                state:       form.state,
                country,
                postalCode:  form.postalCode,
            });

            if (!cardholderRes.data.success) {
                setError('Failed to create cardholder. Please check your details.');
                return;
            }

            const cardRes = await axios.post(`${import.meta.env.VITE_API_URL}/create-virtual-card`, {
                cardholderId: cardholderRes.data.cardholder.id,
            });

            if (!cardRes.data.success) {
                setError('Failed to create virtual card.');
                return;
            }

            const cardId = cardRes.data.cardDetails.id;
            localStorage.setItem('cardId', cardId);

            await axios.post(`${import.meta.env.VITE_AUTH_URL}/user/link-card`,
                { card_id: cardId, card_name: 'My Virtual Card' },
                { headers: authHeader },
            );

            navigate('/dashboard');

        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
      <>
        <PhoneGlobal />
        <Page>
            <RainbowGlow />

            <FormCard ref={formCardRef}>
                <DotPattern />

                <CardHeader>
                    <CardLogo onClick={() => navigate('/')}>
                        <img src={KODALOGO} alt="Koda" width={24} height={24} />
                        <CardLogoName>koda</CardLogoName>
                    </CardLogo>
                    <BackBtn onClick={() => navigate('/dashboard')}>
                        <ArrowLeft size={13} />
                        Dashboard
                    </BackBtn>
                </CardHeader>

                <FormHeader>
                    <FormTitle>Get your card</FormTitle>
                    <FormSub>A virtual Visa card that spends TAPUSDC directly from your self-custody wallet.</FormSub>
                </FormHeader>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <Form onSubmit={handleSubmit}>
                    <Section>
                        <SectionLabel>Personal information</SectionLabel>
                        <FieldRow>
                            <Field>
                                <Label>First name</Label>
                                <Input placeholder="Jane" value={form.firstName} onChange={set('firstName')} disabled={loading} />
                            </Field>
                            <Field>
                                <Label>Last name</Label>
                                <Input placeholder="Smith" value={form.lastName} onChange={set('lastName')} disabled={loading} />
                            </Field>
                        </FieldRow>
                        <Field>
                            <Label>Email address</Label>
                            <Input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} disabled={loading} />
                        </Field>
                        <Field>
                            <Label>
                                Phone number
                                {phone && !isValidPhoneNumber(phone) && (
                                    <ValidationHint>Invalid number for selected country</ValidationHint>
                                )}
                            </Label>
                            <PhoneInputWrapper $invalid={phone && !isValidPhoneNumber(phone)}>
                                <PhoneInput
                                    international
                                    defaultCountry="GB"
                                    value={phone}
                                    onChange={(val) => { setPhone(val || ''); if (error) setError(''); }}
                                    disabled={loading}
                                    className={`koda-phone-input${phone && !isValidPhoneNumber(phone) ? ' koda-phone-input--invalid' : ''}`}
                                />
                            </PhoneInputWrapper>
                        </Field>
                    </Section>

                    <Section>
                        <SectionLabel>Address</SectionLabel>
                        <Field>
                            <Label>Street address</Label>
                            <Input placeholder="1 Example Street" value={form.address} onChange={set('address')} disabled={loading} />
                        </Field>
                        <FieldRow>
                            <Field>
                                <Label>City</Label>
                                <Input placeholder="London" value={form.city} onChange={set('city')} disabled={loading} />
                            </Field>
                            <Field>
                                <Label>State / County</Label>
                                <Input placeholder="Greater London" value={form.state} onChange={set('state')} disabled={loading} />
                            </Field>
                        </FieldRow>
                        <FieldRow>
                            <Field>
                                <Label>Country</Label>
                                <Select
                                    value={country}
                                    onChange={(e) => { setCountry(e.target.value); if (error) setError(''); }}
                                    disabled={loading}
                                    $empty={!country}
                                >
                                    <option value="" disabled>Select country…</option>
                                    {COUNTRIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </Select>
                            </Field>
                            <Field>
                                <Label>Postal code</Label>
                                <Input placeholder="SW1A 1AA" value={form.postalCode} onChange={set('postalCode')} disabled={loading} />
                            </Field>
                        </FieldRow>
                    </Section>

                    <SubmitBtn type="submit" disabled={!isValid || loading}>
                        {loading ? <Spinner /> : 'Create card'}
                    </SubmitBtn>

                    <SkipBtn type="button" onClick={() => navigate('/dashboard')}>
                        Skip for now
                    </SkipBtn>
                </Form>
            </FormCard>
        </Page>

        {showTip && cardRect && (() => {
            const onRight = cardRect.winW >= 900 && (cardRect.winW - cardRect.right) >= 320;
            const onLeft  = !onRight && cardRect.winW >= 900 && cardRect.left >= 320;
            const tipTop  = (onRight || onLeft)
                ? Math.max(8, cardRect.top + cardRect.height / 2 - 120)
                : cardRect.bottom + 18;
            const tipLeft = onRight
                ? cardRect.right + 18
                : onLeft
                    ? cardRect.left - 306
                    : Math.max(8, cardRect.left + cardRect.width / 2 - 144);
            const arrowStyle = onRight
                ? { left: -7, top: 'calc(50% - 6px)', right: 'auto', transform: 'rotate(-45deg)' }
                : onLeft
                    ? { left: 'auto', right: -7, top: 'calc(50% - 6px)', transform: 'rotate(135deg)' }
                    : { left: 'calc(50% - 6px)', top: -7, right: 'auto' };
            return (
                <>
                    <TipSpotlight style={{
                        top:    cardRect.top    - 10,
                        left:   cardRect.left   - 10,
                        width:  cardRect.width  + 20,
                        height: cardRect.height + 20,
                    }} />
                    <TipCard style={{ top: tipTop, left: tipLeft }}>
                        <TipArrow style={arrowStyle} />
                        <TipPill>Heads up</TipPill>
                        <TipTitle>Fictitious details only</TipTitle>
                        <TipBody>
                            Please use made-up personal details. Do not enter your real name, address or contact information. You must select a UK or EU country due to Stripe licensing requirements. This creates a real Stripe Sandbox card and no real funds will ever be used.
                        </TipBody>
                        <TipBtn onClick={dismissTip}>Got it, continue</TipBtn>
                    </TipCard>
                </>
            );
        })()}
      </>
    );
};

// Animations
const fadeUp    = keyframes`from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}`;
const spinAni   = keyframes`to{transform:rotate(360deg)}`;
const spotPulse = keyframes`
    0%, 100% { border-color: rgba(79,85,241,0.65); }
    50%       { border-color: rgba(79,85,241,1); box-shadow: 0 0 0 9999px rgba(0,0,0,0.62), 0 0 18px rgba(79,85,241,0.25); }
`;
const tipFadeIn = keyframes`
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
`;

// Phone input global styles
const PhoneGlobal = createGlobalStyle`
    .koda-phone-input {
        display: flex;
        align-items: center;
    }
    .koda-phone-input .PhoneInputCountry {
        display: flex;
        align-items: center;
        padding: 0 10px 0 13px;
        background: rgba(255,255,255,0.04);
        border: 1.5px solid rgba(255,255,255,0.08);
        border-right: none;
        border-radius: 10px 0 0 10px;
        height: 38px;
        flex-shrink: 0;
        cursor: pointer;
        transition: border-color 0.15s;
    }
    .koda-phone-input .PhoneInputCountrySelect {
        position: absolute;
        opacity: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
    }
    .koda-phone-input .PhoneInputCountryIcon {
        width: 22px;
        height: 16px;
        border-radius: 2px;
        overflow: hidden;
        flex-shrink: 0;
    }
    .koda-phone-input .PhoneInputCountrySelectArrow {
        margin-left: 6px;
        border-color: rgba(255,255,255,0.3);
        opacity: 1;
        width: 5px;
        height: 5px;
    }
    .koda-phone-input .PhoneInputInput {
        flex: 1;
        padding: 9px 13px;
        background: rgba(255,255,255,0.04);
        border: 1.5px solid rgba(255,255,255,0.08);
        border-left: none;
        border-radius: 0 10px 10px 0;
        font-family: 'Google Sans Flex', 'Sora', sans-serif;
        font-size: 13px;
        color: #ffffff;
        outline: none;
        transition: border-color 0.15s;
    }
    .koda-phone-input .PhoneInputInput::placeholder {
        color: rgba(255,255,255,0.2);
    }
    .koda-phone-input .PhoneInputInput:focus {
        border-color: rgba(79,85,241,0.55);
    }
    .koda-phone-input:focus-within .PhoneInputCountry {
        border-color: rgba(79,85,241,0.55);
    }
    .koda-phone-input--invalid .PhoneInputCountry,
    .koda-phone-input--invalid .PhoneInputInput {
        border-color: rgba(180,35,24,0.4);
        background: rgba(180,35,24,0.05);
    }
`;

const Page = styled.div`
    min-height: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 20px 60px;
    background: #0b0b0d;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    position: relative;
    overflow-x: hidden;
`;

const RainbowGlow = styled.div`
    position: fixed;
    bottom: -60px;
    left: 50%;
    transform: translateX(-50%);
    width: 110%;
    height: 280px;
    background: linear-gradient(
        90deg,
        #ff4d4d, #ff9f43, #ffd43b, #69db7c,
        #4dabf7, #748ffc, #da77f2, #ff6b9d
    );
    filter: blur(72px);
    opacity: 0.22;
    pointer-events: none;
    z-index: 0;
    border-radius: 50%;
`;

const FormCard = styled.div`
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 520px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 25px;
    padding: 28px 32px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset;
    overflow: hidden;
    animation: ${fadeUp} 0.5s ease both;

    @media(max-width: 480px) { padding: 22px 18px; border-radius: 20px; }
`;

const DotPattern = styled.div`
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
    border-radius: inherit;
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
`;

const CardLogo = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
`;

const CardLogoName = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 19px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
`;

const BackBtn = styled.button`
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,0.75); }
`;

const FormHeader = styled.div`margin-bottom: 18px;`;

const FormTitle = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: 22px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 4px;
    letter-spacing: -0.5px;
`;

const FormSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.4);
    margin: 0;
    line-height: 1.5;
`;

const ErrorBanner = styled.div`
    background: rgba(180,35,24,0.12);
    border: 1px solid rgba(180,35,24,0.3);
    border-radius: 10px;
    padding: 12px 14px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,138,128,0.9);
    font-weight: 500;
    margin-bottom: 16px;
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const Section = styled.div`
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const SectionLabel = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    margin: 0;
`;

const FieldRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
`;

const Label = styled.label`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.1px;
    display: flex;
    align-items: center;
    gap: 6px;
`;

const Input = styled.input`
    padding: 9px 13px;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    color: #ffffff;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
    width: 100%;
    color-scheme: dark;

    &::placeholder { color: rgba(255,255,255,0.2); }
    &:focus { border-color: rgba(79,85,241,0.55); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }

    &:-webkit-autofill,
    &:-webkit-autofill:hover,
    &:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0px 1000px #111114 inset;
        -webkit-text-fill-color: #ffffff;
        caret-color: #ffffff;
        border-color: rgba(255,255,255,0.08);
        transition: background-color 5000s ease-in-out 0s;
    }
`;

const Select = styled.select`
    padding: 9px 13px;
    padding-right: 34px;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    color: ${p => p.$empty ? 'rgba(255,255,255,0.2)' : '#ffffff'};
    outline: none;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.3)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-color: rgba(255,255,255,0.04);
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
    color-scheme: dark;

    &:focus { border-color: rgba(79,85,241,0.55); background-color: rgba(255,255,255,0.06); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
    option { background: #111114; color: #ffffff; }
`;

const SubmitBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: #4F55F1;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 2px;
    transition: opacity 0.2s ease, transform 0.15s ease;

    &:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SkipBtn = styled.button`
    background: none;
    border: none;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.25);
    cursor: pointer;
    text-align: center;
    padding: 0;
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,0.6); }
`;

const Spinner = styled.div`
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ${spinAni} 0.7s linear infinite;
`;

const PhoneInputWrapper = styled.div`
    .koda-phone-input .PhoneInputCountry,
    .koda-phone-input .PhoneInputInput {
        border-color: ${p => p.$invalid ? 'rgba(180,35,24,0.4)' : 'rgba(255,255,255,0.08)'};
        background: ${p => p.$invalid ? 'rgba(180,35,24,0.05)' : 'rgba(255,255,255,0.04)'};
    }
`;

const ValidationHint = styled.span`
    font-size: 11px;
    font-weight: 500;
    color: rgba(255,138,128,0.9);
`;

// Tutorial tip overlay

const TipSpotlight = styled.div`
    position: fixed;
    border-radius: 28px;
    border: 2px solid rgba(79,85,241,0.65);
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.62);
    pointer-events: none;
    z-index: 500;
    animation: ${spotPulse} 2.2s ease infinite;
`;

const TipCard = styled.div`
    position: fixed;
    z-index: 501;
    width: 288px;
    background: #13131f;
    border: 1px solid rgba(79,85,241,0.3);
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(79,85,241,0.08) inset;
    animation: ${tipFadeIn} 0.35s ease both;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const TipArrow = styled.div`
    position: absolute;
    top: -7px;
    width: 12px;
    height: 12px;
    background: #13131f;
    border-top: 1px solid rgba(79,85,241,0.3);
    border-left: 1px solid rgba(79,85,241,0.3);
    transform: rotate(45deg);
`;

const TipPill = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba(79,85,241,0.12);
    border: 1px solid rgba(79,85,241,0.28);
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    color: #7b81f5;
    align-self: flex-start;
    text-transform: uppercase;
`;

const TipTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 17px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.3px;
`;

const TipBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    line-height: 1.65;
    margin: 0;
`;

const TipBtn = styled.button`
    padding: 10px 16px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.2s ease;
    &:hover { opacity: 0.85; }
`;

export default CreateCardPage;
