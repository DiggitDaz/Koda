// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// TAPUSDCWrapperv2 — Koda USDC Wrapper, Arc Testnet
//
// Changes from v1:
//   Adds a scheduled withdrawal path for routine USDC off-ramp to fiat.
//   Unlike the emergency rescue (which requires pausing), scheduled withdrawals
//   do not pause the contract — users can continue depositing and unwrapping
//   during the 24-hour window.
//
//   The invariant is enforced at both schedule and execute time:
//     withdrawable amount <= USDC.balanceOf(this) - TAPUSDC.totalSupply()
//   Because TAPUSDCv2.processCardPayment now burns TAPUSDC on settlement,
//   this surplus grows exactly in line with settled card payments. Every
//   withdrawal is provably backed by prior on-chain burns.
//
//   Emergency rescue (48h, requires pause) is retained for genuine emergencies.

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITAPUSDCv2MintBurn {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract TAPUSDCWrapperv2 is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Immutables ============

    IERC20 public immutable USDC;
    ITAPUSDCv2MintBurn public immutable TAPUSDC;

    // ============ Scheduled Withdrawal (routine off-ramp) ============

    uint256 public constant WITHDRAWAL_DELAY = 24 hours;

    struct WithdrawalProposal {
        address recipient;
        uint256 amount;
        uint256 scheduledAt;
        bool    executed;
    }

    WithdrawalProposal public pendingWithdrawal;

    // ============ Emergency Rescue (pause-gated, 48h timelock) ============

    uint256 public constant RESCUE_DELAY = 48 hours;

    struct RescueProposal {
        address recipient;
        uint256 proposedAt;
        bool    executed;
    }

    RescueProposal public pendingRescue;

    // ============ Events ============

    event Deposited(address indexed user, uint256 usdcAmount, uint256 tapusdcMinted);
    event Withdrawn(address indexed user, uint256 tapusdcBurned, uint256 usdcReturned);

    // Scheduled withdrawal events
    event WithdrawalScheduled(address indexed recipient, uint256 amount, uint256 executeAfter);
    event WithdrawalExecuted(address indexed recipient, uint256 amount);
    event WithdrawalCancelled(address indexed cancelledBy);

    // Emergency rescue events
    event RescueProposed(address indexed recipient, uint256 executeAfter, uint256 surplusAmount);
    event RescueCancelled(address indexed cancelledBy);
    event RescueExecuted(address indexed recipient, uint256 usdcAmount);

    event ERC20Rescued(address indexed token, address indexed recipient, uint256 amount);

    // ============ Constructor ============

    constructor(address _usdc, address _tapusdc, address _owner) Ownable(_owner) {
        require(_usdc    != address(0), "USDC address cannot be zero");
        require(_tapusdc != address(0), "TAPUSDC address cannot be zero");
        require(_owner   != address(0), "Owner cannot be zero address");

        USDC   = IERC20(_usdc);
        TAPUSDC = ITAPUSDCv2MintBurn(_tapusdc);
    }

    // ============ Deposit ============

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        TAPUSDC.mint(msg.sender, amount);
        emit Deposited(msg.sender, amount, amount);
    }

    // ============ Withdraw (user unwrap) ============

    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        require(USDC.balanceOf(address(this)) >= amount, "Insufficient USDC reserves");
        TAPUSDC.burnFrom(msg.sender, amount);
        USDC.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, amount);
    }

    // ============ Scheduled Withdrawal (routine off-ramp) ============

    // Step 1: schedule a withdrawal of surplus USDC.
    // Does not pause the contract. Amount is validated against current surplus and
    // re-validated at execution time — any interim user unwraps that reduce the
    // surplus will lower or block the withdrawal automatically.
    function scheduleWithdrawal(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(
            pendingWithdrawal.scheduledAt == 0 || pendingWithdrawal.executed,
            "Withdrawal already pending"
        );

        uint256 available = surplus();
        require(amount <= available, "Amount exceeds current surplus");

        pendingWithdrawal = WithdrawalProposal({
            recipient:   recipient,
            amount:      amount,
            scheduledAt: block.timestamp,
            executed:    false
        });

        emit WithdrawalScheduled(recipient, amount, block.timestamp + WITHDRAWAL_DELAY);
    }

    // Step 2: execute after the 24-hour window.
    // Surplus is recalculated at execution — if users unwrapped in the interim and
    // surplus fell below the scheduled amount, the execution reverts.
    function executeWithdrawal() external onlyOwner nonReentrant {
        require(pendingWithdrawal.scheduledAt != 0, "No withdrawal scheduled");
        require(!pendingWithdrawal.executed, "Already executed");
        require(
            block.timestamp >= pendingWithdrawal.scheduledAt + WITHDRAWAL_DELAY,
            "Timelock not elapsed — 24 hours required"
        );

        uint256 available = surplus();
        uint256 amount    = pendingWithdrawal.amount;
        require(amount <= available, "Surplus insufficient at execution time");

        address recipient = pendingWithdrawal.recipient;
        pendingWithdrawal.executed = true;

        USDC.safeTransfer(recipient, amount);

        emit WithdrawalExecuted(recipient, amount);
    }

    // Cancel a pending scheduled withdrawal.
    function cancelWithdrawal() external onlyOwner {
        require(pendingWithdrawal.scheduledAt != 0, "No withdrawal pending");
        require(!pendingWithdrawal.executed, "Already executed");

        delete pendingWithdrawal;

        emit WithdrawalCancelled(msg.sender);
    }

    // ============ Admin ============

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ============ Emergency Rescue (pause-gated, 48h timelock) ============

    // For genuine emergencies only. Requires the contract to be paused,
    // blocking all user activity for the duration. Use scheduleWithdrawal
    // for routine off-ramp — it does not require pausing.
    function proposeRescue(address recipient) external onlyOwner whenPaused {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(pendingRescue.proposedAt == 0 || pendingRescue.executed, "Rescue already pending");

        uint256 vaultBalance  = USDC.balanceOf(address(this));
        uint256 totalOwed     = TAPUSDC.totalSupply();
        uint256 surplusAmount = vaultBalance > totalOwed ? vaultBalance - totalOwed : 0;

        require(surplusAmount > 0, "No surplus USDC to rescue");

        pendingRescue = RescueProposal({
            recipient:  recipient,
            proposedAt: block.timestamp,
            executed:   false
        });

        emit RescueProposed(recipient, block.timestamp + RESCUE_DELAY, surplusAmount);
    }

    function executeRescue() external onlyOwner whenPaused nonReentrant {
        require(pendingRescue.proposedAt != 0, "No rescue proposed");
        require(!pendingRescue.executed, "Rescue already executed");
        require(
            block.timestamp >= pendingRescue.proposedAt + RESCUE_DELAY,
            "Timelock not elapsed — 48 hours required"
        );

        address recipient     = pendingRescue.recipient;
        uint256 vaultBalance  = USDC.balanceOf(address(this));
        uint256 totalOwed     = TAPUSDC.totalSupply();
        uint256 surplusAmount = vaultBalance > totalOwed ? vaultBalance - totalOwed : 0;

        require(surplusAmount > 0, "No surplus to rescue");

        pendingRescue.executed = true;

        USDC.safeTransfer(recipient, surplusAmount);

        emit RescueExecuted(recipient, surplusAmount);
    }

    function cancelRescue() external onlyOwner {
        require(pendingRescue.proposedAt != 0, "No rescue pending");
        require(!pendingRescue.executed, "Already executed");
        delete pendingRescue;
        emit RescueCancelled(msg.sender);
    }

    // Recover accidentally sent non-USDC tokens. USDC must go through
    // scheduleWithdrawal or emergency rescue.
    function rescueERC20(address token, address recipient, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(token != address(USDC), "Use withdrawal or rescue for USDC");
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than zero");
        IERC20(token).safeTransfer(recipient, amount);
        emit ERC20Rescued(token, recipient, amount);
    }

    // ============ Views ============

    function reserves() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    function circulatingSupply() external view returns (uint256) {
        return TAPUSDC.totalSupply();
    }

    // Surplus = USDC held minus TAPUSDC in circulation.
    // Grows as TAPUSDCv2.processCardPayment burns settled tokens.
    // This is the maximum amount withdrawable via scheduleWithdrawal.
    function surplus() public view returns (uint256) {
        uint256 bal = USDC.balanceOf(address(this));
        uint256 sup = TAPUSDC.totalSupply();
        return bal > sup ? bal - sup : 0;
    }

    function withdrawalTimelockRemaining() external view returns (uint256) {
        if (pendingWithdrawal.scheduledAt == 0 || pendingWithdrawal.executed) return 0;
        uint256 unlockAt = pendingWithdrawal.scheduledAt + WITHDRAWAL_DELAY;
        if (block.timestamp >= unlockAt) return 0;
        return unlockAt - block.timestamp;
    }

    function rescueTimelockRemaining() external view returns (uint256) {
        if (pendingRescue.proposedAt == 0 || pendingRescue.executed) return 0;
        uint256 unlockAt = pendingRescue.proposedAt + RESCUE_DELAY;
        if (block.timestamp >= unlockAt) return 0;
        return unlockAt - block.timestamp;
    }
}
