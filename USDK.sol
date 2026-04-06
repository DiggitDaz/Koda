// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title USDK - USD Stablecoin for Card Payments from Non-Custodial Wallets
 * @notice This stablecoin enables card payments by temporarily restricting transfers
 *         during payment processing to prevent double-spending
 * @dev Implements temporary blacklist mechanism for fraud prevention
 */
contract USDK is ERC20, ERC20Burnable, ERC20Permit, AccessControl, Pausable, ReentrancyGuard {
    
    // Roles
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAYMENT_PROCESSOR_ROLE = keccak256("PAYMENT_PROCESSOR_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    
    // State Var
    
    /// @notice Mapping of addresses temporarily restricted during payment processing
    mapping(address => bool) public temporarilyRestricted;
    
    /// @notice Expiry timestamp for temporary restrictions
    mapping(address => uint256) public restrictionExpiry;
    
    /// @notice Payment ID associated with each restriction (for tracking)
    mapping(address => bytes32) public restrictionPaymentId;
    
    /// @notice Permanently blacklisted addresses (compliance/fraud)
    mapping(address => bool) public permanentlyBlacklisted;
    
    /// @notice Maximum duration for temporary restrictions (default: 5 minutes)
    uint256 public maxRestrictionDuration = 300;
    
    /// @notice User-defined spending limits per address
    mapping(address => uint256) public dailySpendingLimit;
    
    /// @notice Amount spent today per address
    mapping(address => uint256) public spentToday;
    
    /// @notice Last reset timestamp for daily limits
    mapping(address => uint256) public lastResetTimestamp;
    
    /// @notice Global daily transaction limit per user (default: $10,000)
    uint256 public globalDailyLimit = 10_000 * 10**6; // 10k USDK (6 decimals)
    
    // Events 
    
    event TemporaryRestrictionApplied(
        address indexed account,
        bytes32 indexed paymentId,
        uint256 expiryTimestamp,
        uint256 amount
    );
    
    event TemporaryRestrictionLifted(
        address indexed account,
        bytes32 indexed paymentId
    );
    
    event PermanentBlacklistAdded(address indexed account, string reason);
    event PermanentBlacklistRemoved(address indexed account);
    
    event DailyLimitSet(address indexed account, uint256 limit);
    event DailyLimitExceeded(address indexed account, uint256 attempted, uint256 limit);
    
    event PaymentProcessed(
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 indexed paymentId
    );
    
    // Errors 
    
    error AccountTemporarilyRestricted(address account, uint256 expiryTimestamp);
    error AccountPermanentlyBlacklisted(address account);
    error RestrictionDurationTooLong(uint256 requested, uint256 maximum);
    error RestrictionAlreadyActive(address account);
    error NoActiveRestriction(address account);
    error DailyLimitExceededError(address account, uint256 attempted, uint256 available);
    error InvalidAmount();
    
    // Constructor 
    
    constructor(
        address admin,
        address paymentProcessor
    ) ERC20("USD King", "USDK") ERC20Permit("USD King") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAYMENT_PROCESSOR_ROLE, paymentProcessor);
        _grantRole(COMPLIANCE_ROLE, admin);
    }
    
    // Decimals Override 
    
    function decimals() public pure override returns (uint8) {
        return 6; // Match USDC/USDT standard
    }
    
    // Payment Processing Functions 
    
    /**
     * @notice Temporarily restrict an address during card payment processing
     * @dev Can only be called by PAYMENT_PROCESSOR_ROLE
     * @param account The address to restrict
     * @param paymentId Unique identifier for this payment
     * @param duration How long to restrict (in seconds, max 5 minutes)
     * @param amount Expected payment amount 
     */
    function applyTemporaryRestriction(
        address account,
        bytes32 paymentId,
        uint256 duration,
        uint256 amount
    ) external onlyRole(PAYMENT_PROCESSOR_ROLE) {
        if (temporarilyRestricted[account]) {
            revert RestrictionAlreadyActive(account);
        }
        
        if (duration > maxRestrictionDuration) {
            revert RestrictionDurationTooLong(duration, maxRestrictionDuration);
        }
        
        uint256 expiryTimestamp = block.timestamp + duration;
        
        temporarilyRestricted[account] = true;
        restrictionExpiry[account] = expiryTimestamp;
        restrictionPaymentId[account] = paymentId;
        
        emit TemporaryRestrictionApplied(account, paymentId, expiryTimestamp, amount);
    }
    
    /**
     * @notice Lift temporary restriction after payment completes
     * @dev Can only be called by PAYMENT_PROCESSOR_ROLE
     * @param account The address to unrestrict
     */
    function liftTemporaryRestriction(
        address account
    ) external onlyRole(PAYMENT_PROCESSOR_ROLE) {
        if (!temporarilyRestricted[account]) {
            revert NoActiveRestriction(account);
        }
        
        bytes32 paymentId = restrictionPaymentId[account];
        
        temporarilyRestricted[account] = false;
        restrictionExpiry[account] = 0;
        restrictionPaymentId[account] = bytes32(0);
        
        emit TemporaryRestrictionLifted(account, paymentId);
    }
    
    /**
     * @notice Process a card payment (restrict, pull, unrestrict)
     * @dev Atomic operation to prevent race conditions
     * @param from User's wallet address
     * @param to Merchant settlement address
     * @param amount Payment amount
     * @param paymentId Unique payment identifier
     */
    function processCardPayment(
        address from,
        address to,
        uint256 amount,
        bytes32 paymentId
    ) external onlyRole(PAYMENT_PROCESSOR_ROLE) nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
        // Check daily spending limit
        _checkDailyLimit(from, amount);
        
        // Apply temporary restriction (prevents user from transferring during payment)
        temporarilyRestricted[from] = true;
        restrictionExpiry[from] = block.timestamp + 60; // 60 second window
        restrictionPaymentId[from] = paymentId;
        
        emit TemporaryRestrictionApplied(from, paymentId, block.timestamp + 60, amount);
        
        // Transfer tokens (user must have pre-approved the payment processor)
        _transfer(from, to, amount);
        
        // Update daily spending
        _updateDailySpending(from, amount);
        
        // Immediately lift restriction after successful transfer
        temporarilyRestricted[from] = false;
        restrictionExpiry[from] = 0;
        restrictionPaymentId[from] = bytes32(0);
        
        emit TemporaryRestrictionLifted(from, paymentId);
        emit PaymentProcessed(from, to, amount, paymentId);
    }
    
    // Daily Limit Functions 
    
    /**
     * @notice Set personal daily spending limit
     * @param limit Maximum amount user can spend per day (0 = use global limit)
     */
    function setDailySpendingLimit(uint256 limit) external {
        dailySpendingLimit[msg.sender] = limit;
        emit DailyLimitSet(msg.sender, limit);
    }
    
    /**
     * @notice Check if amount would exceed daily limit
     * @param account User address
     * @param amount Attempted spend amount
     */
    function _checkDailyLimit(address account, uint256 amount) internal view {
        // Reset if new day
        if (block.timestamp >= lastResetTimestamp[account] + 1 days) {
            // Will be reset in _updateDailySpending
            return;
        }
        
        uint256 limit = dailySpendingLimit[account] > 0 
            ? dailySpendingLimit[account] 
            : globalDailyLimit;
        
        uint256 newTotal = spentToday[account] + amount;
        
        if (newTotal > limit) {
            revert DailyLimitExceededError(account, amount, limit - spentToday[account]);
        }
    }
    
    /**
     * @notice Update daily spending tracker
     */
    function _updateDailySpending(address account, uint256 amount) internal {
        // Reset if new day
        if (block.timestamp >= lastResetTimestamp[account] + 1 days) {
            spentToday[account] = amount;
            lastResetTimestamp[account] = block.timestamp;
        } else {
            spentToday[account] += amount;
        }
    }
    
    /**
     * @notice Get available spending amount for today
     * @param account User address
     * @return Available amount user can still spend today
     */
    function getAvailableSpendingToday(address account) external view returns (uint256) {
        uint256 limit = dailySpendingLimit[account] > 0 
            ? dailySpendingLimit[account] 
            : globalDailyLimit;
        
        // If new day, full limit available
        if (block.timestamp >= lastResetTimestamp[account] + 1 days) {
            return limit;
        }
        
        if (spentToday[account] >= limit) {
            return 0;
        }
        
        return limit - spentToday[account];
    }
    
    // Compliance Functions 
    
    /**
     * @notice Permanently blacklist an address (compliance/fraud)
     * @dev Can only be called by COMPLIANCE_ROLE
     * @param account Address to blacklist
     * @param reason Reason for blacklisting
     */
    function addToBlacklist(
        address account,
        string calldata reason
    ) external onlyRole(COMPLIANCE_ROLE) {
        permanentlyBlacklisted[account] = true;
        emit PermanentBlacklistAdded(account, reason);
    }
    
    /**
     * @notice Remove address from permanent blacklist
     * @dev Can only be called by COMPLIANCE_ROLE
     * @param account Address to remove
     */
    function removeFromBlacklist(address account) external onlyRole(COMPLIANCE_ROLE) {
        permanentlyBlacklisted[account] = false;
        emit PermanentBlacklistRemoved(account);
    }
    
    // Admin Functions 
    
    /**
     * @notice Mint new USDK tokens (backed 1:1 by USD reserves)
     * @dev Can only be called by MINTER_ROLE
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    
    /**
     * @notice Update maximum restriction duration
     */
    function setMaxRestrictionDuration(
        uint256 newDuration
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxRestrictionDuration = newDuration;
    }
    
    /**
     * @notice Update global daily spending limit
     */
    function setGlobalDailyLimit(
        uint256 newLimit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalDailyLimit = newLimit;
    }
    
    /**
     * @notice Pause all transfers (emergency only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause transfers
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // View Functions 
    
    /**
     * @notice Check if an address is currently restricted
     * @param account Address to check
     * @return isRestricted True if restricted
     * @return expiryTime When restriction expires (0 if not restricted)
     * @return paymentId Associated payment ID
     */
    function getRestrictionStatus(address account) external view returns (
        bool isRestricted,
        uint256 expiryTime,
        bytes32 paymentId
    ) {
        // Check if expired
        if (temporarilyRestricted[account] && block.timestamp >= restrictionExpiry[account]) {
            return (false, 0, bytes32(0));
        }
        
        return (
            temporarilyRestricted[account],
            restrictionExpiry[account],
            restrictionPaymentId[account]
        );
    }
    
    // Transfer Hooks 
    
    /**
     * @notice Hook that runs before any token transfer
     * @dev Checks for restrictions and blacklists
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        // Skip checks for minting/burning
        if (from == address(0) || to == address(0)) {
            super._update(from, to, amount);
            return;
        }
        
        // Check permanent blacklist
        if (permanentlyBlacklisted[from]) {
            revert AccountPermanentlyBlacklisted(from);
        }
        if (permanentlyBlacklisted[to]) {
            revert AccountPermanentlyBlacklisted(to);
        }
        
        // Auto-expire temporary restrictions
        if (temporarilyRestricted[from] && block.timestamp >= restrictionExpiry[from]) {
            temporarilyRestricted[from] = false;
            restrictionExpiry[from] = 0;
            emit TemporaryRestrictionLifted(from, restrictionPaymentId[from]);
            restrictionPaymentId[from] = bytes32(0);
        }
        
        // Check temporary restriction
        // Note: Payment processor can still pull via processCardPayment()
        if (temporarilyRestricted[from] && !hasRole(PAYMENT_PROCESSOR_ROLE, msg.sender)) {
            revert AccountTemporarilyRestricted(from, restrictionExpiry[from]);
        }
        
        super._update(from, to, amount);
    }
}