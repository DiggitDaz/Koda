// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ITAPUSDCMintBurn {
    function mint(address to, uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
    function totalSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract TAPUSDCWrapper is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Immutables ============

    /// @notice USDC token (Arc native precompile ERC20 interface)
    IERC20 public immutable USDC;

    /// @notice TAPUSDC token this wrapper mints/burns
    ITAPUSDCMintBurn public immutable TAPUSDC;

    // ============ Emergency Rescue (timelock system) ============

    uint256 public constant RESCUE_DELAY = 48 hours;

    struct RescueProposal {
        address recipient;
        uint256 proposedAt;
        bool executed;
    }

    RescueProposal public pendingRescue;

    // ============ Events ============

    event Deposited(address indexed user, uint256 usdcAmount, uint256 tapusdcMinted);
    event Withdrawn(address indexed user, uint256 tapusdcBurned, uint256 usdcReturned);

    event RescueProposed(address indexed recipient, uint256 executeAfter, uint256 surplusAmount);
    event RescueCancelled(address indexed cancelledBy);
    event RescueExecuted(address indexed recipient, uint256 usdcAmount);

    event ERC20Rescued(address indexed token, address indexed recipient, uint256 amount);

    // ============ Constructor ============

    /**
     * @param _usdc     USDC token address (Arc precompile: 0x3600...)
     * @param _tapusdc  TAPUSDC token contract address
     * @param _owner    Owner address (recommended: multisig in prod)
     *
     * After deployment:
     * - call tapusdc.addMinter(address(this)) so wrapper can mint
     */
    constructor(
        address _usdc,
        address _tapusdc,
        address _owner
    ) Ownable(_owner) {
        require(_usdc != address(0), "USDC address cannot be zero");
        require(_tapusdc != address(0), "TAPUSDC address cannot be zero");
        require(_owner != address(0), "Owner cannot be zero address");

        USDC = IERC20(_usdc);
        TAPUSDC = ITAPUSDCMintBurn(_tapusdc);
    }

    // ============ Deposit Flow ============

    /**
     * @notice Deposit USDC and mint TAPUSDC 1:1
     *
     * User must approve USDC first.
     * Contract must not be paused.
     *
     * @param amount amount of USDC (6 decimals expected)
     */
    function deposit(uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        require(amount > 0, "Amount must be greater than zero");

        USDC.safeTransferFrom(msg.sender, address(this), amount);

        TAPUSDC.mint(msg.sender, amount);

        emit Deposited(msg.sender, amount, amount);
    }

    // ============ Withdraw Flow ============

    /**
     * @notice Burn TAPUSDC and redeem USDC 1:1
     *
     * User must approve TAPUSDC burn allowance first.
     * Contract must not be paused.
     *
     * @param amount amount of TAPUSDC to burn
     */
    function withdraw(uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        require(amount > 0, "Amount must be greater than zero");

        require(
            USDC.balanceOf(address(this)) >= amount,
            "Insufficient USDC reserves"
        );

        TAPUSDC.burnFrom(msg.sender, amount);

        USDC.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount, amount);
    }

    // ============ Admin Controls ============

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Emergency Rescue (timelocked surplus only) ============

    /**
     * @notice Step 1: propose a rescue for surplus USDC
     *
     * Must be paused before calling.
     * Only allows withdrawal of excess USDC above total TAPUSDC supply.
     *
     * 48h delay starts once proposed.
     */
    function proposeRescue(address recipient)
        external
        onlyOwner
        whenPaused
    {
        require(recipient != address(0), "Recipient cannot be zero address");
        require(pendingRescue.proposedAt == 0 || pendingRescue.executed, "Rescue already pending");

        uint256 vaultBalance = USDC.balanceOf(address(this));
        uint256 totalOwed = TAPUSDC.totalSupply();
        uint256 surplusAmount = vaultBalance > totalOwed ? vaultBalance - totalOwed : 0;

        require(surplusAmount > 0, "No surplus USDC to rescue");

        pendingRescue = RescueProposal({
            recipient: recipient,
            proposedAt: block.timestamp,
            executed: false
        });

        emit RescueProposed(recipient, block.timestamp + RESCUE_DELAY, surplusAmount);
    }

    /**
     * @notice Step 2: execute rescue after timelock
     *
     * Surplus is recalculated at execution time, so new deposits
     * reduce available rescue amount automatically.
     */
    function executeRescue()
        external
        onlyOwner
        whenPaused
        nonReentrant
    {
        require(pendingRescue.proposedAt != 0, "No rescue proposed");
        require(!pendingRescue.executed, "Rescue already executed");
        require(
            block.timestamp >= pendingRescue.proposedAt + RESCUE_DELAY,
            "Timelock not elapsed 48 hours required"
        );

        address recipient = pendingRescue.recipient;

        uint256 vaultBalance = USDC.balanceOf(address(this));
        uint256 totalOwed   = TAPUSDC.totalSupply();
        uint256 surplusAmount = vaultBalance > totalOwed ? vaultBalance - totalOwed : 0;

        require(surplusAmount > 0, "No surplus to rescue");

        pendingRescue.executed = true;

        USDC.safeTransfer(recipient, surplusAmount);

        emit RescueExecuted(recipient, surplusAmount);
    }

    /**
     * @notice Cancel a pending rescue request
     *
     * Can be used if proposal was made by mistake or key compromise suspected.
     */
    function cancelRescue() external onlyOwner {
        require(pendingRescue.proposedAt != 0, "No rescue pending");
        require(!pendingRescue.executed, "Already executed");

        delete pendingRescue;

        emit RescueCancelled(msg.sender);
    }

    /**
     * @notice Recover accidentally sent ERC20 tokens (non-USDC only)
     *
     * USDC is excluded and must go through timelocked rescue system.
     */
    function rescueERC20(
        address token,
        address recipient,
        uint256 amount
    )
        external
        onlyOwner
        nonReentrant
    {
        require(token != address(USDC), "Use timelocked rescue for USDC");
        require(recipient != address(0), "Recipient cannot be zero address");
        require(amount > 0, "Amount must be greater than zero");

        IERC20(token).safeTransfer(recipient, amount);

        emit ERC20Rescued(token, recipient, amount);
    }

    // ============ Views ============

    /**
     * @notice USDC held by contract
     */
    function reserves() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    /**
     * @notice Total TAPUSDC in circulation
     * Should match reserves in normal conditions
     */
    function circulatingSupply() external view returns (uint256) {
        return TAPUSDC.totalSupply();
    }

    /**
     * @notice Shows excess USDC not backing supply
     */
    function surplus() external view returns (uint256) {
        uint256 bal = USDC.balanceOf(address(this));
        uint256 sup = TAPUSDC.totalSupply();
        return bal > sup ? bal - sup : 0;
    }

    /**
     * @notice Time remaining until rescue can be executed
     */
    function rescueTimelockRemaining() external view returns (uint256) {
        if (pendingRescue.proposedAt == 0 || pendingRescue.executed) return 0;
        uint256 unlockAt = pendingRescue.proposedAt + RESCUE_DELAY;
        if (block.timestamp >= unlockAt) return 0;
        return unlockAt - block.timestamp;
    }
}
