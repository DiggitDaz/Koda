// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * USDH Stablecoin for Hydrix Chain
 * @dev Complete ERC20 stablecoin implementation with security features
 */
contract USDH {
    
    // Token Information
    string public constant name = "Hydrix USD";
    string public constant symbol = "USDH";
    uint8 public constant decimals = 18;
    
    // State Variables
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    
    // Access Control
    address public owner;
    mapping(address => bool) public minters;
    mapping(address => bool) public burners;
    mapping(address => bool) public blacklisted;
    
    // Security
    bool public paused;
    uint256 private _guardCounter = 1;
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);
    event BurnerAdded(address indexed account);
    event BurnerRemoved(address indexed account);
    event Blacklisted(address indexed account);
    event UnBlacklisted(address indexed account);
    event Paused(address account);
    event Unpaused(address account);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "USDH: caller is not the owner");
        _;
    }
    
    modifier onlyMinter() {
        require(minters[msg.sender], "USDH: caller is not a minter");
        _;
    }
    
    modifier onlyBurner() {
        require(burners[msg.sender], "USDH: caller is not a burner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "USDH: paused");
        _;
    }
    
    modifier whenPaused() {
        require(paused, "USDH: not paused");
        _;
    }
    
    modifier notBlacklisted(address account) {
        require(!blacklisted[account], "USDH: account is blacklisted");
        _;
    }
    
    modifier nonReentrant() {
        _guardCounter += 1;
        uint256 guard = _guardCounter;
        _;
        require(guard == _guardCounter, "USDH: reentrant call");
    }
    
    /**
     * @dev Constructor - Sets deployer as owner and grants initial permissions
     */
    constructor() {
        owner = msg.sender;
        minters[msg.sender] = true;
        burners[msg.sender] = true;
        paused = false;
        
        emit OwnershipTransferred(address(0), msg.sender);
        emit MinterAdded(msg.sender);
        emit BurnerAdded(msg.sender);
    }
    
    // ERC20 CORE FUNCTIONS 
    
    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }
    
    function allowance(address holder, address spender) public view returns (uint256) {
        return _allowances[holder][spender];
    }
    
    function transfer(address to, uint256 amount) 
        public 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(to) 
        returns (bool) 
    {
        _transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) 
        public 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(spender) 
        returns (bool) 
    {
        _approve(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) 
        public 
        whenNotPaused 
        notBlacklisted(msg.sender) 
        notBlacklisted(from) 
        notBlacklisted(to) 
        returns (bool) 
    {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }
    
    function increaseAllowance(address spender, uint256 addedValue) 
        public 
        whenNotPaused 
        returns (bool) 
    {
        _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
        return true;
    }
    
    function decreaseAllowance(address spender, uint256 subtractedValue) 
        public 
        whenNotPaused 
        returns (bool) 
    {
        uint256 currentAllowance = _allowances[msg.sender][spender];
        require(currentAllowance >= subtractedValue, "USDH: decreased allowance below zero");
        unchecked {
            _approve(msg.sender, spender, currentAllowance - subtractedValue);
        }
        return true;
    }
    
    // MINTING & BURNING 
    
    function mint(address to, uint256 amount) 
        public 
        onlyMinter 
        whenNotPaused 
        notBlacklisted(to) 
        nonReentrant 
        returns (bool) 
    {
        require(to != address(0), "USDH: mint to zero address");
        require(amount > 0, "USDH: amount must be greater than zero");
        
        _totalSupply += amount;
        unchecked {
            _balances[to] += amount;
        }
        
        emit Transfer(address(0), to, amount);
        emit Mint(to, amount);
        return true;
    }
    
    function burn(uint256 amount) 
        public 
        whenNotPaused 
        nonReentrant 
        returns (bool) 
    {
        _burn(msg.sender, amount);
        return true;
    }
    
    function burnFrom(address from, uint256 amount) 
        public 
        onlyBurner 
        whenNotPaused 
        notBlacklisted(from) 
        nonReentrant 
        returns (bool) 
    {
        _burn(from, amount);
        return true;
    }
    
    // ACCESS CONTROL 
    
    function addMinter(address account) public onlyOwner {
        require(account != address(0), "USDH: zero address");
        require(!minters[account], "USDH: already a minter");
        minters[account] = true;
        emit MinterAdded(account);
    }
    
    function removeMinter(address account) public onlyOwner {
        require(minters[account], "USDH: not a minter");
        minters[account] = false;
        emit MinterRemoved(account);
    }
    
    function addBurner(address account) public onlyOwner {
        require(account != address(0), "USDH: zero address");
        require(!burners[account], "USDH: already a burner");
        burners[account] = true;
        emit BurnerAdded(account);
    }
    
    function removeBurner(address account) public onlyOwner {
        require(burners[account], "USDH: not a burner");
        burners[account] = false;
        emit BurnerRemoved(account);
    }
    
    function blacklistAddress(address account) public onlyOwner {
        require(account != address(0), "USDH: zero address");
        require(!blacklisted[account], "USDH: already blacklisted");
        blacklisted[account] = true;
        emit Blacklisted(account);
    }
    
    function unBlacklistAddress(address account) public onlyOwner {
        require(blacklisted[account], "USDH: not blacklisted");
        blacklisted[account] = false;
        emit UnBlacklisted(account);
    }
    
    // PAUSE CONTROL 
    
    function pause() public onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }
    
    function unpause() public onlyOwner whenPaused {
        paused = false;
        emit Unpaused(msg.sender);
    }
    
    //  OWNERSHIP 
    
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "USDH: new owner is zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    function renounceOwnership() public onlyOwner {
        address oldOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(oldOwner, address(0));
    }
    
    // INTERNAL FUNCTIONS 
    
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "USDH: transfer from zero address");
        require(to != address(0), "USDH: transfer to zero address");
        
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "USDH: transfer amount exceeds balance");
        
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }
        
        emit Transfer(from, to, amount);
    }
    
    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "USDH: burn from zero address");
        require(amount > 0, "USDH: amount must be greater than zero");
        
        uint256 accountBalance = _balances[from];
        require(accountBalance >= amount, "USDH: burn amount exceeds balance");
        
        unchecked {
            _balances[from] = accountBalance - amount;
            _totalSupply -= amount;
        }
        
        emit Transfer(from, address(0), amount);
        emit Burn(from, amount);
    }
    
    function _approve(address holder, address spender, uint256 amount) internal {
        require(holder != address(0), "USDH: approve from zero address");
        require(spender != address(0), "USDH: approve to zero address");
        
        _allowances[holder][spender] = amount;
        emit Approval(holder, spender, amount);
    }
    
    function _spendAllowance(address holder, address spender, uint256 amount) internal {
        uint256 currentAllowance = _allowances[holder][spender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "USDH: insufficient allowance");
            unchecked {
                _approve(holder, spender, currentAllowance - amount);
            }
        }
    }
}