// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract tHX {
    
    // Token Details
    string public constant name = "tHX Token";
    string public constant symbol = "tHX";
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 10_000_000_000 * 10**18; // 10 billion
    
    // State Variables
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    address public owner;
    
    // Events 
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    /**
     * @dev Constructor - mints entire supply to deployer
     */
    constructor() {
        owner = msg.sender;
        _balances[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    
    // ERC20 STANDARD FUNCTIONS
    
    /**
     * @dev Returns the balance of an account
     */
    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }
    
    /**
     * @dev Transfer tokens to a specified address
     */
    function transfer(address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    /**
     * @dev Returns the allowance of spender for owner's tokens
     */
    function allowance(address tokenOwner, address spender) public view returns (uint256) {
        return _allowances[tokenOwner][spender];
    }
    
    /**
     * @dev Approve spender to spend tokens on behalf of msg.sender
     */
    function approve(address spender, uint256 amount) public returns (bool) {
        require(spender != address(0), "Approve to zero address");
        
        _allowances[msg.sender][spender] = amount;
        
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    /**
     * @dev Transfer tokens from one address to another using allowance
     */
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(_balances[from] >= amount, "Insufficient balance");
        require(_allowances[from][msg.sender] >= amount, "Allowance exceeded");
        
        _balances[from] -= amount;
        _balances[to] += amount;
        _allowances[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    /**
     * @dev Increase the allowance granted to spender
     */
    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        require(spender != address(0), "Approve to zero address");
        
        _allowances[msg.sender][spender] += addedValue;
        
        emit Approval(msg.sender, spender, _allowances[msg.sender][spender]);
        return true;
    }
    
    /**
     * @dev Decrease the allowance granted to spender
     
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        require(spender != address(0), "Approve to zero address");
        require(_allowances[msg.sender][spender] >= subtractedValue, "Decreased allowance below zero");
        
        _allowances[msg.sender][spender] -= subtractedValue;
        
        emit Approval(msg.sender, spender, _allowances[msg.sender][spender]);
        return true;
    }
    
    // BURNABLE FUNCTIONS
    
    /**
     * @dev Burn tokens from caller's account
     */
    function burn(uint256 amount) public returns (bool) {
        require(_balances[msg.sender] >= amount, "Burn amount exceeds balance");
        
        _balances[msg.sender] -= amount;
        
        emit Transfer(msg.sender, address(0), amount);
        return true;
    }
    
    /**
     * @dev Burn tokens from another account (requires allowance)
     */
    function burnFrom(address account, uint256 amount) public returns (bool) {
        require(_balances[account] >= amount, "Burn amount exceeds balance");
        require(_allowances[account][msg.sender] >= amount, "Burn amount exceeds allowance");
        
        _balances[account] -= amount;
        _allowances[account][msg.sender] -= amount;
        
        emit Transfer(account, address(0), amount);
        return true;
    }
    
    // OWNER FUNCTIONS
    
    /**
     * @dev Transfer ownership to a new address
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @dev Renounce ownership
     */
    function renounceOwnership() public onlyOwner {
        address oldOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(oldOwner, address(0));
    }
}