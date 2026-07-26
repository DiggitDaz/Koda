import { useState } from 'react';
import styled, { keyframes, createGlobalStyle } from 'styled-components';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const COUNTRIES = [
    { code: 'GB', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
    { code: 'AU', name: 'Australia' },
    { code: 'AT', name: 'Austria' },
    { code: 'BE', name: 'Belgium' },
    { code: 'CA', name: 'Canada' },
    { code: 'DK', name: 'Denmark' },
    { code: 'FI', name: 'Finland' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'IE', name: 'Ireland' },
    { code: 'IT', name: 'Italy' },
    { code: 'LU', name: 'Luxembourg' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'NO', name: 'Norway' },
    { code: 'PT', name: 'Portugal' },
    { code: 'ES', name: 'Spain' },
    { code: 'SE', name: 'Sweden' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'AE', name: 'UAE' },
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
                const existing = await axios.get('https://chainfree.site:7001/user/cards', {
                    headers: authHeader,
                });
                if (existing.data.success && existing.data.data?.length > 0) {
                    localStorage.setItem('cardId', existing.data.data[0].card_id);
                    navigate('/dashboard');
                    return;
                }
            } catch { /* no existing card */ }

            const cardholderRes = await axios.post('https://chainfree.site:7000/create-cardholder', {
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

            const cardRes = await axios.post('https://chainfree.site:7000/create-virtual-card', {
                cardholderId: cardholderRes.data.cardholder.id,
            });

            if (!cardRes.data.success) {
                setError('Failed to create virtual card.');
                return;
            }

            const cardId = cardRes.data.cardDetails.id;
            localStorage.setItem('cardId', cardId);

            await axios.post('https://chainfree.site:7001/user/link-card',
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
            <FormWrap>
                <BackBtn onClick={() => navigate('/dashboard')}>
                    <ArrowLeft size={15} />
                    Back to dashboard
                </BackBtn>

                <PageTitle>Create your Koda card</PageTitle>
                <PageSub>A virtual Visa card that spends TAPUSDC directly from your self-custody wallet.</PageSub>

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
            </FormWrap>
        </Page>
        </>
    );
};

// Animations
const fadeUp = keyframes`from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}`;
const spin   = keyframes`to{transform:rotate(360deg)}`;

// Phone input global
const PhoneGlobal = createGlobalStyle`
    .koda-phone-input {
        display: flex;
        align-items: center;
    }
    .koda-phone-input .PhoneInputCountry {
        display: flex;
        align-items: center;
        padding: 0 10px 0 14px;
        background: rgba(255,255,255,0.06);
        border: 1.5px solid rgba(255,255,255,0.08);
        border-right: none;
        border-radius: 9px 0 0 9px;
        height: 42px;
        flex-shrink: 0;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
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
        border-color: #8D969E;
        opacity: 1;
        width: 5px;
        height: 5px;
    }
    .koda-phone-input .PhoneInputInput {
        flex: 1;
        padding: 11px 14px;
        background: rgba(255,255,255,0.06);
        border: 1.5px solid rgba(255,255,255,0.08);
        border-left: none;
        border-radius: 0 9px 9px 0;
        font-family: 'Google Sans Flex', 'Sora', sans-serif;
        font-size: 13px;
        color: #ffffff;
        outline: none;
        transition: border-color 0.15s, background 0.15s;
    }
    .koda-phone-input .PhoneInputInput::placeholder {
        color: #8D969E50;
    }
    .koda-phone-input .PhoneInputInput:focus {
        border-color: rgba(79,85,241,0.5);
        background: rgba(255,255,255,0.09);
    }
    .koda-phone-input:focus-within .PhoneInputCountry {
        border-color: rgba(79,85,241,0.5);
        background: rgba(255,255,255,0.09);
    }
    .koda-phone-input--invalid .PhoneInputCountry,
    .koda-phone-input--invalid .PhoneInputInput {
        border-color: rgba(180,35,24,0.4);
        background: rgba(180,35,24,0.08);
    }
`;

// Styled components

const Page = styled.div`
    min-height: 100%;
    background: #000000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 24px 60px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    animation: ${fadeUp} 0.35s ease both;
`;

const FormWrap = styled.div`
    width: 100%;
    max-width: 580px;
    background: #121212;
    border-radius: 20px;
    padding: 32px 28px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.4);
`;

const BackBtn = styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #8D969E;
    cursor: pointer;
    padding: 0;
    margin-bottom: 24px;
    transition: color 0.15s;
    &:hover { color: #ffffff; }
`;

const PageTitle = styled.h1`
    font-family: 'Saira', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 6px;
`;

const PageSub = styled.p`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: #8D969E;
    line-height: 1.6;
    margin: 0 0 24px;
`;

const ErrorBanner = styled.div`
    background: rgba(180,35,24,0.12);
    border: 1px solid rgba(180,35,24,0.3);
    border-radius: 10px;
    padding: 12px 16px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    color: #ff8a80;
    font-weight: 500;
    margin-bottom: 20px;
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const Section = styled.div`
    background: rgba(255,255,255,0.1);
    border: 1.5px solid rgba(9,0,34,0.06);
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

const SectionLabel = styled.p`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    color: #8D969E;
    margin: 0;
`;

const FieldRow = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;

    @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const Label = styled.label`
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 12px;
    font-weight: 500;
    color: #8D969E;
`;

const Input = styled.input`
    padding: 11px 14px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 9px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    color: #ffffff;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
    box-sizing: border-box;
    width: 100%;

    &::placeholder { color: #8D969E50; }
    &:focus {
        border-color: rgba(79,85,241,0.5);
        background: rgba(255,255,255,0.09);
    }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
    color-scheme: dark;
`;

const Select = styled.select`
    padding: 11px 14px;
    background: rgba(255,255,255,0.06);
    border: 1.5px solid rgba(255,255,255,0.08);
    border-radius: 9px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 13px;
    color: ${p => p.$empty ? '#8D969E' : '#ffffff'};
    outline: none;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.3)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-color: rgba(255,255,255,0.06);
    padding-right: 36px;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
    color-scheme: dark;

    &:focus {
        border-color: rgba(79,85,241,0.5);
        background-color: rgba(255,255,255,0.09);
    }
    &:disabled { opacity: 0.4; cursor: not-allowed; }

    option { background: #121212; color: #ffffff; }
`;

const SubmitBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 14px;
    background: #4F55F1;
    color: #fff;
    border: none;
    border-radius: 12px;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 4px;
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;

    &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,85,241,0.3); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SkipBtn = styled.button`
    background: none;
    border: none;
    font-family: 'Google Sans Flex', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: #8D969E;
    cursor: pointer;
    text-align: center;
    padding: 0;
    transition: color 0.15s;
    &:hover { color: #ffffff; }
`;

const Spinner = styled.div`
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
`;

const PhoneInputWrapper = styled.div`
    .koda-phone-input .PhoneInputCountry,
    .koda-phone-input .PhoneInputInput {
        border-color: ${p => p.$invalid ? 'rgba(180,35,24,0.4)' : 'rgba(255,255,255,0.08)'};
        background: ${p => p.$invalid ? 'rgba(180,35,24,0.08)' : 'rgba(255,255,255,0.06)'};
    }
`;

const ValidationHint = styled.span`
    margin-left: 8px;
    font-size: 11px;
    font-weight: 500;
    color: #ff8a80;
`;

export default CreateCardPage;
