import { useState } from "react";
import styled, { keyframes } from "styled-components";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import KODALOGO from '../assets/koda-logo.png';

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
            const res = await fetch(`${import.meta.env.VITE_AUTH_URL}/auth/login`, {
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
            <RainbowGlow />
            <FormCard>
                <DotPattern />
                <CardLogo onClick={() => navigate('/')}>
                    <img src={KODALOGO} alt="Koda" width={26} height={26} />
                    <CardLogoName>koda</CardLogoName>
                </CardLogo>

                <FormHeader>
                    <FormTitle>Sign in</FormTitle>
                    <FormSub>Good to have you back.</FormSub>
                </FormHeader>

                {error && <ErrorBanner>{error}</ErrorBanner>}

                <Form onSubmit={handleSubmit}>
                    <Field>
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email" name="email" type="email"
                            placeholder="you@example.com"
                            value={form.email} onChange={handleChange}
                            autoComplete="off"
                            readOnly
                            onFocus={e => e.target.removeAttribute('readonly')}
                            disabled={loading}
                        />
                    </Field>

                    <Field>
                        <Label htmlFor="password">Password</Label>
                        <InputWrap>
                            <Input
                                id="password" name="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={form.password} onChange={handleChange}
                                autoComplete="new-password"
                                readOnly
                                onFocus={e => e.target.removeAttribute('readonly')}
                                disabled={loading}
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

                    <Divider><DividerLine /><DividerText>or</DividerText><DividerLine /></Divider>

                    <CreateBtn type="button" onClick={() => navigate('/signup')}>
                        Create account
                    </CreateBtn>
                </Form>

                <FormFooter>
                    <FooterLink to="/terms">Terms</FooterLink>
                    <FooterDot />
                    <FooterLink to="/privacy">Privacy</FooterLink>
                </FormFooter>
            </FormCard>
        </Page>
    );
};

const fadeUp  = keyframes`from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}`;
const spinAni = keyframes`to{transform:rotate(360deg)}`;

const Page = styled.div`
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    background: #0b0b0d;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    position: relative;
    overflow: hidden;
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

const FormCard = styled.div`
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
    background: linear-gradient(45deg, #ffffff05 40%, #121212);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 25px;
    padding: 40px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset;
    overflow: hidden;
    animation: ${fadeUp} 0.5s ease both;

    @media(max-width:480px) { padding: 28px 20px; border-radius: 20px; }
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
    margin-bottom: 32px;
`;

const CardLogoName = styled.span`
    font-family: 'Saira', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.3px;
`;

const FormHeader = styled.div`
    margin-bottom: 28px;
`;

const FormTitle = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: 26px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 6px;
    letter-spacing: -0.5px;
`;

const FormSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    color: rgba(255,255,255,0.4);
    margin: 0;
`;

const ErrorBanner = styled.div`
    background: rgba(180,40,40,0.15);
    border: 1px solid rgba(200,60,60,0.3);
    border-radius: 10px;
    padding: 12px 14px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: rgba(255,120,120,0.9);
    font-weight: 500;
    margin-bottom: 20px;
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const Label = styled.label`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.4);
    letter-spacing: 0.1px;
`;

const InputWrap = styled.div`position: relative;`;

const Input = styled.input`
    width: 100%;
    padding: 13px 16px;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 14px;
    color: #ffffff;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;

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

const EyeBtn = styled.button`
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: rgba(255,255,255,0.3);
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
    transition: color 0.2s;
    &:hover { color: rgba(255,255,255,0.7); }
`;

const SubmitBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 4px;
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

const CreateBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 13px;
    background: transparent;
    color: rgba(255,255,255,0.75);
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease, transform 0.15s ease;
    &:hover { border-color: rgba(255,255,255,0.25); color: #ffffff; transform: translateY(-1px); }
`;

const Spinner = styled.div`
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: ${spinAni} 0.7s linear infinite;
`;

const FormFooter = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.07);
`;

const FooterLink = styled(Link)`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    text-decoration: none;
    transition: color 0.2s;
    &:hover { color: rgba(255,255,255,0.7); }
`;

const FooterDot = styled.div`
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(255,255,255,0.12);
`;

export default LoginPage;
