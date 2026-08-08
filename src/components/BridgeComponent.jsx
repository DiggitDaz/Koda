import { useState, useEffect, useRef } from "react";
import styled, { keyframes } from "styled-components";
import { ArrowDown, Check, AlertCircle, X } from "lucide-react";
import { ethers } from "ethers";
import { setSuppressChainReload } from "../context/WalletContext.jsx";
import { arcProvider, arcSend, ARC_RPC_PROXY } from "../lib/arcRpc.js";

// Chain / contract constants

const BASE_CHAIN_ID  = '0x14a34';       // 84532 decimal — Base Sepolia
const ARC_CHAIN_ID   = '0x4CEF52';      // 5042002 decimal — Arc Testnet

const BASE_RPC = 'https://sepolia.base.org';

// Same address on every CCTP V2 chain
const TOKEN_MESSENGER_V2   = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const MESSAGE_TRANSMITTER_V2 = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';

const BASE_USDC    = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // USDC on Base Sepolia
const ARC_USDC     = '0x3600000000000000000000000000000000000000'; // USDC on Arc Testnet
const WRAPPER_ADDR  = '0x9D845625eb0010F9a63213240Da722424C684DCf'; // TAPUSDC wrapper on Arc
const ARC_TAPUSDC  = '0xCb96C70be34cd6484e69D1BEd5ad2F22602191e3';  // TAPUSDC token on Arc

const ARC_DOMAIN  = 26;
const BASE_DOMAIN = 6;

const ATTESTATION_POLL_MS  = 10_000;
const ATTESTATION_TIMEOUT  = 600; // seconds

// ABIs

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
];

const TOKEN_MESSENGER_ABI = [
    'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) returns (uint64 nonce)',
];

const MESSAGE_TRANSMITTER_ABI = [
    'function receiveMessage(bytes calldata message, bytes calldata attestation) returns (bool success)',
];

const WRAPPER_ABI = ['function deposit(uint256 amount) external'];


// Step definitions

const buildSteps = (wrap) => [
    { key: 'approving', label: 'Approve USDC on Base'   },
    { key: 'burning',   label: 'Burn via CCTP'           },
    { key: 'attesting', label: 'Circle attestation'      },
    { key: 'minting',   label: 'Mint on Arc'             },
    ...(wrap ? [{ key: 'wrapping', label: 'Wrap to TAPUSDC' }] : []),
];

const STEP_ORDER = ['approving', 'burning', 'attesting', 'minting', 'wrapping'];

// Component

const BridgeComponent = ({ connector, walletAddress, onClose, onSuccess }) => {
    const [amount,          setAmount]          = useState('');
    const [baseBalance,     setBaseBalance]     = useState('0');
    const [arcUsdcBal,      setArcUsdcBal]      = useState('0');
    const [arcTapusdcBal,   setArcTapusdcBal]   = useState('0');
    const [autoWrap,        setAutoWrap]        = useState(false);
    const [status,          setStatus]          = useState('idle');
    const [error,           setError]           = useState('');
    const [burnTxHash,      setBurnTxHash]      = useState('');
    const [mintTxHash,      setMintTxHash]      = useState('');
    const [attestElapsed,   setAttestElapsed]   = useState(0);
    const [loading,         setLoading]         = useState(false);

    const elapsedRef = useRef(0);

    // Balances
    useEffect(() => {
        if (!walletAddress) return;
        const fetch = async () => {
            // Fetch independently so an Arc failure can't block the Base balance
            try {
                const baseUsdc = new ethers.Contract(BASE_USDC, ERC20_ABI, new ethers.JsonRpcProvider(BASE_RPC));
                const b = await baseUsdc.balanceOf(walletAddress);
                setBaseBalance(ethers.formatUnits(b, 6));
            } catch (err) {
                console.error('Base balance fetch error:', err);
            }
            try {
                const arcUsdc    = new ethers.Contract(ARC_USDC,    ERC20_ABI, arcProvider);
                const arcTapusdc = new ethers.Contract(ARC_TAPUSDC, ERC20_ABI, arcProvider);
                const [u, t] = await Promise.all([
                    arcUsdc.balanceOf(walletAddress),
                    arcTapusdc.balanceOf(walletAddress),
                ]);
                setArcUsdcBal(ethers.formatUnits(u, 6));
                setArcTapusdcBal(ethers.formatUnits(t, 6));
            } catch (err) {
                console.error('Arc balance fetch error:', err);
            }
        };
        fetch();
    }, [walletAddress, status]);

    // Helpers
    const fmt = (v) => {
        const n = parseFloat(v);
        if (isNaN(n)) return '0.00';
        return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    };

    const switchToBase = async () => {
        try {
            await connector.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_CHAIN_ID }],
            });
        } catch (err) {
            if (err.code === 4902) {
                await connector.provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BASE_CHAIN_ID,
                        chainName: 'Base Sepolia',
                        rpcUrls: [BASE_RPC],
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        blockExplorerUrls: ['https://sepolia.basescan.org'],
                    }],
                });
            } else throw err;
        }
    };

    const switchToArc = async () => {
        try {
            await connector.provider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: ARC_CHAIN_ID,
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
                    params: [{ chainId: ARC_CHAIN_ID }],
                });
            } catch { /* already on chain or user rejected */ }
        }
    };

    // Polls the CCTP V2 messages API using the burn tx hash.
    // Returns { attestation, messageBytes } when complete.
    const pollAttestation = async (burnTxHash) => {
        const url = `${import.meta.env.VITE_CCTP_API_URL}/v2/messages/${BASE_DOMAIN}?transactionHash=${burnTxHash}`;
        elapsedRef.current = 0;
        setAttestElapsed(0);

        const interval = setInterval(() => {
            elapsedRef.current += 1;
            setAttestElapsed(elapsedRef.current);
        }, 1000);

        try {
            while (true) {
                await new Promise(r => setTimeout(r, ATTESTATION_POLL_MS));
                if (elapsedRef.current >= ATTESTATION_TIMEOUT) {
                    throw new Error('Attestation timed out — try again later');
                }
                try {
                    const res = await fetch(url);
                    if (!res.ok) continue;
                    const data = await res.json();
                    const msg = data.messages?.[0];
                    if (msg?.status === 'complete' && msg.attestation) {
                        return { attestation: msg.attestation, messageBytes: msg.message };
                    }
                } catch {}
            }
        } finally {
            clearInterval(interval);
        }
    };

    // Main bridge handler
    const handleBridge = async () => {
        if (!amount || parseFloat(amount) <= 0) { setError('Enter an amount'); return; }
        if (parseFloat(amount) > parseFloat(baseBalance)) { setError('Insufficient USDC on Base Sepolia'); return; }

        setLoading(true);
        setError('');
        setBurnTxHash('');
        setMintTxHash('');
        setSuppressChainReload(true);

        try {
            const parsedAmount = ethers.parseUnits(amount, 6);

            /* 1 ─ Switch to Base Sepolia */
            await switchToBase();
            const baseProvider = new ethers.BrowserProvider(connector.provider);
            const baseSigner   = await baseProvider.getSigner();

            // Confirm the wallet actually switched — Arc and Base share the same
            // TokenMessengerV2 address but only Base has Base USDC registered
            const { chainId } = await baseProvider.getNetwork();
            if (chainId !== 84532n) throw new Error('Wallet did not switch to Base Sepolia — please try again');

            /* 2 ─ Approve TokenMessengerV2 on Base */
            setStatus('approving');
            const baseUsdcRead = new ethers.Contract(BASE_USDC, ERC20_ABI, new ethers.JsonRpcProvider(BASE_RPC));

            // Re-check live balance — a previous burn may have already consumed it
            const liveBal = await baseUsdcRead.balanceOf(walletAddress);
            if (liveBal < parsedAmount) throw new Error(
                `Insufficient USDC on Base Sepolia — have ${ethers.formatUnits(liveBal, 6)}, need ${amount}`
            );

            const currentAllowance = await baseUsdcRead.allowance(walletAddress, TOKEN_MESSENGER_V2);
            if (currentAllowance < parsedAmount) {
                const baseUsdc = new ethers.Contract(BASE_USDC, ERC20_ABI, baseSigner);
                const approveTx = await baseUsdc.approve(TOKEN_MESSENGER_V2, parsedAmount);
                await approveTx.wait();
            }

            /* 3 ─ DepositForBurn on Base */
            setStatus('burning');
            const mintRecipient     = ethers.zeroPadValue(walletAddress, 32);
            const destinationCaller = ethers.ZeroHash; // permissionless relay
            const tokenMessenger    = new ethers.Contract(TOKEN_MESSENGER_V2, TOKEN_MESSENGER_ABI, baseSigner);
            const burnTx = await tokenMessenger.depositForBurn(
                parsedAmount,
                ARC_DOMAIN,
                mintRecipient,
                BASE_USDC,
                destinationCaller,
                20001n,  // maxFee — matches observed live txs on Base Sepolia
                1000,    // minFinalityThreshold — standard for Base Sepolia
            );
            const burnReceipt = await burnTx.wait();
            setBurnTxHash(burnReceipt.hash);

            /* 4 ─ Poll Circle messages API for attestation */
            setStatus('attesting');
            const { attestation, messageBytes } = await pollAttestation(burnReceipt.hash);

            /* 5 ─ Switch to Arc and mint */
            setStatus('minting');
            await switchToArc();
            const arcBrowserProvider = new ethers.BrowserProvider(connector.provider);
            const arcSigner          = await arcBrowserProvider.getSigner();

            const arcGasPriceHex = await arcSend('eth_gasPrice', []);
            const arcOverrides   = { gasPrice: BigInt(arcGasPriceHex), gasLimit: 300000n };

            const msgTransmitter = new ethers.Contract(MESSAGE_TRANSMITTER_V2, MESSAGE_TRANSMITTER_ABI, arcSigner);
            const mintTx = await msgTransmitter.receiveMessage(messageBytes, attestation, arcOverrides);
            const mintReceipt = await mintTx.wait();
            setMintTxHash(mintReceipt.hash);

            /* 7 ─ Auto-wrap to TAPUSDC (if selected) */
            if (autoWrap) {
                setStatus('wrapping');
                const arcUsdcContract = new ethers.Contract(ARC_USDC, ERC20_ABI, arcSigner);
                const wrapAllowance = await arcUsdcContract.allowance(walletAddress, WRAPPER_ADDR);
                if (wrapAllowance < parsedAmount) {
                    const approveTx = await arcUsdcContract.approve(WRAPPER_ADDR, parsedAmount, arcOverrides);
                    await approveTx.wait();
                }
                const wrapper = new ethers.Contract(WRAPPER_ADDR, WRAPPER_ABI, arcSigner);
                const wrapTx = await wrapper.deposit(parsedAmount, arcOverrides);
                await wrapTx.wait();
            }

            setStatus('success');
            setAmount('');
            if (onSuccess) onSuccess();

        } catch (err) {
            console.error('Bridge error:', err);
            setError(err.reason || err.shortMessage || err.message || 'Transaction failed');
            setStatus('error');
        } finally {
            setSuppressChainReload(false);
            setLoading(false);
        }
    };

    // Derived UI state
    const steps       = buildSteps(autoWrap);
    const currentIdx  = STEP_ORDER.indexOf(status);
    const isActive    = loading || status === 'attesting';
    const isSuccess   = status === 'success';
    const isError     = status === 'error';
    const canSubmit   = !loading && !!amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(baseBalance);

    const btnLabel = () => {
        if (status === 'approving')  return 'Approving…';
        if (status === 'burning')    return 'Burning on Base…';
        if (status === 'attesting')  return `Attesting (${attestElapsed}s)…`;
        if (status === 'minting')    return 'Minting on Arc…';
        if (status === 'wrapping')   return 'Wrapping to TAPUSDC…';
        if (isSuccess)               return 'Bridge again';
        if (isError)                 return 'Try again';
        return autoWrap ? 'Bridge and wrap' : 'Bridge USDC';
    };

    const destBalance = autoWrap ? arcTapusdcBal : arcUsdcBal;
    const destToken   = autoWrap ? 'TAPUSDC' : 'USDC';

    return (
        <Overlay>
            <Card>
                <CardHeader>
                    <CardTitle>Bridge USDC</CardTitle>
                    {onClose && (
                        <CloseBtn onClick={onClose}>
                            <X size={18} />
                        </CloseBtn>
                    )}
                </CardHeader>

                {/* Chain route */}
                <ChainRoute>
                    <ChainChip $source>Base Sepolia</ChainChip>
                    <ChainArrow>→</ChainArrow>
                    <ChainChip>Arc Testnet</ChainChip>
                </ChainRoute>

                {/* Receive type toggle */}
                <ToggleGroup>
                    <ToggleLabel>Receive as</ToggleLabel>
                    <ToggleOptions>
                        <ToggleOption $active={!autoWrap} onClick={() => !loading && setAutoWrap(false)}>
                            USDC
                        </ToggleOption>
                        <ToggleOption $active={autoWrap} onClick={() => !loading && setAutoWrap(true)}>
                            TAPUSDC
                        </ToggleOption>
                    </ToggleOptions>
                </ToggleGroup>

                {/* Amount input */}
                <TokenBox>
                    <TokenLabel>
                        <span>You send</span>
                        <BalanceText onClick={() => { setAmount(baseBalance); setError(''); }}>
                            Base balance: {fmt(baseBalance)}
                        </BalanceText>
                    </TokenLabel>
                    <TokenRow>
                        <AmountInput
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={e => { setAmount(e.target.value); setError(''); }}
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

                {/* Destination output */}
                <TokenBox>
                    <TokenLabel>
                        <span>You receive on Arc</span>
                        <BalanceText as="span">
                            Arc balance: {fmt(destBalance)}
                        </BalanceText>
                    </TokenLabel>
                    <TokenRow>
                        <AmountDisplay>
                            {amount && parseFloat(amount) > 0 ? fmt(amount) : '0.00'}
                        </AmountDisplay>
                        <TokenBadge $accent>{destToken}</TokenBadge>
                    </TokenRow>
                </TokenBox>

                {/* Step progress — shown when active */}
                {(isActive || isSuccess) && (
                    <StepList>
                        {steps.map((step, i) => {
                            const stepIdx = STEP_ORDER.indexOf(step.key);
                            const done    = isSuccess || stepIdx < currentIdx;
                            const active  = !isSuccess && stepIdx === currentIdx;
                            return (
                                <StepItem key={step.key} $done={done} $active={active}>
                                    <StepDot $done={done} $active={active}>
                                        {done
                                            ? <Check size={10} />
                                            : active
                                                ? <StepSpinner />
                                                : null}
                                    </StepDot>
                                    <StepLabel $done={done} $active={active}>
                                        {step.label}
                                        {step.key === 'attesting' && active && ` (${attestElapsed}s)`}
                                    </StepLabel>
                                </StepItem>
                            );
                        })}
                    </StepList>
                )}

                {/* Info rows — shown when idle */}
                {!isActive && !isSuccess && (
                    <>
                        <InfoRow>
                            <InfoLabel>Protocol</InfoLabel>
                            <InfoValue>Circle CCTP V2</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>Fee</InfoLabel>
                            <InfoValue>None</InfoValue>
                        </InfoRow>
                        <InfoRow>
                            <InfoLabel>Est. time</InfoLabel>
                            <InfoValue>~60 seconds</InfoValue>
                        </InfoRow>
                        {autoWrap && (
                            <InfoRow>
                                <InfoLabel>Auto-wrap</InfoLabel>
                                <InfoValue>USDC → TAPUSDC on Arc</InfoValue>
                            </InfoRow>
                        )}
                    </>
                )}

                {/* Error */}
                {error && (
                    <ErrorBox>
                        <AlertCircle size={14} />
                        <span>{error}</span>
                    </ErrorBox>
                )}

                {/* Success */}
                {isSuccess && (
                    <SuccessBox>
                        <Check size={14} />
                        <span>
                            {autoWrap ? 'Bridged and wrapped successfully' : 'Bridged successfully'}
                            {mintTxHash && (
                                <TxLink
                                    href={`${import.meta.env.VITE_EXPLORER_URL}/tx/${mintTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {' '}View on Arc
                                </TxLink>
                            )}
                            {burnTxHash && (
                                <TxLink
                                    href={`https://sepolia.basescan.org/tx/${burnTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {' '}· View burn
                                </TxLink>
                            )}
                        </span>
                    </SuccessBox>
                )}

                <BridgeBtn
                    onClick={isSuccess ? () => setStatus('idle') : handleBridge}
                    disabled={!isSuccess && !canSubmit}
                >
                    {isActive && <Spinner />}
                    {btnLabel()}
                </BridgeBtn>

                <Disclaimer>
                    {autoWrap
                        ? 'USDC is burned on Base, minted on Arc, then wrapped to TAPUSDC in sequence.'
                        : 'USDC is burned on Base and natively minted on Arc — no bridged tokens.'}
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

// Styled components

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
    max-width: 420px;
    background: #121212;
    border-radius: 20px;
    padding: 28px;
    box-shadow: 0 8px 40px rgba(9, 0, 34, 0.15);
    animation: ${fadeIn} 0.3s ease;
    font-family: 'Sora', sans-serif;
    max-height: 90vh;
    overflow-y: auto;
`;

const CardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
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
    transition: opacity 0.2s;
    &:hover { opacity: 0.6; }
`;

// Chain route

const ChainRoute = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
`;

const ChainChip = styled.span`
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
    padding: 4px 10px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
`;

const ChainArrow = styled.span`
    font-size: 14px;
    color: #8D969E;
`;

// Receive toggle

const ToggleGroup = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
`;

const ToggleLabel = styled.span`
    font-size: 12px;
    color: #8D969E;
    font-weight: 500;
`;

const ToggleOptions = styled.div`
    display: flex;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
`;

const ToggleOption = styled.button`
    padding: 5px 14px;
    border-radius: 6px;
    border: none;
    font-family: 'Google Sans Flex', 'Sora', sans-serif;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    background: ${p => p.$active ? '#4F55F1' : 'transparent'};
    color: ${p => p.$active ? '#ffffff' : '#8D969E'};
    &:hover { color: ${p => p.$active ? '#ffffff' : '#fff'}; }
`;

// Token boxes

const TokenBox = styled.div`
    background: rgba(255, 255, 255, 0.1);
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
    font-weight: 500;
`;

const BalanceText = styled.span`
    cursor: pointer;
    color: #8D969E;
    transition: color 0.2s;
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
    &::-webkit-outer-spin-button { -webkit-appearance: none; }
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

// Step progress

const StepList = styled.div`
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 0;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
`;

const StepItem = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: ${p => (!p.$done && !p.$active) ? 0.35 : 1};
    transition: opacity 0.2s;
`;

const StepDot = styled.div`
    width: 20px;
    height: 20px;
    border-radius: 50%;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 10px;
    background: ${p => p.$done ? 'rgba(22,163,74,0.12)' : p.$active ? 'rgba(79,85,241,0.12)' : 'rgba(255,255,255,0.06)'};
    border: 1.5px solid ${p => p.$done ? 'rgba(22,163,74,0.4)' : p.$active ? 'rgba(79,85,241,0.4)' : 'rgba(255,255,255,0.12)'};
    color: ${p => p.$done ? '#16a34a' : p.$active ? '#4F55F1' : '#8D969E'};
`;

const StepLabel = styled.span`
    font-size: 12px;
    font-weight: ${p => p.$active ? 700 : 500};
    color: ${p => p.$done ? 'rgba(255,255,255,0.5)' : p.$active ? '#fff' : '#8D969E'};
`;

const StepSpinner = styled.div`
    width: 8px;
    height: 8px;
    border: 1.5px solid rgba(79,85,241,0.2);
    border-top-color: #4F55F1;
    border-radius: 50%;
    animation: ${spin} 0.7s linear infinite;
`;

// Info rows

const InfoRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid rgba(9, 0, 34, 0.04);
    &:first-of-type { margin-top: 16px; }
    &:last-of-type  { border-bottom: none; }
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
    align-items: flex-start;
    gap: 8px;
    background: #FDECEA;
    border-radius: 10px;
    padding: 10px 14px;
    margin-top: 12px;
    font-size: 13px;
    color: #B42318;
    font-weight: 500;
    line-height: 1.4;
    svg { flex-shrink: 0; margin-top: 1px; }
`;

const SuccessBox = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: #E7F6EF;
    border-radius: 10px;
    padding: 10px 14px;
    margin-top: 12px;
    font-size: 13px;
    color: #12925F;
    font-weight: 500;
    line-height: 1.5;
    svg { flex-shrink: 0; margin-top: 1px; }
`;

const TxLink = styled.a`
    color: #8D969E;
    font-weight: 600;
    text-decoration: none;
    &:hover { text-decoration: underline; }
`;

// CTA

const BridgeBtn = styled.button`
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
        box-shadow: 0 6px 20px rgba(79, 85, 241, 0.3);
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
    flex-shrink: 0;
`;

const Disclaimer = styled.p`
    font-size: 11px;
    color: #0f0f1180;
    text-align: center;
    margin: 12px 0 0;
    line-height: 1.5;
`;

export default BridgeComponent;
