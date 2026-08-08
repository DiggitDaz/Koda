import { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { ethers } from 'ethers';
import { ArrowDown, Check, AlertCircle } from 'lucide-react';
import { arcProvider, arcSend, ARC_RPC_PROXY } from '../../lib/arcRpc.js';

const USDC_ADDRESS    = '0x3600000000000000000000000000000000000000';
const WRAPPER_ADDRESS = '0x9D845625eb0010F9a63213240Da722424C684DCf';
const TAPUSDC_ADDRESS = '0xCb96C70be34cd6484e69D1BEd5ad2F22602191e3';

const ERC20_ABI   = ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'];
const WRAPPER_ABI = ['function deposit(uint256) external'];

const ERC20_IFACE   = new ethers.Interface(ERC20_ABI);
const usdcRead      = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, arcProvider);

const readBal = async (token, addr) => {
    const data = ERC20_IFACE.encodeFunctionData('balanceOf', [addr]);
    try {
        const res = await arcSend('eth_call', [{ to: token, data }, 'latest']);
        if (!res || res === '0x') return 0n;
        return ERC20_IFACE.decodeFunctionResult('balanceOf', res)[0];
    } catch { return 0n; }
};

const fmt = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

const WidgetWrap = ({ connector, walletAddress, initialAmount, onSuccess, onError }) => {
    const [amount,       setAmount]       = useState(initialAmount || '');
    const [usdcBal,      setUsdcBal]      = useState('0');
    const [tapusdcBal,   setTapusdcBal]   = useState('0');
    const [loading,      setLoading]      = useState(false);
    const [status,       setStatus]       = useState(null);
    const [error,        setError]        = useState('');
    const [txHash,       setTxHash]       = useState('');

    useEffect(() => {
        if (!walletAddress) return;
        Promise.all([readBal(USDC_ADDRESS, walletAddress), readBal(TAPUSDC_ADDRESS, walletAddress)]).then(([u, t]) => {
            setUsdcBal(ethers.formatUnits(u, 6));
            setTapusdcBal(ethers.formatUnits(t, 6));
        });
    }, [walletAddress]);

    const handleWrap = async () => {
        if (!amount || parseFloat(amount) <= 0) { setError('Enter an amount'); return; }
        if (parseFloat(amount) > parseFloat(usdcBal)) { setError('Insufficient USDC balance'); return; }

        setLoading(true); setError(''); setStatus(null);

        try {
            try {
                await connector.provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x4CEF52', chainName: 'Arc Testnet', rpcUrls: [ARC_RPC_PROXY], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, blockExplorerUrls: [import.meta.env.VITE_EXPLORER_URL] }] });
            } catch { try { await connector.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x4CEF52' }] }); } catch {} }

            const ethProvider  = new ethers.BrowserProvider(connector.provider);
            const signer       = await ethProvider.getSigner();
            const parsed       = ethers.parseUnits(amount, 6);
            const gasPriceHex  = await arcSend('eth_gasPrice', []);
            const overrides    = { gasPrice: BigInt(gasPriceHex), gasLimit: 200000n };

            const allowance = await usdcRead.allowance(walletAddress, WRAPPER_ADDRESS);
            if (allowance < parsed) {
                setStatus('approving');
                const usdcWrite = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
                await (await usdcWrite.approve(WRAPPER_ADDRESS, parsed, overrides)).wait();
            }

            setStatus('wrapping');
            const wrapper  = new ethers.Contract(WRAPPER_ADDRESS, WRAPPER_ABI, signer);
            const receipt  = await (await wrapper.deposit(parsed, overrides)).wait();

            setTxHash(receipt.hash);
            setStatus('success');
            setAmount('');
            onSuccess?.({ wallet_address: walletAddress, tx_hash: receipt.hash, amount });
        } catch (err) {
            const msg = err.reason || err.shortMessage || err.message || 'Transaction failed';
            setError(msg);
            setStatus('error');
            onError?.(msg);
        } finally { setLoading(false); }
    };

    return (
        <Card>
            <CardTitle>Make spendable</CardTitle>

            <TokenBox>
                <TokenLabel>
                    <span>You pay</span>
                    <BalClick onClick={() => { setAmount(usdcBal); setError(''); }}>Balance: {fmt(usdcBal)}</BalClick>
                </TokenLabel>
                <TokenRow>
                    <AmountInput type="number" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} disabled={loading} />
                    <Badge>USDC</Badge>
                </TokenRow>
            </TokenBox>

            <ArrowWrap><ArrowCircle><ArrowDown size={16} /></ArrowCircle></ArrowWrap>

            <TokenBox>
                <TokenLabel>
                    <span>You receive</span>
                    <span>Balance: {fmt(tapusdcBal)}</span>
                </TokenLabel>
                <TokenRow>
                    <AmountDisplay>{amount && parseFloat(amount) > 0 ? fmt(amount) : '0.00'}</AmountDisplay>
                    <Badge $accent>TAPUSDC</Badge>
                </TokenRow>
            </TokenBox>

            <InfoRow><InfoLabel>Rate</InfoLabel><InfoVal>1 USDC = 1 TAPUSDC</InfoVal></InfoRow>
            <InfoRow><InfoLabel>Fee</InfoLabel><InfoVal>None</InfoVal></InfoRow>

            {error && <ErrorBox><AlertCircle size={14} /><span>{error}</span></ErrorBox>}

            {status === 'success' && (
                <SuccessBox>
                    <Check size={14} />
                    <span>Wrapped · <TxLink href={`${import.meta.env.VITE_EXPLORER_URL}/tx/${txHash}`} target="_blank" rel="noopener noreferrer">View tx</TxLink></span>
                </SuccessBox>
            )}

            <ActionBtn onClick={handleWrap} disabled={loading || !amount || parseFloat(amount) <= 0}>
                {status === 'approving' && <><Spin /> Approving USDC…</>}
                {status === 'wrapping'  && <><Spin /> Wrapping…</>}
                {status === 'success'   && <>Wrap again</>}
                {status === 'error'     && <>Try again</>}
                {!status               && <>Make spendable</>}
            </ActionBtn>

            <Disclaimer>USDC is locked 1:1 in the wrapper contract. Redeem any time.</Disclaimer>
        </Card>
    );
};

// ─── Styled ───────────────────────────────────────────────────────────────────

const spin   = keyframes`to { transform: rotate(360deg); }`;
const fadeIn = keyframes`from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); }`;

const Card = styled.div`
    width: 100%; max-width: 380px;
    background: #111118;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 28px;
    animation: ${fadeIn} 0.3s ease both;
`;

const CardTitle = styled.h3`
    font-family: 'Saira', sans-serif;
    font-size: 20px; font-weight: 800; color: #fff;
    letter-spacing: -0.4px; margin: 0 0 20px;
`;

const TokenBox = styled.div`
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; padding: 16px;
`;

const TokenLabel = styled.div`
    display: flex; justify-content: space-between;
    font-size: 12px; color: rgba(255,255,255,0.38);
    margin-bottom: 10px;
`;

const BalClick = styled.span`cursor: pointer; &:hover { color: #fff; }`;

const TokenRow = styled.div`display: flex; align-items: center; gap: 12px;`;

const AmountInput = styled.input`
    flex: 1; background: none; border: none; outline: none;
    font-size: 28px; font-weight: 800; color: #fff;
    &::placeholder { color: rgba(255,255,255,0.18); }
    &:disabled { opacity: 0.5; }
    &::-webkit-inner-spin-button, &::-webkit-outer-spin-button { -webkit-appearance: none; }
    -moz-appearance: textfield;
`;

const AmountDisplay = styled.span`flex:1; font-size: 28px; font-weight: 800; color: #fff;`;

const Badge = styled.span`
    font-size: 12px; font-weight: 700; color: #fff;
    background: ${p => p.$accent ? '#4F55F1' : 'rgba(255,255,255,0.1)'};
    border-radius: 8px; padding: 6px 12px; white-space: nowrap; flex-shrink: 0;
`;

const ArrowWrap = styled.div`display: flex; justify-content: center; margin: -6px 0; z-index: 1; position: relative;`;
const ArrowCircle = styled.div`
    width: 40px; height: 40px; border-radius: 50%;
    background: #111118; border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.4); display: grid; place-items: center;
`;

const InfoRow = styled.div`
    display: flex; justify-content: space-between;
    padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    &:first-of-type { margin-top: 16px; }
    &:last-of-type { border-bottom: none; }
`;
const InfoLabel = styled.span`font-size: 12px; color: rgba(255,255,255,0.35);`;
const InfoVal   = styled.span`font-size: 12px; font-weight: 700; color: #fff;`;

const ErrorBox = styled.div`
    display: flex; align-items: center; gap: 8px;
    background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2);
    border-radius: 10px; padding: 10px 14px; margin-top: 12px;
    font-size: 13px; color: #f87171;
`;

const SuccessBox = styled.div`
    display: flex; align-items: center; gap: 8px;
    background: rgba(79,85,241,0.08); border: 1px solid rgba(79,85,241,0.2);
    border-radius: 10px; padding: 10px 14px; margin-top: 12px;
    font-size: 13px; color: #818cf8;
`;

const TxLink = styled.a`color: #818cf8; text-decoration: underline;`;

const ActionBtn = styled.button`
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 14px;
    background: #4F55F1; color: #fff; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 16px;
    transition: opacity 0.15s, transform 0.15s;
    &:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const Spin = styled.div`
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff;
    border-radius: 50%; animation: ${spin} 0.7s linear infinite;
`;

const Disclaimer = styled.p`
    font-size: 11px; color: rgba(255,255,255,0.2);
    text-align: center; margin: 12px 0 0; line-height: 1.5;
`;

export default WidgetWrap;
