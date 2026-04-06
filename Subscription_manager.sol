// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
}

contract SubscriptionManager {
    
    // STATE VARIABLES
    
    address private _owner;
    uint256 private _status;
    
    struct Subscription {
        uint256 amount;
        uint256 nextPaymentDate;
        uint256 remaining;
        uint256 totalPayments;
        uint256 createdAt;
        bool isActive;
    }
    
    mapping(address => mapping(string => Subscription)) public subscriptions;
    mapping(address => string[]) private _userSubscriptionNames;
    mapping(address => mapping(string => uint256)) private _nameToIndex;
    mapping(address => bool) public whitelistedRecipients;
    mapping(address => bool) public whitelistedTokens;
    
    uint256 public totalSubscriptions;
    uint256 public activeSubscriptions;
    uint256 public totalPaymentsProcessed;
    uint256 public paymentInterval = 300;
    
    // EVENTS
    
    event SubscriptionCreated(address indexed user, string subscriptionName, uint256 amount, uint256 nextPaymentDate);
    event PaymentPulled(address indexed user, string subscriptionName, address indexed token, address indexed destination, uint256 amount);
    event SubscriptionCancelled(address indexed user, string subscriptionName);
    event SubscriptionPaused(address indexed user, string subscriptionName);
    event SubscriptionResumed(address indexed user, string subscriptionName);
    event RecipientWhitelisted(address indexed recipient, bool status);
    event TokenWhitelisted(address indexed token, bool status);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    //  MODIFIERS
    
    modifier onlyOwner() {
        require(_owner == msg.sender, "Not owner");
        _;
    }
    
    modifier nonReentrant() {
        require(_status != 2, "ReentrancyGuard: reentrant call");
        _status = 2;
        _;
        _status = 1;
    }
    
    // CONSTRUCTOR
    
    constructor() {
        _owner = msg.sender;
        _status = 1;
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    // SUBSCRIPTION MANAGEMENT 
    
    function subscribe(
        string memory subscriptionName,
        uint256 amount,
        uint256 nextPaymentDate,
        uint256 numberOfPayments
    ) external {
        require(bytes(subscriptionName).length > 0, "Empty name");
        require(subscriptions[msg.sender][subscriptionName].createdAt == 0, "Already exists");
        require(amount > 0, "Amount zero");
        require(numberOfPayments > 0, "Payments zero");
        require(nextPaymentDate > block.timestamp, "Invalid date");
        
        subscriptions[msg.sender][subscriptionName] = Subscription({
            amount: amount,
            nextPaymentDate: nextPaymentDate,
            remaining: numberOfPayments,
            totalPayments: numberOfPayments,
            createdAt: block.timestamp,
            isActive: true
        });
        
        _userSubscriptionNames[msg.sender].push(subscriptionName);
        _nameToIndex[msg.sender][subscriptionName] = _userSubscriptionNames[msg.sender].length - 1;
        
        totalSubscriptions++;
        activeSubscriptions++;
        
        emit SubscriptionCreated(msg.sender, subscriptionName, amount, nextPaymentDate);
    }
    
    function cancelSubscription(string memory subscriptionName) external {
        Subscription storage sub = subscriptions[msg.sender][subscriptionName];
        require(sub.createdAt > 0, "Does not exist");
        require(sub.remaining > 0, "Already completed");
        
        _removeSubscription(msg.sender, subscriptionName);
        emit SubscriptionCancelled(msg.sender, subscriptionName);
    }
    
    function toggleSubscription(string memory subscriptionName, bool pause) external {
        Subscription storage sub = subscriptions[msg.sender][subscriptionName];
        require(sub.createdAt > 0, "Does not exist");
        require(sub.remaining > 0, "Already completed");
        
        if (pause && sub.isActive) {
            sub.isActive = false;
            if (activeSubscriptions > 0) activeSubscriptions--;
            emit SubscriptionPaused(msg.sender, subscriptionName);
        } else if (!pause && !sub.isActive) {
            sub.isActive = true;
            activeSubscriptions++;
            emit SubscriptionResumed(msg.sender, subscriptionName);
        }
    }
    
    // PAYMENT PROCESSING
    
    function pullPayment(
        address user,
        string memory subscriptionName,
        address tokenAddress,
        address destination
    ) external onlyOwner nonReentrant {
        require(whitelistedTokens[tokenAddress], "Token not whitelisted");
        require(whitelistedRecipients[destination], "Recipient not whitelisted");
        
        Subscription storage sub = subscriptions[user][subscriptionName];
        
        require(sub.createdAt > 0, "Does not exist");
        require(sub.remaining > 0, "No payments left");
        require(sub.isActive, "Not active");
        require(block.timestamp >= sub.nextPaymentDate, "Not due");
        
        uint256 paymentAmount = sub.amount;
        sub.remaining--;
        totalPaymentsProcessed++;
        
        if (sub.remaining == 0) {
            _removeSubscription(user, subscriptionName);
        } else {
            sub.nextPaymentDate = sub.nextPaymentDate + paymentInterval;
        }
        
        // Manual safe transfer
        IERC20 token = IERC20(tokenAddress);
        (bool success, bytes memory data) = tokenAddress.call(
            abi.encodeWithSelector(token.transferFrom.selector, user, destination, paymentAmount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");
        
        emit PaymentPulled(user, subscriptionName, tokenAddress, destination, paymentAmount);
    }
    
    // VIEW FUNCTIONS ==========
    
    function getUserSubscriptionNames(address user) external view returns (string[] memory) {
        return _userSubscriptionNames[user];
    }
    
    function getUserActiveSubscriptions(address user) 
        external 
        view 
        returns (string[] memory subscriptionNames, Subscription[] memory subscriptionData) 
    {
        string[] memory allNames = _userSubscriptionNames[user];
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < allNames.length; i++) {
            Subscription memory sub = subscriptions[user][allNames[i]];
            if (sub.isActive && sub.remaining > 0) {
                activeCount++;
            }
        }
        
        subscriptionNames = new string[](activeCount);
        subscriptionData = new Subscription[](activeCount);
        
        uint256 index = 0;
        for (uint256 i = 0; i < allNames.length; i++) {
            Subscription memory sub = subscriptions[user][allNames[i]];
            if (sub.isActive && sub.remaining > 0) {
                subscriptionNames[index] = allNames[i];
                subscriptionData[index] = sub;
                index++;
            }
        }
        
        return (subscriptionNames, subscriptionData);
    }
    
    function isPaymentDue(address user, string memory subscriptionName) external view returns (bool) {
        Subscription memory sub = subscriptions[user][subscriptionName];
        return sub.isActive && sub.remaining > 0 && block.timestamp >= sub.nextPaymentDate;
    }
    
    function getContractStats() external view returns (uint256, uint256, uint256) {
        return (totalSubscriptions, activeSubscriptions, totalPaymentsProcessed);
    }
    
    function owner() external view returns (address) {
        return _owner;
    }
    
    // ADMIN FUNCTIONS 
    
    function setRecipientWhitelist(address recipient, bool status) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        whitelistedRecipients[recipient] = status;
        emit RecipientWhitelisted(recipient, status);
    }
    
    function setTokenWhitelist(address token, bool status) external onlyOwner {
        require(token != address(0), "Invalid token");
        whitelistedTokens[token] = status;
        emit TokenWhitelisted(token, status);
    }
    
    function setPaymentInterval(uint256 newInterval) external onlyOwner {
        require(newInterval > 0, "Invalid interval");
        paymentInterval = newInterval;
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(whitelistedTokens[token], "Token not whitelisted");
        IERC20 tokenContract = IERC20(token);
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(tokenContract.transfer.selector, _owner, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Transfer failed");
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    function renounceOwnership() external onlyOwner {
        address oldOwner = _owner;
        _owner = address(0);
        emit OwnershipTransferred(oldOwner, address(0));
    }
    
    // INTERNAL FUNCTIONS 
    
    function _removeSubscription(address user, string memory subscriptionName) private {
        if (subscriptions[user][subscriptionName].isActive && activeSubscriptions > 0) {
            activeSubscriptions--;
        }
        
        uint256 index = _nameToIndex[user][subscriptionName];
        uint256 lastIndex = _userSubscriptionNames[user].length - 1;
        
        if (index != lastIndex) {
            string memory lastName = _userSubscriptionNames[user][lastIndex];
            _userSubscriptionNames[user][index] = lastName;
            _nameToIndex[user][lastName] = index;
        }
        
        _userSubscriptionNames[user].pop();
        delete _nameToIndex[user][subscriptionName];
        delete subscriptions[user][subscriptionName];
    }
}