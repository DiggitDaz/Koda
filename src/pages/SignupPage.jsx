import { useState, useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import KODALOGO from '../assets/koda-logo.png';

const SignupPage = () => {
    const navigate = useNavigate();

    const [showWalletModal, setShowWalletModal] = useState(true);
    const [showTip,      setShowTip]      = useState(() => !localStorage.getItem('koda_signup_tip_done'));
    const formCardRef  = useRef(null);
    const [cardRect,     setCardRect]     = useState(null);
    const [form,         setForm]         = useState({
        firstName: "", lastName: "", email: "",
        password: "", confirmPassword: "",
        phone: "", dateOfBirth: "",
        newsletter: false, marketing: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm,  setShowConfirm]  = useState(false);
    const [loading,      setLoading]      = useState(false);
    const [error,        setError]        = useState("");

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
        if (error) setError("");
    };

    const formatDob = (date) => {
        if (!date) return null;
        const [year, month, day] = date.split("-");
        return `${day}/${month}/${year}`;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.firstName.trim())  { setError("First name is required"); return; }
        if (!form.lastName.trim())   { setError("Last name is required"); return; }
        if (!form.email.trim())      { setError("Email is required"); return; }
        if (!/\S+@\S+\.\S+/.test(form.email)) { setError("Please enter a valid email"); return; }
        if (!form.password)          { setError("Password is required"); return; }
        if (form.password.length < 8) { setError("Password must be at least 8 characters"); return; }
        if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }

        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${import.meta.env.VITE_AUTH_URL}/auth/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    full_name:             `${form.firstName} ${form.lastName}`,
                    email:                 form.email,
                    password:              form.password,
                    phone_number:          form.phone || null,
                    date_of_birth:         formatDob(form.dateOfBirth) || null,
                    newsletter_subscribed: form.newsletter,
                    marketing_emails:      form.marketing,
                }),
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem("authToken", data.token);
                window.location.href = '/dashboard';
            } else {
                setError(data.errors ? data.errors.map(e => e.msg).join(", ") : data.message || "Signup failed");
            }
        } catch {
            setError("Network error, please try again");
        } finally {
            setLoading(false);
        }
    };

    const dismissWalletModal = () => {
        setShowWalletModal(false);
    };

    const dismissTip = () => {
        setShowTip(false);
        localStorage.setItem('koda_signup_tip_done', '1');
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

    return (
      <>
        <Page>
            <RainbowGlow />

            <FormCard ref={formCardRef}>
                <DotPattern />

                <CardLogo onClick={() => navigate('/')}>
                    <img src={KODALOGO} alt="Koda" width={26} height={26} />
                    <CardLogoName>koda</CardLogoName>
                </CardLogo>

                <FormHeader>
                    <FormTitle>Create account</FormTitle>
                    <FormSub>Join Koda and start spending from self-custody today.</FormSub>
                </FormHeader>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <Form onSubmit={handleSubmit}>
                    <FieldRow>
                        <Field>
                            <Label>First name</Label>
                            <Input
                                name="firstName"
                                placeholder="Jane"
                                value={form.firstName}
                                onChange={handleChange}
                                autoComplete="off"
                                readOnly
                                onFocus={e => e.target.removeAttribute('readonly')}
                                disabled={loading}
                            />
                        </Field>
                        <Field>
                            <Label>Last name</Label>
                            <Input
                                name="lastName"
                                placeholder="Smith"
                                value={form.lastName}
                                onChange={handleChange}
                                autoComplete="off"
                                readOnly
                                onFocus={e => e.target.removeAttribute('readonly')}
                                disabled={loading}
                            />
                        </Field>
                    </FieldRow>

                    <Field>
                        <Label>Email address</Label>
                        <Input
                            name="email"
                            type="email"
                            placeholder="you@example.com"
                            value={form.email}
                            onChange={handleChange}
                            autoComplete="off"
                            readOnly
                            onFocus={e => e.target.removeAttribute('readonly')}
                            disabled={loading}
                        />
                    </Field>

                    <Field>
                        <Label>Password</Label>
                        <InputWrap>
                            <Input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Min. 8 characters"
                                value={form.password}
                                onChange={handleChange}
                                autoComplete="new-password"
                                readOnly
                                onFocus={e => e.target.removeAttribute('readonly')}
                                disabled={loading}
                                style={{ paddingRight: 44 }}
                            />
                            <EyeToggle type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </EyeToggle>
                        </InputWrap>
                    </Field>

                    <Field>
                        <Label>Confirm password</Label>
                        <InputWrap>
                            <Input
                                name="confirmPassword"
                                type={showConfirm ? "text" : "password"}
                                placeholder="Repeat your password"
                                value={form.confirmPassword}
                                onChange={handleChange}
                                autoComplete="new-password"
                                readOnly
                                onFocus={e => e.target.removeAttribute('readonly')}
                                disabled={loading}
                                style={{ paddingRight: 44 }}
                            />
                            <EyeToggle type="button" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </EyeToggle>
                        </InputWrap>
                    </Field>

                    <FieldRow>
                        <Field>
                            <Label>Phone <Optional>(optional)</Optional></Label>
                            <Input
                                name="phone"
                                type="tel"
                                placeholder="+44 7700 000000"
                                value={form.phone}
                                onChange={handleChange}
                                autoComplete="off"
                                readOnly
                                onFocus={e => e.target.removeAttribute('readonly')}
                                disabled={loading}
                            />
                        </Field>
                        <Field>
                            <Label>Date of birth <Optional>(optional)</Optional></Label>
                            <Input
                                name="dateOfBirth"
                                type="date"
                                value={form.dateOfBirth}
                                onChange={handleChange}
                                disabled={loading}
                            />
                        </Field>
                    </FieldRow>

                    <CheckboxGroup>
                        <CheckboxRow>
                            <Checkbox name="newsletter" type="checkbox"
                                checked={form.newsletter} onChange={handleChange}
                                disabled={loading} />
                            <CheckboxLabel>Send me product updates and news</CheckboxLabel>
                        </CheckboxRow>
                        <CheckboxRow>
                            <Checkbox name="marketing" type="checkbox"
                                checked={form.marketing} onChange={handleChange}
                                disabled={loading} />
                            <CheckboxLabel>Send me offers and promotions</CheckboxLabel>
                        </CheckboxRow>
                    </CheckboxGroup>

                    <Terms>
                        By creating an account you agree to our{" "}
                        <TermsLink to="/terms">Terms</TermsLink> and{" "}
                        <TermsLink to="/privacy">Privacy Policy</TermsLink>.
                    </Terms>

                    <SubmitBtn type="submit" disabled={loading}>
                        {loading ? <Spinner /> : 'Create account'}
                    </SubmitBtn>

                    <Divider><DividerLine /><DividerText>or</DividerText><DividerLine /></Divider>

                    <SignInBtn type="button" onClick={() => navigate('/login')}>
                        Sign in
                    </SignInBtn>
                </Form>
            </FormCard>
        </Page>

        {showWalletModal && (
            <WalletModalOverlay>
                <WalletModalCard>
                    <WalletModalIconRow>
                        <WalletModalIcon>🦊</WalletModalIcon>
                    </WalletModalIconRow>
                    <WalletModalPill>Wallet requirement</WalletModalPill>
                    <WalletModalTitle>MetaMask required</WalletModalTitle>
                    <WalletModalBody>
                        Koda runs on <strong>Arc Testnet</strong>, a blockchain that uses <strong>USDC as its gas token</strong> instead of ETH. This is an unusual configuration that most wallets haven't added support for yet.
                    </WalletModalBody>
                    <WalletModalBody>
                        Currently supported wallets:
                    </WalletModalBody>
                    <WalletModalOptions>
                        <WalletModalOption>
                            <WalletModalOptionDot />
                            <span><strong>MetaMask</strong> browser extension (desktop)</span>
                        </WalletModalOption>
                        <WalletModalOption>
                            <WalletModalOptionDot />
                            <span><strong>MetaMask mobile app</strong> — scan the QR code when connecting</span>
                        </WalletModalOption>
                        <WalletModalOption>
                            <WalletModalOptionDot />
                            <span>Open inside <strong>MetaMask's in-app browser</strong> on mobile</span>
                        </WalletModalOption>
                    </WalletModalOptions>
                    <WalletModalNote>
                        We're working to add support for Rainbow, Rabby, and other wallets as Arc Testnet gains wider adoption.
                    </WalletModalNote>
                    <WalletModalBtn onClick={dismissWalletModal}>Got it, continue</WalletModalBtn>
                </WalletModalCard>
            </WalletModalOverlay>
        )}

        {showTip && cardRect && (() => {
            const onRight = cardRect.winW >= 900 && (cardRect.winW - cardRect.right) >= 320;
            const onLeft  = !onRight && cardRect.winW >= 900 && cardRect.left >= 320;
            const tipTop  = (onRight || onLeft)
                ? Math.max(8, cardRect.top + cardRect.height / 2 - 115)
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
                    <SignupSpotlight style={{
                        top:    cardRect.top    - 10,
                        left:   cardRect.left   - 10,
                        width:  cardRect.width  + 20,
                        height: cardRect.height + 20,
                    }} />
                    <SignupTipCard style={{ top: tipTop, left: tipLeft }}>
                        <SignupTipArrow style={arrowStyle} />
                        <SignupTipPill>Heads up</SignupTipPill>
                        <SignupTipTitle>Use fictitious details</SignupTipTitle>
                        <SignupTipBody>
                            This is a testnet app. Please use a made-up name, email address, phone number and date of birth. Do not enter any real personal information.
                        </SignupTipBody>
                        <SignupTipBtn onClick={dismissTip}>Got it, continue</SignupTipBtn>
                    </SignupTipCard>
                </>
            );
        })()}
      </>
    );
};

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

const Page = styled.div`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 20px;
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
        #ff4d4d,
        #ff9f43,
        #ffd43b,
        #69db7c,
        #4dabf7,
        #748ffc,
        #da77f2,
        #ff6b9d
    );
    filter: blur(72px);
    opacity: 0.22;
    pointer-events: none;
    z-index: 0;
    border-radius: 50%;
`;

const SignupSpotlight = styled.div`
    position: fixed;
    border-radius: 28px;
    border: 2px solid rgba(79,85,241,0.65);
    box-shadow: 0 0 0 9999px rgba(0,0,0,0.62);
    pointer-events: none;
    z-index: 500;
    animation: ${spotPulse} 2.2s ease infinite;
`;

const SignupTipCard = styled.div`
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

const SignupTipArrow = styled.div`
    position: absolute;
    top: -7px;
    width: 12px;
    height: 12px;
    background: #13131f;
    border-top: 1px solid rgba(79,85,241,0.3);
    border-left: 1px solid rgba(79,85,241,0.3);
    transform: rotate(45deg);
`;

const SignupTipPill = styled.span`
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

const SignupTipTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 17px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    letter-spacing: -0.3px;
`;

const SignupTipBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    line-height: 1.65;
    margin: 0;
`;

const SignupTipBtn = styled.button`
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

const FormCard = styled.div`
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 480px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 25px;
    padding: 28px 32px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset;
    overflow: hidden;
    animation: ${fadeUp} 0.5s ease both;

    @media(max-width:480px) { padding: 20px 18px; border-radius: 20px; }
`;

const DotPattern = styled.div`
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
    border-radius: inherit;
`;

const CardLogo = styled.button`
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    margin-bottom: 16px;
`;

const CardLogoName = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
`;

const FormHeader = styled.div`margin-bottom: 14px;`;

const FormTitle = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: 22px; font-weight: 800;
    color: #ffffff; margin: 0 0 4px; letter-spacing: -0.5px;
`;

const FormSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; color: rgba(255,255,255,0.45); margin: 0;
`;

const ErrorBanner = styled.div`
    background: rgba(180,40,40,0.15);
    border: 1px solid rgba(200,60,60,0.3);
    border-radius: 10px; padding: 12px 14px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; color: rgba(255,120,120,0.9); font-weight: 500; margin-bottom: 20px;
`;

const Form = styled.form`
    display: flex; flex-direction: column; gap: 9px;
`;

const FieldRow = styled.div`
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    @media(max-width:480px) { grid-template-columns: 1fr; }
`;

const Field = styled.div`display: flex; flex-direction: column; gap: 3px;`;

const Label = styled.label`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px; font-weight: 600;
    color: rgba(255,255,255,0.45); letter-spacing: 0.1px;
`;

const Optional = styled.span`font-weight: 400; color: rgba(255,255,255,0.25);`;

const InputWrap = styled.div`position: relative;`;

const Input = styled.input`
    width: 100%; padding: 8px 12px;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px; color: #ffffff;
    outline: none; box-sizing: border-box;
    transition: border-color 0.15s;
    color-scheme: dark;

    &::placeholder { color: rgba(255,255,255,0.25); }
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

const EyeToggle = styled.button`
    position: absolute; right: 12px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    color: rgba(255,255,255,0.35); cursor: pointer; padding: 0;
    display: grid; place-items: center;
    transition: color 0.2s;
    &:hover { color: rgba(255,255,255,0.75); }
`;

const CheckboxGroup = styled.div`display: flex; flex-direction: column; gap: 6px; padding-top: 2px;`;

const CheckboxRow = styled.div`display: flex; align-items: center; gap: 8px;`;

const Checkbox = styled.input`
    width: 14px; height: 14px; accent-color: #4F55F1;
    cursor: pointer; flex-shrink: 0;
`;

const CheckboxLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px; color: rgba(255,255,255,0.5);
`;

const Terms = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px; color: rgba(255,255,255,0.35);
    line-height: 1.5; margin: 0;
`;

const TermsLink = styled(Link)`
    color: rgba(255,255,255,0.65); font-weight: 600;
    text-decoration: none;
    &:hover { color: #ffffff; text-decoration: underline; }
`;

const SubmitBtn = styled.button`
    padding: 11px;
    background: #4F55F1; color: #ffffff; border: none; border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px; font-weight: 700; cursor: pointer;
    margin-top: 2px; display: flex; align-items: center;
    justify-content: center; gap: 8px;
    transition: opacity 0.2s ease, transform 0.15s ease;
    &:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Divider = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const DividerLine = styled.div`
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.07);
`;

const DividerText = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.25);
`;

const SignInBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px;
    background: transparent;
    color: rgba(255,255,255,0.75);
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease, transform 0.15s ease;
    &:hover { border-color: rgba(255,255,255,0.25); color: #ffffff; transform: translateY(-1px); }
`;

const Spinner = styled.div`
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%;
    animation: ${spinAni} 0.7s linear infinite;
`;

// Wallet requirement modal

const walletModalFadeIn = keyframes`
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const WalletModalOverlay = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 900;
`;

const WalletModalCard = styled.div`
    width: 100%;
    max-width: 420px;
    background: linear-gradient(45deg, #000000ff 20%, #121212);
    border-radius: 24px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7);
    animation: ${walletModalFadeIn} 0.3s ease both;

    @media (max-width: 480px) { border-radius: 20px; padding: 22px 20px; }
`;

const WalletModalIconRow = styled.div`
    display: flex;
    justify-content: center;
    margin-bottom: 4px;
`;

const WalletModalIcon = styled.div`
    font-size: 40px;
    line-height: 1;
`;

const WalletModalPill = styled.span`
    display: inline-flex;
    align-self: center;
    padding: 3px 10px;
    border-radius: 20px;
    background: rgba(79,85,241,0.12);
    border: 1px solid rgba(79,85,241,0.28);
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    color: #7b81f5;
    text-transform: uppercase;
`;

const WalletModalTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 22px;
    font-weight: 800;
    color: #ffffff;
    margin: 0;
    text-align: center;
    letter-spacing: -0.3px;
`;

const WalletModalBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    line-height: 1.65;
    margin: 0;

    strong { color: rgba(255,255,255,0.85); font-weight: 600; }
`;

const WalletModalOptions = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 14px 16px;
`;

const WalletModalOption = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12.5px;
    color: rgba(255,255,255,0.55);
    line-height: 1.5;

    strong { color: rgba(255,255,255,0.85); font-weight: 600; }
`;

const WalletModalOptionDot = styled.div`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4F55F1;
    flex-shrink: 0;
    margin-top: 5px;
`;

const WalletModalNote = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    color: rgba(255,255,255,0.25);
    line-height: 1.6;
    margin: 0;
    text-align: center;
`;

const WalletModalBtn = styled.button`
    padding: 13px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 4px;
    transition: opacity 0.2s ease;
    &:hover { opacity: 0.85; }
`;

export default SignupPage;
