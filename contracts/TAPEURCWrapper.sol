// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// TAPEURCWrapperv2 — Koda EURC Wrapper, Arc Testnet
//
// Changes from v1:
//   Adds a scheduled withdrawal path for routine EURC off-ramp to fiat.
//   Unlike the emergency rescue (which requires pausing), scheduled withdrawals
//   do not pause the contract — users can continue depositing and unwrapping
//   during the 24-hour window.
//
//   The invariant is enforced at both schedule and execute time:
//     withdrawable amount <= EURC.balanceOf(this) - TAPEURC.totalSupply()
//   Because TAPEURCv2.processCardPayment now burns TAPEURC on settlement,
//   this surplus grows exactly in line with settled card payments. Every
//   withdrawal is provably backed by prior on-chain burns.
//
//   Emergency rescue (48h, requires pause) is retained for genuine emergencies.

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITAPEURCv2MintBurn {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract TAPEURCWrapperv2 is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Immutables ============

    IERC20 public immutable EURC;
    ITAPEURCv2MintBurn public immutable TAPEURC;

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

    event Deposited(address indexed user, uint256 eurcAmount, uint256 tapeurcMinted);
    event Withdrawn(address indexed user, uint256 tapeurcBurned, uint256 eurcReturned);

    // Scheduled withdrawal events
    event WithdrawalScheduled(address indexed recipient, uint256 amount, uint256 executeAfter);
    event WithdrawalExecuted(address indexed recipient, uint256 amount);
    event WithdrawalCancelled(address indexed cancelledBy);

    // Emergency rescue events
    event RescueProposed(address indexed recipient, uint256 executeAfter, uint256 surplusAmount);
    event RescueCancelled(address indexed cancelledBy);
    event RescueExecuted(address indexed recipient, uint256 eurcAmount);

    event ERC20Rescued(address indexed token, address indexed recipient, uint256 amount);

    // ============ Constructor ============

    constructor(address _eurc, address _tapeurc, address _owner) Ownable(_owner) {
        require(_eurc    != address(0), "EURC address cannot be zero");
        require(_tapeurc != address(0), "TAPEURC address cannot be zero");
        require(_owner   != address(0), "Owner cannot be zero address");

        EURC   = IERC20(_eurc);
        TAPEURC = ITAPEURCv2MintBurn(_tapeurc);
    }

    // ============ Deposit ============

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        EURC.safeTransferFrom(msg.sender, address(this), amount);
        TAPEURC.mint(msg.sender, amount);
        emit Deposited(msg.sender, amount, amount);
    }

    // ============ Withdraw (user unwrap) ============

    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than zero");
        require(EURC.balanceOf(address(this)) >= amount, "Insufficient EURC reserves");
        TAPEURC.burnFrom(msg.sender, amount);
        EURC.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, amount);
    }

    // ============ Scheduled Withdrawal (routine off-ramp) ============

    // Step 1: schedule a withdrawal of surplus EURC.
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
            "Timelock not elapsed, 24 hours required"
        );

        uint256 available = surplus();
        uint256 amount    = pendingWithdrawal.amount;
        require(amount <= available, "Surplus insufficient at execution time");

        address recipient = pendingWithdrawal.recipient;
        pendingWithdrawal.executed = true;

        EURC.safeTransfer(recipient, amount);

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

        uint256 vaultBalance  = EURC.balanceOf(address(this));
        uint256 totalOwed     = TAPEURC.totalSupply();
        uint256 surplusAmount = vaultBalance > totalOwed ? vaultBalance - totalOwed : 0;

        require(surplusAmount > 0, "No surplus EURC to rescue");

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
            "Timelock not elapsed, 48 hours required"
        );

        address recipient     = pendingRescue.recipient;
        uint256 vaultBalance  = EURC.balanceOf(address(this));
        uint256 totalOwed     = TAPEURC.totalSupply();
        uint256 surplusAmount = vaultBalance > totalOwed ? vaultBalance - totalOwed : 0;

        require(surplusAmount > 0, "No surplus to rescue");

        pendingRescue.executed = true;

        EURC.safeTransfer(recipient, surplusAmount);

        emit RescueExecuted(recipient, surplusAmount);
    }

    function cancelRescue() external onlyOwner {
        require(pendingRescue.proposedAt != 0, "No rescue pending");
        require(!pendingRescue.executed, "Already executed");
        delete pendingRescue;
        emit RescueCancelled(msg.sender);
    }

    // Recover accidentally sent non-EURC tokens. EURC must go through
    // scheduleWithdrawal or emergency rescue.
    function rescueERC20(address token, address recipient, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        require(token != address(EURC), "Use withdrawal or rescue for EURC");
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than zero");
        IERC20(token).safeTransfer(recipient, amount);
        emit ERC20Rescued(token, recipient, amount);
    }

    // ============ Views ============

    function reserves() external view returns (uint256) {
        return EURC.balanceOf(address(this));
    }

    function circulatingSupply() external view returns (uint256) {
        return TAPEURC.totalSupply();
    }

    // Surplus = EURC held minus TAPEURC in circulation.
    // Grows as TAPEURCv2.processCardPayment burns settled tokens.
    // This is the maximum amount withdrawable via scheduleWithdrawal.
    function surplus() public view returns (uint256) {
        uint256 bal = EURC.balanceOf(address(this));
        uint256 sup = TAPEURC.totalSupply();
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
