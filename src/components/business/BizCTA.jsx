import { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { ArrowRight, Check } from 'lucide-react';
import emailjs from '@emailjs/browser';

const EMAILJS_SERVICE_ID  = 'service_kiehwym';
const EMAILJS_TEMPLATE_ID = 'template_h66dcq9';
const EMAILJS_PUBLIC_KEY  = 'THy31eCtObZDzripn';

const BizCTA = () => {
    const [form, setForm]       = useState({ company: '', email: '', message: '' });
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending]     = useState(false);
    const [error, setError]         = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.email.trim() || !form.company.trim()) return;
        setSending(true);
        setError('');
        try {
            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                {
                    company: form.company,
                    email:   form.email,
                    message: form.message || 'No message provided.',
                },
                EMAILJS_PUBLIC_KEY
            );
            setSubmitted(true);
        } catch (err) {
            console.error('EmailJS error:', err);
            setError('Something went wrong — please email us directly at hello@koda.finance');
        } finally {
            setSending(false);
        }
    };

    return (
        <Section id="contact">
            <OrbCenter />
            <DotGrid />
            <Inner>
                <Left>
                    <Kicker>Get in touch</Kicker>
                    <Title>Ready to add self-custody payments to your platform?</Title>
                    <Desc>
                        We work directly with fintechs, neobanks, and wallet providers
                        to scope and deliver integrations. Tell us about your platform
                        and we'll get back to you within one business day.
                    </Desc>

                    <CheckList>
                        <CheckItem>
                            <CheckIcon><Check size={11} strokeWidth={3} /></CheckIcon>
                            Dedicated integration support
                        </CheckItem>
                        <CheckItem>
                            <CheckIcon><Check size={11} strokeWidth={3} /></CheckIcon>
                            Test sandbox access on day one
                        </CheckItem>
                        <CheckItem>
                            <CheckIcon><Check size={11} strokeWidth={3} /></CheckIcon>
                            No commitment until you're ready to go live
                        </CheckItem>
                    </CheckList>
                </Left>

                <Right>
                    {submitted ? (
                        <SuccessCard>
                            <SuccessIcon>
                                <Check size={20} strokeWidth={2.5} />
                            </SuccessIcon>
                            <SuccessTitle>Message received</SuccessTitle>
                            <SuccessBody>
                                We'll review your details and reach out to{' '}
                                <strong>{form.email}</strong> within one business day.
                            </SuccessBody>
                        </SuccessCard>
                    ) : (
                        <FormCard onSubmit={handleSubmit}>
                            <FieldGroup>
                                <Label>Company name</Label>
                                <Input
                                    type="text"
                                    placeholder="Acme Fintech Ltd"
                                    value={form.company}
                                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                                    required
                                />
                            </FieldGroup>
                            <FieldGroup>
                                <Label>Work email</Label>
                                <Input
                                    type="email"
                                    placeholder="you@yourcompany.com"
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    required
                                />
                            </FieldGroup>
                            <FieldGroup>
                                <Label>Tell us about your platform <Optional>(optional)</Optional></Label>
                                <Textarea
                                    placeholder="e.g. We're a neobank with 200k users looking to offer stablecoin card payments…"
                                    value={form.message}
                                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                                    rows={3}
                                />
                            </FieldGroup>
                            {error && <ErrorMsg>{error}</ErrorMsg>}
                            <SubmitBtn type="submit" disabled={sending}>
                                {sending ? 'Sending…' : <> Send message <ArrowRight size={14} strokeWidth={2.5} /> </>}
                            </SubmitBtn>
                        </FormCard>
                    )}
                </Right>
            </Inner>
        </Section>
    );
};

// ─── Keyframes ────────────────────────────────────────────────────────────────

const orbPulse = keyframes`
    0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
    50%       { opacity: 0.7; transform: translate(-50%, -50%) scale(1.08); }
`;

// ─── Styled ───────────────────────────────────────────────────────────────────

const Section = styled.section`
    position: relative;
    background: #000000;
    padding: 100px 40px;
    border-top: 1px solid rgba(255,255,255,0.06);
    overflow: hidden;
    @media (max-width: 768px) { padding: 72px 24px; }
`;

const OrbCenter = styled.div`
    position: absolute;
    top: 50%;
    left: 30%;
    transform: translate(-50%, -50%);
    width: 60vw;
    max-width: 700px;
    aspect-ratio: 1;
    background: radial-gradient(circle, rgba(79,85,241,0.06) 0%, transparent 60%);
    border-radius: 50%;
    pointer-events: none;
    animation: ${orbPulse} 8s ease-in-out infinite;
`;

const DotGrid = styled.div`
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 32px 32px;
    pointer-events: none;
`;

const Inner = styled.div`
    position: relative;
    z-index: 1;
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 72px;
    align-items: center;
    @media (max-width: 860px) { grid-template-columns: 1fr; gap: 48px; }
`;

const Left = styled.div``;

const Kicker = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #4F55F1;
    margin: 0 0 16px;
`;

const Title = styled.h2`
    font-family: 'Saira', sans-serif;
    font-size: clamp(28px, 3vw, 44px);
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
    letter-spacing: -1.5px;
    margin: 0 0 18px;
    text-wrap: balance;
`;

const Desc = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    color: rgba(255,255,255,0.38);
    line-height: 1.7;
    margin: 0 0 28px;
`;

const CheckList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
`;

const CheckItem = styled.li`
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    color: rgba(255,255,255,0.45);
`;

const CheckIcon = styled.div`
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(79,85,241,0.1);
    border: 1px solid rgba(79,85,241,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4F55F1;
    flex-shrink: 0;
`;

const Right = styled.div``;

const FormCard = styled.form`
    background: linear-gradient(145deg, rgba(255,255,255,0.04) 0%, #08080f 100%);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 18px;
`;

const FieldGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const Label = styled.label`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.1px;
`;

const Optional = styled.span`
    color: rgba(255,255,255,0.2);
    font-weight: 400;
`;

const Input = styled.input`
    height: 44px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    padding: 0 14px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    color: #ffffff;
    outline: none;
    transition: border-color 0.15s;
    &::placeholder { color: rgba(255,255,255,0.2); }
    &:focus { border-color: rgba(79,85,241,0.35); }
`;

const Textarea = styled.textarea`
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px;
    padding: 12px 14px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    color: #ffffff;
    outline: none;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.15s;
    &::placeholder { color: rgba(255,255,255,0.2); }
    &:focus { border-color: rgba(79,85,241,0.35); }
`;

const ErrorMsg = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: #f87171;
    margin: 0;
`;

const SubmitBtn = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 48px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
    &:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,85,241,0.25); }
`;

const SuccessCard = styled.div`
    background: linear-gradient(145deg, rgba(255,255,255,0.04) 0%, #08080f 100%);
    border: 1px solid rgba(34,197,94,0.2);
    border-radius: 20px;
    padding: 40px 28px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
`;

const SuccessIcon = styled.div`
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #22c55e;
`;

const SuccessTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.5px;
    margin: 0;
`;

const SuccessBody = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 14px;
    color: #8D969E;
    line-height: 1.6;
    margin: 0;
    strong { color: rgba(255,255,255,0.65); font-weight: 600; }
`;

export default BizCTA;
