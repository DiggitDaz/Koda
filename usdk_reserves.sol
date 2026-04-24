const ethers = require('ethers');

// ============ CONFIGURATION ============
const USER_PRIVATE_KEY = '2190152c1d462366a1403fc06e497f6d96c4d6e3b75a47e9c825ca771ea00c38'; // ← Add your wallet's private key (no 0x prefix needed)
const RPC_URL = 'https://chainfree.site:5010/validator/1';
const USDK_CONTRACT = '0x9eB3dd147781510b3B19397D077286689997F3A3';
const PAYMENT_PROCESSOR = '0x03440A93942EF5609348b3102B2E6fA89f6056F2';
const AMOUNT_USDK = '500'; // How many USDK to approve

// ============ SCRIPT ============
async function approveUSDK() {
  try {
    console.log('========================================');
    console.log('🔐 USDK Approval Script');
    console.log('========================================\n');
    
    // Connect to Hydrix chain
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(USER_PRIVATE_KEY, provider);
    
    console.log('📍 Connected to:', RPC_URL);
    console.log('👤 User wallet:', wallet.address);
    console.log('💳 USDK contract:', USDK_CONTRACT);
    console.log('🎯 Spender (Payment Processor):', PAYMENT_PROCESSOR);
    console.log('💰 Amount to approve:', AMOUNT_USDK, 'USDK\n');
    
    // Create contract instance
    const usdkABI = [
      'function approve(address spender, uint256 amount) returns (bool)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function balanceOf(address account) view returns (uint256)'
    ];
    
    const usdkContract = new ethers.Contract(USDK_CONTRACT, usdkABI, wallet);
    
    // Check current balance
    console.log('🔍 Checking current balance...');
    const balance = await usdkContract.balanceOf(wallet.address);
    const balanceFormatted = ethers.utils.formatUnits(balance, 6);
    console.log('   Balance:', balanceFormatted, 'USDK');
    
    if (parseFloat(balanceFormatted) < parseFloat(AMOUNT_USDK)) {
      console.log('⚠️  Warning: You are approving more than your current balance!');
      console.log('   This is okay - approval just sets a spending limit.\n');
    }
    
    // Check current allowance
    console.log('🔍 Checking current allowance...');
    const currentAllowance = await usdkContract.allowance(wallet.address, PAYMENT_PROCESSOR);
    const allowanceFormatted = ethers.utils.formatUnits(currentAllowance, 6);
    console.log('   Current allowance:', allowanceFormatted, 'USDK\n');
    
    // Convert amount to raw units (6 decimals)
    const amountRaw = ethers.utils.parseUnits(AMOUNT_USDK, 6);
    
    console.log('📝 Preparing approval transaction...');
    console.log('   Raw amount:', amountRaw.toString(), '(with 6 decimals)\n');
    
    // Send approval transaction
    console.log('📡 Sending approval transaction...');
    const tx = await usdkContract.approve(PAYMENT_PROCESSOR, amountRaw, {
      gasLimit: 100000 // Set gas limit to avoid estimation issues
    });
    
    console.log('✅ Transaction sent!');
    console.log('   Tx hash:', tx.hash);
    console.log('   Waiting for confirmation...\n');
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    console.log('========================================');
    console.log('🎉 APPROVAL SUCCESSFUL!');
    console.log('========================================');
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Transaction hash:', receipt.transactionHash);
    console.log('');
    
    // Verify new allowance
    console.log('🔍 Verifying new allowance...');
    const newAllowance = await usdkContract.allowance(wallet.address, PAYMENT_PROCESSOR);
    const newAllowanceFormatted = ethers.utils.formatUnits(newAllowance, 6);
    console.log('✅ New allowance:', newAllowanceFormatted, 'USDK');
    console.log('');
    
    console.log('========================================');
    console.log('✅ Payment processor can now spend up to');
    console.log('   ' + newAllowanceFormatted + ' USDK from your wallet!');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.error('💡 You need native tokens (for gas) in your wallet to send this transaction');
    } else if (error.message.includes('nonce')) {
      console.error('💡 Nonce error - try again in a few seconds');
    } else if (error.code === 'INVALID_ARGUMENT') {
      console.error('💡 Check that your private key is correct (64 hex characters, no 0x prefix)');
    }
    
    process.exit(1);
  }
}

// Run the script
approveUSDK();