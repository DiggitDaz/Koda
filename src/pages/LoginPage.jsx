import { useState } from "react";
import styled, { keyframes } from "styled-components";
import { Eye, EyeOff, ShieldCheck, Zap, Lock } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import KODALOGO from '../assets/koda-logo.png';
import LOGINBG from '../assets/login-join-bg.png';

const LoginPage = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        if (error) setError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.email || !form.password) { setError("Please fill in all fields"); return; }
        setLoading(true);
        setError("");
        try {
            const res = await fetch("https://chainfree.site:7001/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email, password: form.password }),
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem("authToken", data.token);
                navigate("/dashboard");
            } else {
                setError(data.message || "Login failed");
            }
        } catch {
            setError("Network error, please try again");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Page>
            {// Left panel}
            <LeftPanel>
                <PanelContent>
                    <PanelLogo onClick={() => navigate('/')}>
                        <img src={KODALOGO} alt="Koda" width={32} height={32} />
                        <PanelLogoName>Koda</PanelLogoName>
                    </PanelLogo>
                    <PanelMain>
                        <PanelEyebrow>Welcome back</PanelEyebrow>
                        <PanelHeadline>
                            Your money,<br />
                            your wallet,<br />
                            <PanelAccent>your card.</PanelAccent>
                        </PanelHeadline>
                        <PanelSub>
                            Spend USDC directly from self-custody. No custodian, no compromise, settled on-chain.
                        </PanelSub>
                        
                    </PanelMain>
                    <PanelFooter>
                        Don't have an account?{' '}
                        <PanelSignUp onClick={() => navigate('/signup')}>Create one</PanelSignUp>
                    </PanelFooter>
                </PanelContent>
            </LeftPanel>

            {// Right panel}
            <RightPanel>
                <FormCard>
                    <FormHeader>
                        <FormTitle>Sign in</FormTitle>
                        <FormSub>
                            Good to have you back.
                        </FormSub>
                    </FormHeader>

                    {error && <ErrorBanner>{error}</ErrorBanner>}

                    <Form onSubmit={handleSubmit}>
                        <Field>
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email" name="email" type="email"
                                value={form.email} onChange={handleChange}
                                autoComplete="off" disabled={loading}
                            />
                        </Field>

                        <Field>
                            <Label htmlFor="password">Password</Label>
                            <InputWrap>
                                <Input
                                    id="password" name="password"
                                    type={showPassword ? "text" : "password"}
                                    value={form.password} onChange={handleChange}
                                    autoComplete="off" disabled={loading}
                                    style={{ paddingRight: "48px" }}
                                />
                                <EyeBtn type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </EyeBtn>
                            </InputWrap>
                        </Field>

                        <SubmitBtn type="submit" disabled={loading}>
                            {loading ? <Spinner /> : 'Sign in'}
                        </SubmitBtn>
                    </Form>

                    <FormFooter>
                        <FooterLink to="/terms">Terms</FooterLink>
                        <FooterDot />
                        <FooterLink to="/privacy">Privacy</FooterLink>
                    </FormFooter>
                </FormCard>
            </RightPanel>
        </Page>
    );
};

// Animations
const fadeUp  = keyframes`from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}`;
const spinAni = keyframes`to{transform:rotate(360deg)}`;

// Page
const Page = styled.div`
    display: grid;
    grid-template-columns: 480px 1fr;
    min-height: 100vh;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    background: #000000;

    @media(max-width:1024px) { grid-template-columns: 400px 1fr; }
    @media(max-width:768px)  { grid-template-columns: 1fr; }
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
    font-size: 16px; color: rgba(255,255,255,0.55);
    line-height: 1.7; margin: 0 0 40px; max-width: 340px;
    animation: ${fadeUp} 0.7s ease 0.1s both;
`;

const Stats = styled.div`
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 20px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px;
    width: fit-content;
    animation: ${fadeUp} 0.7s ease 0.2s both;
`;

const Stat = styled.div`display: flex; flex-direction: column; align-items: center; gap: 2px;`;

const StatValue = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 18px; font-weight: 800; color: #ffffff;
`;

const StatLabel = styled.span`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 10px; color: rgba(255,255,255,0.4); white-space: nowrap;
`;

const StatDivider = styled.div`width: 1px; height: 28px; background: rgba(255,255,255,0.08);`;

const PanelFooter = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px; color: rgba(255,255,255,0.4);
    margin: 40px 0 0;
`;

const PanelSignUp = styled.button`
    background: none; border: none; padding: 0;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px; font-weight: 700;
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
    background: #000000;

    @media(max-width:768px) { padding: 40px 20px; }
`;

const FormCard = styled.div`
    width: 100%;
    max-width: 420px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    padding: 40px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    animation: ${fadeUp} 0.5s ease both;

    @media(max-width:480px) { padding: 28px 20px; border-radius: 20px; }
`;

const FormHeader = styled.div`margin-bottom: 32px;`;

const FormTitle = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: 28px; font-weight: 800;
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
    display: flex; flex-direction: column; gap: 18px;
`;

const Field = styled.div`
    display: flex; flex-direction: column; gap: 6px;
`;

const Label = styled.label`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px; font-weight: 600;
    color: rgba(255,255,255,0.45); letter-spacing: 0.1px;
`;

const InputWrap = styled.div`position: relative;`;

const Input = styled.input`
    width: 100%;
    padding: 13px 16px;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px; color: #ffffff;
    outline: none; box-sizing: border-box;
    transition: border-color 0.2s;

    &::placeholder { color: rgba(255,255,255,0.25); }
    &:focus { border-color: rgba(79,85,241,0.55); }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const EyeBtn = styled.button`
    position: absolute; right: 14px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none;
    color: rgba(255,255,255,0.35); cursor: pointer;
    display: grid; place-items: center; padding: 0;
    transition: color 0.2s;
    &:hover { color: rgba(255,255,255,0.75); }
`;

const SubmitBtn = styled.button`
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px;
    background: #4F55F1; color: #ffffff; border: none; border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 4px;
    transition: opacity 0.2s ease, transform 0.2s ease;
    &:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const Spinner = styled.div`
    width: 20px; height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #ffffff; border-radius: 50%;
    animation: ${spinAni} 0.7s linear infinite;
`;

const FormFooter = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 28px;
    padding-top: 24px;
    border-top: 1px solid rgba(255,255,255,0.07);
`;

const FooterLink = styled(Link)`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px; color: rgba(255,255,255,0.35);
    text-decoration: none; transition: color 0.2s;
    &:hover { color: rgba(255,255,255,0.75); }
`;

const FooterDot = styled.div`
    width: 3px; height: 3px; border-radius: 50%;
    background: rgba(255,255,255,0.15);
`;

export default LoginPage;
