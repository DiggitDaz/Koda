import { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { ArrowDown, Check, AlertCircle, X } from "lucide-react";
import { ethers } from "ethers";
import { arcProvider, arcSend, ARC_RPC_PROXY } from "../lib/arcRpc.js";

const USDC_ADDRESS   = "0x3600000000000000000000000000000000000000";
const WRAPPER_ADDRESS = "0xee6E98d6Da6B5FaeD46FEBD5b920cdB7e1896564";
const TAPUSDC_ADDRESS = "0x69053637FF706bD2691ABCEbc9D36E61445343Cf";

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
];

const WRAPPER_ABI = [
    "function deposit(uint256 amount) external",
];

const ERC20_IFACE = new ethers.Interface(ERC20_ABI);

async function readBalance(tokenAddress, walletAddress) {
    const data = ERC20_IFACE.encodeFunctionData('balanceOf', [walletAddress]);
    try {
        const result = await arcSend('eth_call', [{ to: tokenAddress, data }, 'latest']);
        if (!result || result === '0x') return 0n;
        return ERC20_IFACE.decodeFunctionResult('balanceOf', result)[0];
    } catch { return 0n; }
}

const usdcRead    = new ethers.Contract(USDC_ADDRESS,    ERC20_ABI, arcProvider);
const tapusdcRead = new ethers.Contract(TAPUSDC_ADDRESS, ERC20_ABI, arcProvider);

const WrapComponent = ({ connector, walletAddress, onClose, onSuccess }) => {
    const [amount, setAmount] = useState("");
    const [usdcBalance, setUsdcBalance] = useState("0");
    const [tapusdcBalance, setTapusdcBalance] = useState("0");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState("");
    const [txHash, setTxHash] = useState("");

    useEffect(() => {
        if (!walletAddress) return;
        const fetchBalances = async () => {
            const [usdcBal, tapusdcBal] = await Promise.all([
                readBalance(USDC_ADDRESS,    walletAddress),
                readBalance(TAPUSDC_ADDRESS, walletAddress),
            ]);
            setUsdcBalance(ethers.formatUnits(usdcBal, 6));
            setTapusdcBalance(ethers.formatUnits(tapusdcBal, 6));
        };
        fetchBalances();
    }, [walletAddress]);

    const handleMax = () => {
        setAmount(usdcBalance);
        setError("");
    };

    const formatDisplay = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return "0.00";
        return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    };

    const handleWrap = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            setError("Enter an amount");
            return;
        }
        if (parseFloat(amount) > parseFloat(usdcBalance)) {
            setError("Insufficient USDC balance");
            return;
        }

        setLoading(true);
        setError("");
        setStatus(null);

        try {
            const provider = new ethers.BrowserProvider(connector.provider);
            const signer = await provider.getSigner();
            const parsedAmount = ethers.parseUnits(amount, 6);
            try {
                // Register our RPC proxy as MetaMask's chain RPC so MetaMask's
                // internal eth_gasPrice calls go through our proxy (which fans out
                // across all 3 Arc RPCs) instead of hitting rate limits directly.
                await connector.provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x4CEF52',
                        chainName: 'Arc Testnet',
                        rpcUrls: [ARC_RPC_PROXY],
                        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
                        blockExplorerUrls: ['https://testnet.arcscan.app'],
                    }],
                });
            } catch {
                // Chain exists and MetaMask didn't update — just switch to it.
                try {
                    await connector.provider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x4CEF52' }],
                    });
                } catch { /* already on chain or user rejected */ }
            }

            const gasPriceHex = await arcSend('eth_gasPrice', []);
            const txOverrides = { gasPrice: BigInt(gasPriceHex), gasLimit: 200000n };

            const currentAllowance = await usdcRead.allowance(walletAddress, WRAPPER_ADDRESS);
            if (currentAllowance < parsedAmount) {
                setStatus("approving");
                const usdcWrite = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
                const approveTx = await usdcWrite.approve(WRAPPER_ADDRESS, parsedAmount, txOverrides);
                await approveTx.wait();
            }

            setStatus("wrapping");
            const wrapper = new ethers.Contract(WRAPPER_ADDRESS, WRAPPER_ABI, signer);
            const depositTx = await wrapper.deposit(parsedAmount, txOverrides);
            const receipt = await depositTx.wait();

            setTxHash(receipt.hash);
            setStatus("success");
            setAmount("");

            if (onSuccess) onSuccess();
        } catch (err) {
            setError(err.reason || err.shortMessage || err.message || "Transaction failed");
            setStatus("error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Overlay>
            <Card>
                <CardHeader>
                    <CardTitle>Wrap USDC</CardTitle>
                    {onClose && (
                        <CloseBtn onClick={onClose}>
                            <X size={18} />
                        </CloseBtn>
                    )}
                </CardHeader>

                <TokenBox>
                    <TokenLabel>
                        <span>You pay</span>
                        <BalanceText onClick={handleMax}>
                            Balance: {formatDisplay(usdcBalance)}
                        </BalanceText>
                    </TokenLabel>
                    <TokenRow>
                        <AmountInput
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => { setAmount(e.target.value); setError(""); }}
                            disabled={loading}
                        />
                        <TokenBadge>USDC</TokenBadge>
                    </TokenRow>
                </TokenBox>

                <ArrowWrap>
                    <ArrowCircle>
                        <ArrowDown size={16} />
                    </ArrowCircle>
                </ArrowWrap>

                <TokenBox>
                    <TokenLabel>
                        <span>You receive</span>
                        <BalanceText>
                            Balance: {formatDisplay(tapusdcBalance)}
                        </BalanceText>
                    </TokenLabel>
                    <TokenRow>
                        <AmountDisplay>
                            {amount && parseFloat(amount) > 0 ? formatDisplay(amount) : "0.00"}
                        </AmountDisplay>
                        <TokenBadge $accent>TAPUSDC</TokenBadge>
                    </TokenRow>
                </TokenBox>

                <InfoRow>
                    <InfoLabel>Rate</InfoLabel>
                    <InfoValue>1 USDC = 1 TAPUSDC</InfoValue>
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
                    <ErrorBox>
                        <AlertCircle size={14} />
                        <span>{error}</span>
                    </ErrorBox>
                )}

                {status === "success" && (
                    <SuccessBox>
                        <Check size={14} />
                        <span>
                            Wrapped successfully
                            {txHash && (
                                <TxLink
                                    href={`https://testnet.arcscan.app/tx/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {" "}View tx
                                </TxLink>
                            )}
                        </span>
                    </SuccessBox>
                )}

                <WrapBtn onClick={handleWrap} disabled={loading || !amount || parseFloat(amount) <= 0}>
                    {status === "approving" && <><Spinner /> Approving USDC...</>}
                    {status === "wrapping" && <><Spinner /> Wrapping...</>}
                    {status === "success" && <>Wrap again</>}
                    {status === "error" && <>Try again</>}
                    {!status && <>Wrap USDC</>}
                </WrapBtn>

                <Disclaimer>
                    USDC is locked 1:1 in the wrapper contract. You can unwrap at any time.
                </Disclaimer>
            </Card>
        </Overlay>
    );
};

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
`;
const spin = keyframes`to { transform: rotate(360deg); }`;

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
    margin-bottom: 20px;
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
    transition: border-color 0.2s ease, color 0.2s ease;
    &:hover { border-color: rgba(9, 0, 34, 0.25); color: #090022; }
`;

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
    font-family: Google Sans Flex, Sans serif;
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
    &::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
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
    color: ${p => p.$accent ? '#fff' : '#fff'};
    background: ${p => p.$accent ? '#4F55F1' : '#4F55F1'};
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

    &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(9, 0, 34, 0.15);
    }
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
    color: #0f0f1180;
    text-align: center;
    margin: 12px 0 0;
    line-height: 1.5;
`;

export default WrapComponent;