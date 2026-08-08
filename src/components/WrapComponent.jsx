import { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { ArrowDown, Check, AlertCircle, X } from "lucide-react";
import { ethers } from "ethers";
import { arcSend, ARC_RPC_PROXY } from "../lib/arcRpc.js";

const PAIRS = {
    USD: {
        stablecoin:  '0x3600000000000000000000000000000000000000',
        wrapper:     '0x9D845625eb0010F9a63213240Da722424C684DCf',
        taptoken:    '0xCb96C70be34cd6484e69D1BEd5ad2F22602191e3',
        stableLabel: 'USDC',
        tapLabel:    'TAPUSDC',
        rate:        '1 USDC = 1 TAPUSDC',
    },
    EUR: {
        stablecoin:  '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
        wrapper:     '0x72d038055795631c057a3DA26c37EACa92Cb9AdB',
        taptoken:    '0x36247A653A1253A96a286f5E296c06fF958b1ac0',
        stableLabel: 'EURC',
        tapLabel:    'TAPEURC',
        rate:        '1 EURC = 1 TAPEURC',
    },
};

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
];
const WRAPPER_ABI = ['function deposit(uint256 amount) external'];
const ERC20_IFACE = new ethers.Interface(ERC20_ABI);

async function readBalance(tokenAddress, walletAddress) {
    const data = ERC20_IFACE.encodeFunctionData('balanceOf', [walletAddress]);
    try {
        const result = await arcSend('eth_call', [{ to: tokenAddress, data }, 'latest']);
        if (!result || result === '0x') return 0n;
        return ERC20_IFACE.decodeFunctionResult('balanceOf', result)[0];
    } catch { return 0n; }
}

async function readAllowance(tokenAddress, owner, spender) {
    const data = ERC20_IFACE.encodeFunctionData('allowance', [owner, spender]);
    try {
        const result = await arcSend('eth_call', [{ to: tokenAddress, data }, 'latest']);
        if (!result || result === '0x') return 0n;
        return ERC20_IFACE.decodeFunctionResult('allowance', result)[0];
    } catch { return 0n; }
}

const WrapComponent = ({ connector, walletAddress, onClose, onSuccess }) => {
    const initPair = localStorage.getItem('kodaCurrency') === 'TAPEURC' ? 'EUR' : 'USD';

    const [pair,          setPair]          = useState(initPair);
    const [amount,        setAmount]        = useState('');
    const [stableBalance, setStableBalance] = useState('0');
    const [tapBalance,    setTapBalance]    = useState('0');
    const [loading,       setLoading]       = useState(false);
    const [status,        setStatus]        = useState(null);
    const [error,         setError]         = useState('');
    const [txHash,        setTxHash]        = useState('');

    const cfg = PAIRS[pair];

    useEffect(() => {
        if (!walletAddress) return;
        setStableBalance('0');
        setTapBalance('0');
        (async () => {
            const [sBal, tBal] = await Promise.all([
                readBalance(cfg.stablecoin, walletAddress),
                readBalance(cfg.taptoken,   walletAddress),
            ]);
            setStableBalance(ethers.formatUnits(sBal, 6));
            setTapBalance(ethers.formatUnits(tBal, 6));
        })();
    }, [walletAddress, pair]);

    const switchPair = (p) => {
        setPair(p);
        setAmount('');
        setStatus(null);
        setError('');
        setTxHash('');
    };

    const handleMax = () => { setAmount(stableBalance); setError(''); };

    const formatDisplay = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return '0.00';
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    };

    const handleWrap = async () => {
        if (!amount || parseFloat(amount) <= 0) { setError('Enter an amount'); return; }
        if (parseFloat(amount) > parseFloat(stableBalance)) {
            setError(`Insufficient ${cfg.stableLabel} balance`);
            return;
        }

        setLoading(true);
        setError('');
        setStatus(null);

        try {
            const provider     = new ethers.BrowserProvider(connector.provider);
            const signer       = await provider.getSigner();
            const parsedAmount = ethers.parseUnits(amount, 6);

            try {
                await connector.provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x4CEF52',
                        chainName: 'Arc Testnet',
                        rpcUrls: [ARC_RPC_PROXY],
                        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
                        blockExplorerUrls: [import.meta.env.VITE_EXPLORER_URL],
                    }],
                });
            } catch {
                try {
                    await connector.provider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x4CEF52' }],
                    });
                } catch { /* already on chain */ }
            }

            const gasPriceHex = await arcSend('eth_gasPrice', []);
            const txOverrides  = { gasPrice: BigInt(gasPriceHex), gasLimit: 200000n };

            const currentAllowance = await readAllowance(cfg.stablecoin, walletAddress, cfg.wrapper);
            if (currentAllowance < parsedAmount) {
                setStatus('approving');
                const stableWrite = new ethers.Contract(cfg.stablecoin, ERC20_ABI, signer);
                const approveTx   = await stableWrite.approve(cfg.wrapper, parsedAmount, txOverrides);
                await approveTx.wait();
            }

            setStatus('wrapping');
            const wrapper   = new ethers.Contract(cfg.wrapper, WRAPPER_ABI, signer);
            const depositTx = await wrapper.deposit(parsedAmount, txOverrides);
            const receipt   = await depositTx.wait();

            setTxHash(receipt.hash);
            setStatus('success');
            setAmount('');
            if (onSuccess) onSuccess();
        } catch (err) {
            setError(err.reason || err.shortMessage || err.message || 'Transaction failed');
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Overlay>
            <Card>
                <CardHeader>
                    <CardTitle>Wrap</CardTitle>
                    {onClose && <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>}
                </CardHeader>

                <PairToggle>
                    <PairOpt $active={pair === 'USD'} onClick={() => switchPair('USD')} disabled={loading}>
                        USDC
                    </PairOpt>
                    <PairOpt $active={pair === 'EUR'} onClick={() => switchPair('EUR')} disabled={loading}>
                        EURC
                    </PairOpt>
                </PairToggle>

                <TokenBox>
                    <TokenLabel>
                        <span>You pay</span>
                        <BalanceText onClick={handleMax}>
                            Balance: {formatDisplay(stableBalance)}
                        </BalanceText>
                    </TokenLabel>
                    <TokenRow>
                        <AmountInput
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => { setAmount(e.target.value); setError(''); }}
                            disabled={loading}
                        />
                        <TokenBadge>{cfg.stableLabel}</TokenBadge>
                    </TokenRow>
                </TokenBox>

                <ArrowWrap>
                    <ArrowCircle><ArrowDown size={16} /></ArrowCircle>
                </ArrowWrap>

                <TokenBox>
                    <TokenLabel>
                        <span>You receive</span>
                        <BalanceText>Balance: {formatDisplay(tapBalance)}</BalanceText>
                    </TokenLabel>
                    <TokenRow>
                        <AmountDisplay>
                            {amount && parseFloat(amount) > 0 ? formatDisplay(amount) : '0.00'}
                        </AmountDisplay>
                        <TokenBadge $accent>{cfg.tapLabel}</TokenBadge>
                    </TokenRow>
                </TokenBox>

                <InfoRow>
                    <InfoLabel>Rate</InfoLabel>
                    <InfoValue>{cfg.rate}</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>Fee</InfoLabel>
                    <InfoValue>None</InfoValue>
                </InfoRow>
                <InfoRow>
                    <InfoLabel>Network</InfoLabel>
                    <InfoValue>Arc Testnet</InfoValue>
                </InfoRow>

                {error && (
                    <ErrorBox><AlertCircle size={14} /><span>{error}</span></ErrorBox>
                )}

                {status === 'success' && (
                    <SuccessBox>
                        <Check size={14} />
                        <span>
                            Wrapped successfully
                            {txHash && (
                                <TxLink
                                    href={`${import.meta.env.VITE_EXPLORER_URL}/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {' '}View tx
                                </TxLink>
                            )}
                        </span>
                    </SuccessBox>
                )}

                <WrapBtn onClick={handleWrap} disabled={loading || !amount || parseFloat(amount) <= 0}>
                    {status === 'approving' && <><Spinner /> Approving {cfg.stableLabel}…</>}
                    {status === 'wrapping'  && <><Spinner /> Wrapping…</>}
                    {status === 'success'   && <>Wrap again</>}
                    {status === 'error'     && <>Try again</>}
                    {!status               && <>Wrap {cfg.stableLabel}</>}
                </WrapBtn>

                <Disclaimer>
                    {cfg.stableLabel} is locked 1:1 in the wrapper contract. You can unwrap at any time.
                </Disclaimer>
            </Card>
        </Overlay>
    );
};

// Animations

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
`;
const spin = keyframes`to { transform: rotate(360deg); }`;

// Layout

const Overlay = styled.div`
    position: fixed;
    inset: 0;
    background: #00000040;
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 200px 20px 20px;
    z-index: 50;

    @media (max-width: 768px) {
        align-items: flex-start;
        padding: 16px;
        overflow-y: auto;
    }
`;

const Card = styled.div`
    width: 100%;
    max-width: 400px;
    background: linear-gradient(45deg, #000000ff 20%, #121212);
    border-radius: 20px;
    padding: 28px;
    box-shadow: 0 8px 40px rgba(9, 0, 34, 0.15);
    animation: ${fadeIn} 0.3s ease;
    font-family: 'Sora', sans-serif;
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
`;

const CardTitle = styled.h3`
    font-family: 'Saira', 'Sora', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #fff;
    margin: 0;
`;

const CloseBtn = styled.button`
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #8D969E30;
    border: none;
    color: #8D969E;
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: opacity 0.15s;
    &:hover { opacity: 0.7; }
`;

// Pair toggle

const PairToggle = styled.div`
    display: flex;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 3px;
    gap: 3px;
    margin-bottom: 16px;
`;

const PairOpt = styled.button`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.2px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    background: ${p => p.$active ? 'rgba(255,255,255,0.1)' : 'transparent'};
    color: ${p => p.$active ? '#ffffff' : 'rgba(255,255,255,0.35)'};
    &:hover:not(:disabled) { color: ${p => p.$active ? '#ffffff' : 'rgba(255,255,255,0.65)'}; }
    &:disabled { cursor: default; }
`;

const PairDot = styled.span`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: ${p => p.$active ? '#4F55F1' : 'rgba(255,255,255,0.15)'};
    transition: background 0.15s;
`;

// Token boxes

const TokenBox = styled.div`
    background: rgba(255, 255, 255, 0.05);
    border: 1.5px solid rgba(9, 0, 34, 0.06);
    border-radius: 14px;
    padding: 16px;
`;

const TokenLabel = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 12px;
    color: #8D969E;
    font-family: 'Google Sans Flex', sans-serif;
    font-weight: 500;
`;

const BalanceText = styled.span`
    cursor: pointer;
    transition: color 0.2s ease;
    color: #8D969E;
    &:hover { color: #fff; }
`;

const TokenRow = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const AmountInput = styled.input`
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-family: 'Google Sans', 'Sora', sans-serif;
    font-size: 28px;
    font-weight: 800;
    color: #fff;
    min-width: 0;
    &::placeholder { color: #8D969E50; }
    &:disabled { opacity: 0.5; }
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    -moz-appearance: textfield;
`;

const AmountDisplay = styled.span`
    flex: 1;
    font-family: 'Google Sans', 'Sora', sans-serif;
    font-size: 28px;
    font-weight: 800;
    color: #fff;
`;

const TokenBadge = styled.span`
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    background: #4F55F1;
    border-radius: 8px;
    padding: 6px 12px;
    white-space: nowrap;
    flex-shrink: 0;
`;

const ArrowWrap = styled.div`
    display: flex;
    justify-content: center;
    margin: -6px 0;
    position: relative;
    z-index: 1;
`;

const ArrowCircle = styled.div`
    width: 50px;
    height: 50px;
    border-radius: 25px;
    background: #121212;
    color: #fff;
    display: grid;
    place-items: center;
`;

// Info rows

const InfoRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid rgba(9, 0, 34, 0.04);
    &:first-of-type { margin-top: 16px; }
    &:last-of-type { border-bottom: none; }
`;

const InfoLabel = styled.span`
    font-size: 12px;
    color: #8D969E;
`;

const InfoValue = styled.span`
    font-size: 12px;
    font-weight: 800;
    color: #fff;
`;

// Feedback

const ErrorBox = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    background: #FDECEA;
    border-radius: 10px;
    padding: 10px 14px;
    margin-top: 12px;
    font-size: 13px;
    color: #B42318;
    font-weight: 500;
`;

const SuccessBox = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    background: #E7F6EF;
    border-radius: 10px;
    padding: 10px 14px;
    margin-top: 12px;
    font-size: 13px;
    color: #12925F;
    font-weight: 500;
`;

const TxLink = styled.a`
    color: #8D969E;
    font-weight: 600;
    text-decoration: none;
    &:hover { text-decoration: underline; }
`;

const WrapBtn = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    background: #4F55F1;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    font-family: 'Sora', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    margin-top: 16px;
    transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    &:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(9, 0, 34, 0.15); }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Spinner = styled.div`
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
`;

const Disclaimer = styled.p`
    font-size: 11px;
    color: #8D969E80;
    text-align: center;
    margin: 12px 0 0;
    line-height: 1.5;
`;

export default WrapComponent;
