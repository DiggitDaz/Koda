import { useState } from "react";
import styled, { keyframes } from "styled-components";
import { Eye, EyeOff, AlertTriangle, ShieldCheck, Lock, Zap } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import KODALOGO from '../assets/koda-logo.png';
import LOGINBG from '../assets/login-join-bg.png';

// Component

const SignupPage = () => {
    const navigate = useNavigate();

    const [agreed,       setAgreed]       = useState(false);
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
            const res = await fetch("https://chainfree.site:7001/auth/signup", {
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

    return (
        <Page>
            {/* Sandbox warning modal */}
            {!agreed && (
                <ModalOverlay>
                    <WarningCard>
                        <WarningIconWrap>
                            <AlertTriangle size={28} />
                        </WarningIconWrap>
                        <WarningTitle>Test environment</WarningTitle>
                        <WarningBody>
                            Koda is running on <strong>Stripe Sandbox</strong> and <strong>Arc Testnet</strong>. This is a demonstration only, no real payments, no real money.
                        </WarningBody>
                        <WarningList>
                            <WarningItem><ShieldCheck size={14} /><span>Use <strong>fictitious personal details</strong>, do not enter your real name, address or date of birth</span></WarningItem>
                            <WarningItem><Lock size={14} /><span>Use a <strong>test email address</strong>, real emails are not required or verified</span></WarningItem>
                            <WarningItem><Zap size={14} /><span>Card numbers will be <strong>Stripe test cards</strong> with no real financial data</span></WarningItem>
                        </WarningList>
                        <WarningBtn onClick={() => setAgreed(true)}>
                            I understand, continue
                        </WarningBtn>
                        <WarningBack onClick={() => navigate('/')}>
                            Go back
                        </WarningBack>
                    </WarningCard>
                </ModalOverlay>
            )}

            {/* Left panel */}
            <LeftPanel>
                <PanelContent>
                    <PanelLogo onClick={() => navigate('/')}>
                        <img src={KODALOGO} alt="Koda" width={32} height={32} />
                        <PanelLogoName>Koda</PanelLogoName>
                    </PanelLogo>
                    <PanelMain>
                        <PanelEyebrow>Self-custody payments</PanelEyebrow>
                        <PanelHeadline>
                            Your wallet.<br />
                            Your money.<br />
                            <PanelAccent>Your card.</PanelAccent>
                        </PanelHeadline>
                        <PanelSub>
                            Spend USDC directly from any wallet you choose. No custodian, no compromise, settled on-chain.
                        </PanelSub>
                        <PanelPerks>
                            {[
                                { icon: ShieldCheck, text: 'Your keys, always yours' },
                                { icon: Zap,         text: 'On-chain settlement'     },
                                { icon: Lock,        text: '1:1 USDC backed'         },
                            ].map(({ icon: Icon, text }) => (
                                <PanelPerk key={text}>
                                    <PanelPerkIcon><Icon size={14} /></PanelPerkIcon>
                                    <span>{text}</span>
                                </PanelPerk>
                            ))}
                        </PanelPerks>
                    </PanelMain>
                    <PanelFooter>
                        Already have an account?{' '}
                        <PanelSignIn onClick={() => navigate('/login')}>Sign in</PanelSignIn>
                    </PanelFooter>
                </PanelContent>
            </LeftPanel>

            {/* Right panel */}
            <RightPanel>
                <FormCard>
                    <FormHeader>
                        <FormTitle>Create account</FormTitle>
                        <FormSub>
                            Join Koda and start spending from self-custody today.
                        </FormSub>
                    </FormHeader>

                    {error && <ErrorBanner>{error}</ErrorBanner>}

                    <Form onSubmit={handleSubmit}>
                        <FieldRow>
                            <Field>
                                <Label>First name</Label>
                                <Input name="firstName" placeholder="Jane"
                                    value={form.firstName} onChange={handleChange}
                                    autoComplete="given-name" disabled={loading} />
                            </Field>
                            <Field>
                                <Label>Last name</Label>
                                <Input name="lastName" placeholder="Smith"
                                    value={form.lastName} onChange={handleChange}
                                    autoComplete="family-name" disabled={loading} />
                            </Field>
                        </FieldRow>

                        <Field>
                            <Label>Email address</Label>
                            <Input name="email" type="email" placeholder="you@example.com"
                                value={form.email} onChange={handleChange}
                                autoComplete="email" disabled={loading} />
                        </Field>

                        <Field>
                            <Label>Password</Label>
                            <InputWrap>
                                <Input name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Min. 8 characters"
                                    value={form.password} onChange={handleChange}
                                    autoComplete="new-password" disabled={loading}
                                    style={{ paddingRight: 44 }} />
                                <EyeToggle type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </EyeToggle>
                            </InputWrap>
                        </Field>

                        <Field>
                            <Label>Confirm password</Label>
                            <InputWrap>
                                <Input name="confirmPassword"
                                    type={showConfirm ? "text" : "password"}
                                    placeholder="Repeat your password"
                                    value={form.confirmPassword} onChange={handleChange}
                                    autoComplete="new-password" disabled={loading}
                                    style={{ paddingRight: 44 }} />
                                <EyeToggle type="button" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}>
                                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </EyeToggle>
                            </InputWrap>
                        </Field>

                        <FieldRow>
                            <Field>
                                <Label>Phone <Optional>(optional)</Optional></Label>
                                <Input name="phone" type="tel" placeholder="+44 7700 000000"
                                    value={form.phone} onChange={handleChange}
                                    autoComplete="tel" disabled={loading} />
                            </Field>
                            <Field>
                                <Label>Date of birth <Optional>(optional)</Optional></Label>
                                <Input name="dateOfBirth" type="date"
                                    value={form.dateOfBirth} onChange={handleChange}
                                    disabled={loading} />
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
                    </Form>
                </FormCard>
            </RightPanel>
        </Page>
    );
};

// Animations
const fadeUp  = keyframes`from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}`;
const fadeIn  = keyframes`from{opacity:0}to{opacity:1}`;
const popIn   = keyframes`0%{opacity:0;transform:scale(0.94)}100%{opacity:1;transform:scale(1)}`;
const spinAni = keyframes`to{transform:rotate(360deg)}`;

// Page
const Page = styled.div`
    min-height: 100vh;
    display: grid;
    grid-template-columns: 480px 1fr;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    background: #000000;

    @media(max-width:1024px) { grid-template-columns: 400px 1fr; }
    @media(max-width:768px)  { grid-template-columns: 1fr; }
`;

// Warning modal
const ModalOverlay = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 200;
    animation: ${fadeIn} 0.2s ease;
`;
const WarningCard = styled.div`
    width: 100%;
    max-width: 480px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 24px;
    padding: 40px;
    box-shadow: 0 8px 48px rgba(0,0,0,0.6);
    animation: ${popIn} 0.3s ease;
`;
const WarningIconWrap = styled.div`
    width: 56px; height: 56px;
    border-radius: 16px;
    background: rgba(79,85,241,0.1);
    border: 1px solid rgba(79,85,241,0.25);
    display: grid; place-items: center;
    color: #7b81f5;
    margin-bottom: 20px;
`;
const WarningTitle = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: 24px; font-weight: 800;
    color: #ffffff; margin: 0 0 12px; letter-spacing: -0.5px;
`;
const WarningBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px; color: rgba(255,255,255,0.5);
    line-height: 1.7; margin: 0 0 24px;
    strong { color: rgba(255,255,255,0.85); font-weight: 700; }
`;
const WarningList = styled.div`
    display: flex; flex-direction: column; gap: 12px;
    padding: 20px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px; margin-bottom: 28px;
`;
const WarningItem = styled.div`
    display: flex; align-items: flex-start; gap: 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.5;
    svg { color: #7b81f5; flex-shrink: 0; margin-top: 2px; }
    strong { color: rgba(255,255,255,0.85); font-weight: 700; }
`;
const WarningBtn = styled.button`
    width: 100%; padding: 15px;
    background: #4F55F1; color: #ffffff; border: none; border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px; font-weight: 700; cursor: pointer; margin-bottom: 10px;
    transition: opacity 0.2s ease, transform 0.2s ease;
    &:hover { opacity: 0.85; transform: translateY(-1px); }
`;
const WarningBack = styled.button`
    width: 100%; padding: 12px;
    background: none; border: none;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; font-weight: 600;
    color: rgba(255,255,255,0.3); cursor: pointer;
    transition: color 0.2s;
    &:hover { color: rgba(255,255,255,0.7); }
`;

// Left panel
const LeftPanel = styled.div`
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: linear-gradient(160deg, rgba(0,0,0,0.82) 0%, rgba(15,15,17,0.72) 100%),
                url(${LOGINBG}) center center / cover no-repeat;
    border-right: 1px solid rgba(255,255,255,0.07);

    @media(max-width:768px) { display: none; }
`;

const PanelContent = styled.div`
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 40px;
`;

const PanelLogo = styled.button`
    display: flex; align-items: center; gap: 10px;
    background: none; border: none; cursor: pointer; padding: 0;
    margin-bottom: 72px;
`;

const PanelLogoName = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 22px; font-weight: 700;
    color: #ffffff; letter-spacing: -0.3px;
`;

const PanelMain = styled.div`flex: 1;`;

const PanelEyebrow = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
    text-transform: uppercase; color: rgba(255,255,255,0.4);
    margin: 0 0 16px;
`;

const PanelHeadline = styled.h1`
    font-family: 'Saira', sans-serif;
    font-size: clamp(30px, 3.5vw, 46px);
    font-weight: 800; color: #ffffff;
    line-height: 1.1; letter-spacing: -1px;
    margin: 0 0 20px;
    animation: ${fadeUp} 0.7s ease both;
`;

const PanelAccent = styled.span`color: rgba(255,255,255,0.3);`;

const PanelSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px; color: rgba(255,255,255,0.55);
    line-height: 1.7; margin: 0 0 40px; max-width: 340px;
    animation: ${fadeUp} 0.7s ease 0.1s both;
`;

const PanelPerks = styled.div`
    display: flex; flex-direction: column; gap: 14px;
    animation: ${fadeUp} 0.7s ease 0.2s both;
`;

const PanelPerk = styled.div`
    display: flex; align-items: center; gap: 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.55);
`;

const PanelPerkIcon = styled.div`
    width: 28px; height: 28px; border-radius: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    display: grid; place-items: center; color: rgba(255,255,255,0.7); flex-shrink: 0;
`;

const PanelFooter = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; color: rgba(255,255,255,0.4);
    margin: 40px 0 0;
`;

const PanelSignIn = styled.button`
    background: none; border: none; padding: 0;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; font-weight: 700;
    color: #ffffff; cursor: pointer;
    transition: opacity 0.2s;
    &:hover { opacity: 0.6; }
`;

// Right panel
const RightPanel = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 32px;
    overflow-y: auto;
    background: #000000;

    @media(max-width:768px) { padding: 40px 20px; }
`;

const FormCard = styled.div`
    width: 100%;
    max-width: 440px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 40px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: ${fadeUp} 0.5s ease both;

    @media(max-width:480px) { padding: 28px 20px; border-radius: 20px; }
`;

const FormHeader = styled.div`margin-bottom: 28px;`;

const FormTitle = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: 26px; font-weight: 800;
    color: #ffffff; margin: 0 0 6px; letter-spacing: -0.5px;
`;

const FormSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px; color: rgba(255,255,255,0.45); margin: 0;
`;

const FormLink = styled(Link)`
    color: rgba(255,255,255,0.7); font-weight: 700; text-decoration: none;
    &:hover { color: #ffffff; text-decoration: underline; }
`;

const ErrorBanner = styled.div`
    background: rgba(180,40,40,0.15);
    border: 1px solid rgba(200,60,60,0.3);
    border-radius: 10px; padding: 12px 14px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; color: rgba(255,120,120,0.9); font-weight: 500; margin-bottom: 20px;
`;

const Form = styled.form`
    display: flex; flex-direction: column; gap: 14px;
`;

const FieldRow = styled.div`
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    @media(max-width:480px) { grid-template-columns: 1fr; }
`;

const Field = styled.div`display: flex; flex-direction: column; gap: 5px;`;

const Label = styled.label`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,0.45); letter-spacing: 0.1px;
`;

const Optional = styled.span`font-weight: 400; color: rgba(255,255,255,0.25);`;

const InputWrap = styled.div`position: relative;`;

const Input = styled.input`
    width: 100%; padding: 11px 14px;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px; color: #ffffff;
    outline: none; box-sizing: border-box;
    transition: border-color 0.15s;
    color-scheme: dark;

    &::placeholder { color: rgba(255,255,255,0.25); }
    &:focus { border-color: rgba(79,85,241,0.55); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
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

const CheckboxGroup = styled.div`display: flex; flex-direction: column; gap: 10px; padding-top: 4px;`;

const CheckboxRow = styled.div`display: flex; align-items: center; gap: 10px;`;

const Checkbox = styled.input`
    width: 16px; height: 16px; accent-color: #4F55F1;
    cursor: pointer; flex-shrink: 0;
`;

const CheckboxLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px; color: rgba(255,255,255,0.5);
`;

const Terms = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px; color: rgba(255,255,255,0.35);
    line-height: 1.6; margin: 0;
`;

const TermsLink = styled(Link)`
    color: rgba(255,255,255,0.65); font-weight: 600;
    text-decoration: none;
    &:hover { color: #ffffff; text-decoration: underline; }
`;

const SubmitBtn = styled.button`
    padding: 14px;
    background: #4F55F1; color: #ffffff; border: none; border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px; font-weight: 700; cursor: pointer;
    margin-top: 4px; display: flex; align-items: center;
    justify-content: center; gap: 8px;
    transition: opacity 0.2s ease, transform 0.2s ease;
    &:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Spinner = styled.div`
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%;
    animation: ${spinAni} 0.7s linear infinite;
`;

export default SignupPage;
