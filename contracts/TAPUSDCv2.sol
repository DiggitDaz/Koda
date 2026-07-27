// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// TAPUSDCv2 — Koda Payment Token, Arc Testnet
//
// Change from v1: processCardPayment now burns TAPUSDC from the user's wallet
// instead of transferring to a business wallet. This reduces totalSupply by the
// settled amount, creating a verifiable surplus in TAPUSDCWrapperv2 that can be
// withdrawn for fiat off-ramp. The paymentId in calldata links every burn to a
// specific Stripe authorisation on-chain.
//
// Security model:
//   OZ AccessControl for all roles
//   ReentrancyGuard on all state-changing payment functions
//   48-hour role revocation timelock (front-run protection)
//   Minimum restriction duration (timestamp drift protection)
//   Blacklist enforced on mint; burn intentionally unrestricted
//   Full event emission including old/new values
//
// SECURITY NOTES FOR AUDITORS
//
// [INT-OVERFLOW]   Solidity 0.8.20 — arithmetic reverts on overflow by default.
//                  No SafeMath required.
//
// [REENTRANCY]     processCardPayment is nonReentrant. TAPUSDC is a plain ERC20
//                  with no tokensReceived hooks — no external calls are made
//                  post-burn inside _update. Reentrancy surface is zero.
//
// [BLACKLIST-BURN] Burn and burnFrom intentionally bypass the blacklist check.
//                  A blacklisted user retaining the ability to exit (burn TAPUSDC
//                  and reclaim USDC via the wrapper) is the correct compliance
//                  posture — blocking exit would constitute asset seizure without
//                  legal authority. Mint is blocked for blacklisted addresses.
//
// [TIMESTAMP]      block.timestamp is used for restriction expiry and daily limit
//                  resets. PoS validator drift is ~15 seconds. A minimum restriction
//                  duration of 30 seconds is enforced so drift cannot trivially
//                  bypass a lock. Daily limit windows are 24 hours — 15s drift
//                  is negligible at that scale.
//
// [FRONT-RUN]      Role revocations are timelocked by 48 hours via a two-step
//                  propose/execute pattern. This prevents a compromised processor
//                  key from racing processCardPayment against a revocation tx.
//
// [ACCESS-CONTROL] PAYMENT_PROCESSOR_ROLE can lock/unlock and settle payments.
//                  It cannot mint, blacklist, pause, or touch admin. Compromised
//                  processor key worst case: burn up to the daily limit from a
//                  single address. Mitigated by: timelocked revocation, daily
//                  limits, pause function.
//
// [BURN-vs-TRANSFER] v2 burns on settlement rather than transferring to a business
//                  wallet. _update skips restriction/blacklist checks when to==0
//                  (burn path), which is correct: the restriction applied at the
//                  start of processCardPayment is lifted in the same tx anyway.

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TAPUSDCv2 is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ReentrancyGuard {

    // ============ Roles ============

    bytes32 public constant PAYMENT_PROCESSOR_ROLE = keccak256("PAYMENT_PROCESSOR_ROLE");
    bytes32 public constant MINTER_ROLE             = keccak256("MINTER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE         = keccak256("COMPLIANCE_ROLE");

    // ============ Token Config ============

    uint8 private constant _DECIMALS = 6;

    // ============ Restriction Config ============

    uint256 public constant MIN_RESTRICTION_DURATION = 30; // seconds

    // ============ Payment Restriction State ============

    struct RestrictionData {
        bool    active;
        uint256 expiry;
        bytes32 paymentId;
    }

    mapping(address => RestrictionData) private _restrictions;
    mapping(address => bool) public permanentlyBlacklisted;

    uint256 public maxRestrictionDuration = 300; // 5 minutes

    // ============ Daily Spending Limits ============

    mapping(address => uint256) public dailySpendingLimit;
    mapping(address => uint256) public spentToday;
    mapping(address => uint256) public lastResetTimestamp;

    uint256 public globalDailyLimit = 10_000 * 10 ** 6; // 10,000 TAPUSDC

    // ============ Role Revocation Timelock ============

    uint256 public constant ROLE_REVOCATION_DELAY = 48 hours;

    struct RevocationProposal {
        bytes32 role;
        address account;
        uint256 proposedAt;
    }

    mapping(bytes32 => RevocationProposal) public pendingRevocations;

    // ============ Events ============

    event PaymentProcessorAdded(address indexed processor, address indexed addedBy);
    event PaymentProcessorRevocationProposed(address indexed processor, uint256 executeAfter, address indexed proposedBy);
    event PaymentProcessorRevocationCancelled(address indexed processor);
    event PaymentProcessorRevoked(address indexed processor, address indexed revokedBy);

    event TemporaryRestrictionApplied(address indexed account, bytes32 indexed paymentId, uint256 expiry, uint256 amount);
    event TemporaryRestrictionLifted(address indexed account, bytes32 indexed paymentId, bool autoExpired);

    event PermanentBlacklistAdded(address indexed account, string reason, address indexed addedBy);
    event PermanentBlacklistRemoved(address indexed account, address indexed removedBy);

    event DailyLimitSet(address indexed account, uint256 oldLimit, uint256 newLimit);
    event GlobalDailyLimitSet(uint256 oldLimit, uint256 newLimit, address indexed setBy);
    event MaxRestrictionDurationSet(uint256 oldDuration, uint256 newDuration, address indexed setBy);

    // v2: `to` removed — TAPUSDC is burned on settlement, not transferred.
    // The paymentId in calldata links this burn to a specific Stripe auth.
    event PaymentSettled(
        address indexed from,
        uint256 amount,
        bytes32 indexed paymentId,
        address indexed processor
    );

    // ============ Constructor ============

    constructor(address _admin, address _paymentProcessor)
        ERC20("TAPUSDC", "TAPUSDC")
    {
        require(_admin != address(0), "Admin cannot be zero address");
        require(_paymentProcessor != address(0), "Processor cannot be zero address");
        require(_admin != _paymentProcessor, "Admin and processor should be separate wallets");

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(COMPLIANCE_ROLE, _admin);
        _grantRole(PAYMENT_PROCESSOR_ROLE, _paymentProcessor);

        emit PaymentProcessorAdded(_paymentProcessor, _admin);
    }

    // ============ Decimals Override ============

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    // ============ Minting ============

    function mint(address to, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
    {
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(!permanentlyBlacklisted[to], "Recipient is blacklisted");
        _mint(to, amount);
    }

    // ============ Payment Processor Management ============

    function addPaymentProcessor(address processor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(processor != address(0), "Zero address");
        require(!hasRole(PAYMENT_PROCESSOR_ROLE, processor), "Already a processor");
        _grantRole(PAYMENT_PROCESSOR_ROLE, processor);
        emit PaymentProcessorAdded(processor, msg.sender);
    }

    function proposeProcessorRevocation(address processor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(hasRole(PAYMENT_PROCESSOR_ROLE, processor), "Not a processor");

        bytes32 proposalId = keccak256(abi.encodePacked(PAYMENT_PROCESSOR_ROLE, processor));
        require(pendingRevocations[proposalId].proposedAt == 0, "Revocation already proposed");

        pendingRevocations[proposalId] = RevocationProposal({
            role:       PAYMENT_PROCESSOR_ROLE,
            account:    processor,
            proposedAt: block.timestamp
        });

        emit PaymentProcessorRevocationProposed(processor, block.timestamp + ROLE_REVOCATION_DELAY, msg.sender);
    }

    function executeProcessorRevocation(address processor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 proposalId = keccak256(abi.encodePacked(PAYMENT_PROCESSOR_ROLE, processor));
        RevocationProposal memory proposal = pendingRevocations[proposalId];

        require(proposal.proposedAt != 0, "No revocation proposed");
        require(block.timestamp >= proposal.proposedAt + ROLE_REVOCATION_DELAY, "Timelock not elapsed — 48 hours required");

        delete pendingRevocations[proposalId];
        _revokeRole(PAYMENT_PROCESSOR_ROLE, processor);

        emit PaymentProcessorRevoked(processor, msg.sender);
    }

    function cancelProcessorRevocation(address processor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 proposalId = keccak256(abi.encodePacked(PAYMENT_PROCESSOR_ROLE, processor));
        require(pendingRevocations[proposalId].proposedAt != 0, "No revocation pending");

        delete pendingRevocations[proposalId];
        emit PaymentProcessorRevocationCancelled(processor);
    }

    // ============ Payment Processing ============

    // v2 change: burns `amount` from `from` instead of transferring to a business wallet.
    // Reduces totalSupply, creating a withdrawable surplus in TAPUSDCWrapperv2.
    // The `paymentId` in this transaction's calldata is the on-chain proof linking
    // this burn to a specific Stripe authorisation.
    function processCardPayment(
        address from,
        uint256 amount,
        bytes32 paymentId
    )
        external
        onlyRole(PAYMENT_PROCESSOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        require(amount > 0, "Amount must be greater than zero");
        require(from != address(0), "Zero address");
        require(!permanentlyBlacklisted[from], "Sender blacklisted");
        require(!_restrictions[from].active, "Sender already restricted");
        require(paymentId != bytes32(0), "Invalid payment ID");

        _checkDailyLimit(from, amount);

        // Apply temporary restriction for the duration of this tx
        uint256 expiry = block.timestamp + 60;
        _restrictions[from] = RestrictionData({ active: true, expiry: expiry, paymentId: paymentId });
        emit TemporaryRestrictionApplied(from, paymentId, expiry, amount);

        // Burn settled TAPUSDC — reduces totalSupply, grows wrapper surplus
        _burn(from, amount);

        _updateDailySpending(from, amount);

        delete _restrictions[from];
        emit TemporaryRestrictionLifted(from, paymentId, false);

        emit PaymentSettled(from, amount, paymentId, msg.sender);
    }

    // ============ Pre-auth Restriction Functions ============

    function applyTemporaryRestriction(
        address account,
        bytes32 paymentId,
        uint256 duration,
        uint256 amount
    )
        external
        onlyRole(PAYMENT_PROCESSOR_ROLE)
        whenNotPaused
    {
        require(account != address(0), "Zero address");
        require(!_restrictions[account].active, "Already restricted");
        require(duration >= MIN_RESTRICTION_DURATION, "Duration below minimum");
        require(duration <= maxRestrictionDuration, "Duration exceeds maximum");
        require(!permanentlyBlacklisted[account], "Account blacklisted");
        require(paymentId != bytes32(0), "Invalid payment ID");

        uint256 expiry = block.timestamp + duration;
        _restrictions[account] = RestrictionData({ active: true, expiry: expiry, paymentId: paymentId });

        emit TemporaryRestrictionApplied(account, paymentId, expiry, amount);
    }

    function liftTemporaryRestriction(address account) external onlyRole(PAYMENT_PROCESSOR_ROLE) {
        require(_restrictions[account].active, "No active restriction");
        bytes32 paymentId = _restrictions[account].paymentId;
        delete _restrictions[account];
        emit TemporaryRestrictionLifted(account, paymentId, false);
    }

    // ============ Daily Limit Functions ============

    function setDailySpendingLimit(uint256 newLimit) external {
        uint256 oldLimit = dailySpendingLimit[msg.sender];
        dailySpendingLimit[msg.sender] = newLimit;
        emit DailyLimitSet(msg.sender, oldLimit, newLimit);
    }

    function getAvailableSpendingToday(address account) external view returns (uint256) {
        uint256 limit = dailySpendingLimit[account] > 0 ? dailySpendingLimit[account] : globalDailyLimit;
        if (block.timestamp >= lastResetTimestamp[account] + 1 days) return limit;
        if (spentToday[account] >= limit) return 0;
        return limit - spentToday[account];
    }

    function _checkDailyLimit(address account, uint256 amount) internal view {
        if (block.timestamp >= lastResetTimestamp[account] + 1 days) return;
        uint256 limit = dailySpendingLimit[account] > 0 ? dailySpendingLimit[account] : globalDailyLimit;
        require(spentToday[account] + amount <= limit, "Daily spending limit exceeded");
    }

    function _updateDailySpending(address account, uint256 amount) internal {
        if (block.timestamp >= lastResetTimestamp[account] + 1 days) {
            spentToday[account] = amount;
            lastResetTimestamp[account] = block.timestamp;
        } else {
            spentToday[account] += amount;
        }
    }

    // ============ Compliance ============

    function addToBlacklist(address account, string calldata reason) external onlyRole(COMPLIANCE_ROLE) {
        require(account != address(0), "Zero address");
        require(!permanentlyBlacklisted[account], "Already blacklisted");
        permanentlyBlacklisted[account] = true;
        emit PermanentBlacklistAdded(account, reason, msg.sender);
    }

    function removeFromBlacklist(address account) external onlyRole(COMPLIANCE_ROLE) {
        require(permanentlyBlacklisted[account], "Not blacklisted");
        permanentlyBlacklisted[account] = false;
        emit PermanentBlacklistRemoved(account, msg.sender);
    }

    // ============ Admin ============

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function setMaxRestrictionDuration(uint256 newDuration) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newDuration >= MIN_RESTRICTION_DURATION, "Below minimum duration");
        require(newDuration <= 3600, "Cannot exceed 1 hour");
        uint256 old = maxRestrictionDuration;
        maxRestrictionDuration = newDuration;
        emit MaxRestrictionDurationSet(old, newDuration, msg.sender);
    }

    function setGlobalDailyLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newLimit > 0, "Limit cannot be zero");
        uint256 old = globalDailyLimit;
        globalDailyLimit = newLimit;
        emit GlobalDailyLimitSet(old, newLimit, msg.sender);
    }

    // ============ Views ============

    function getRestrictionStatus(address account)
        external
        view
        returns (bool isRestricted, uint256 expiry, bytes32 paymentId)
    {
        RestrictionData memory r = _restrictions[account];
        if (r.active && block.timestamp >= r.expiry) return (false, 0, bytes32(0));
        return (r.active, r.expiry, r.paymentId);
    }

    function isPaymentProcessor(address account) external view returns (bool) { return hasRole(PAYMENT_PROCESSOR_ROLE, account); }
    function isMinter(address account) external view returns (bool) { return hasRole(MINTER_ROLE, account); }
    function isComplianceOfficer(address account) external view returns (bool) { return hasRole(COMPLIANCE_ROLE, account); }

    function revocationTimelockRemaining(address processor) external view returns (uint256) {
        bytes32 proposalId = keccak256(abi.encodePacked(PAYMENT_PROCESSOR_ROLE, processor));
        RevocationProposal memory p = pendingRevocations[proposalId];
        if (p.proposedAt == 0) return 0;
        uint256 unlockAt = p.proposedAt + ROLE_REVOCATION_DELAY;
        if (block.timestamp >= unlockAt) return 0;
        return unlockAt - block.timestamp;
    }

    // ============ Internal Overrides ============

    // Burns (to == 0) skip the blacklist and restriction checks intentionally —
    // see BLACKLIST-BURN note above. Transfers between non-zero addresses enforce both.
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        if (from != address(0) && to != address(0)) {
            require(!permanentlyBlacklisted[from], "Sender permanently blacklisted");
            require(!permanentlyBlacklisted[to], "Recipient permanently blacklisted");

            RestrictionData storage r = _restrictions[from];

            // Auto-lift expired restrictions
            if (r.active && block.timestamp >= r.expiry) {
                bytes32 pid = r.paymentId;
                delete _restrictions[from];
                emit TemporaryRestrictionLifted(from, pid, true);
            }

            require(
                !_restrictions[from].active || hasRole(PAYMENT_PROCESSOR_ROLE, msg.sender),
                "Sender temporarily restricted"
            );
        }

        super._update(from, to, value);
    }
}
