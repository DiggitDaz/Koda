// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title USDKReserveOracle
 * @notice Oracle contract for USDK stablecoin reserve attestations
 * @dev Allows authorized parties to submit reserve data and attestations
 */
contract USDKReserveOracle is AccessControl, Pausable {
    
    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RESERVE_MANAGER_ROLE = keccak256("RESERVE_MANAGER_ROLE");
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");
    
    // Reserve declaration data
    struct ReserveDeclaration {
        uint256 timestamp;
        uint256 totalReserves;        // Total reserves in USD (6dcm)
        uint256 usdkSupply;            // Total USDK in circulation (6 dcm)
        uint256 collateralRatio;       // Ratio in basis points (10000 = 100%)
        string reportHash;             // IPFS hash/URL detailed report
        address declaredBy;
        bool isActive;
    }
    
    // Third-party attestation
    struct Attestation {
        uint256 timestamp;
        uint256 declarationId;
        address attestor;
        bool approved;
        string attestationHash;        // IPFS hash/URL to attestation document
        string comments;
    }
    
    
    uint256 public declarationCounter;
    uint256 public attestationCounter;
    
    // Mappings
    mapping(uint256 => ReserveDeclaration) public declarations;
    mapping(uint256 => Attestation) public attestations;
    mapping(uint256 => uint256[]) public declarationToAttestations; // declaration ID => attestation IDs
    mapping(address => bool) public authorizedAttestors;
    
    // Current active declaration
    uint256 public currentDeclarationId;
    
    // Events
    event DeclarationSubmitted(
        uint256 indexed declarationId,
        uint256 totalReserves,
        uint256 usdkSupply,
        uint256 collateralRatio,
        address declaredBy
    );
    
    event AttestationSubmitted(
        uint256 indexed attestationId,
        uint256 indexed declarationId,
        address attestor,
        bool approved
    );
    
    event AttestorAuthorized(address indexed attestor, bool status);
    
    event DeclarationActivated(uint256 indexed declarationId);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(RESERVE_MANAGER_ROLE, msg.sender);
    }
    
    /**
     * @notice Submit a new reserve declaration
     * @param _totalReserves Total reserves in USD (6 dcm)
     * @param _usdkSupply Total USDK supply (6 dcm)
     * @param _reportHash IPFS hash or URL to detailed report
     */
    function submitDeclaration(
        uint256 _totalReserves,
        uint256 _usdkSupply,
        string memory _reportHash
    ) external onlyRole(RESERVE_MANAGER_ROLE) whenNotPaused returns (uint256) {
        require(_totalReserves > 0, "Reserves must be greater than 0");
        require(_usdkSupply > 0, "Supply must be greater than 0");
        require(bytes(_reportHash).length > 0, "Report hash required");
        
        declarationCounter++;
        uint256 declarationId = declarationCounter;
        
        // Calculate collateral ratio 
        uint256 collateralRatio = (_totalReserves * 10000) / _usdkSupply;
        
        declarations[declarationId] = ReserveDeclaration({
            timestamp: block.timestamp,
            totalReserves: _totalReserves,
            usdkSupply: _usdkSupply,
            collateralRatio: collateralRatio,
            reportHash: _reportHash,
            declaredBy: msg.sender,
            isActive: false
        });
        
        emit DeclarationSubmitted(
            declarationId,
            _totalReserves,
            _usdkSupply,
            collateralRatio,
            msg.sender
        );
        
        return declarationId;
    }
    
    /**
     * @notice Submit attestation for a declaration
     * @param _declarationId ID of the declaration being attested
     * @param _approved Whether the attestation approves the declaration
     * @param _attestationHash IPFS hash or URL to attestation document
     * @param _comments Additional comments
     */
    function submitAttestation(
        uint256 _declarationId,
        bool _approved,
        string memory _attestationHash,
        string memory _comments
    ) external onlyRole(ATTESTOR_ROLE) whenNotPaused returns (uint256) {
        require(_declarationId > 0 && _declarationId <= declarationCounter, "Invalid declaration ID");
        require(bytes(_attestationHash).length > 0, "Attestation hash required");
        
        attestationCounter++;
        uint256 attestationId = attestationCounter;
        
        attestations[attestationId] = Attestation({
            timestamp: block.timestamp,
            declarationId: _declarationId,
            attestor: msg.sender,
            approved: _approved,
            attestationHash: _attestationHash,
            comments: _comments
        });
        
        declarationToAttestations[_declarationId].push(attestationId);
        
        emit AttestationSubmitted(attestationId, _declarationId, msg.sender, _approved);
        
        return attestationId;
    }
    
    /**
     * @notice Activate a declaration as the current official declaration
     * @param _declarationId ID of declaration to activate
     */
    function activateDeclaration(uint256 _declarationId) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(_declarationId > 0 && _declarationId <= declarationCounter, "Invalid declaration ID");
        
        // Deactivate previous declaration
        if (currentDeclarationId > 0) {
            declarations[currentDeclarationId].isActive = false;
        }
        
        // Activate new declaration
        declarations[_declarationId].isActive = true;
        currentDeclarationId = _declarationId;
        
        emit DeclarationActivated(_declarationId);
    }
    
    /**
     * @notice Get current active reserve declaration
     */
    function getCurrentDeclaration() 
        external 
        view 
        returns (
            uint256 declarationId,
            uint256 timestamp,
            uint256 totalReserves,
            uint256 usdkSupply,
            uint256 collateralRatio,
            string memory reportHash,
            address declaredBy
        ) 
    {
        require(currentDeclarationId > 0, "No active declaration");
        
        ReserveDeclaration memory decl = declarations[currentDeclarationId];
        
        return (
            currentDeclarationId,
            decl.timestamp,
            decl.totalReserves,
            decl.usdkSupply,
            decl.collateralRatio,
            decl.reportHash,
            decl.declaredBy
        );
    }
    
    /**
     * @notice Get specific declaration by ID
     */
    function getDeclaration(uint256 _declarationId) 
        external 
        view 
        returns (
            uint256 timestamp,
            uint256 totalReserves,
            uint256 usdkSupply,
            uint256 collateralRatio,
            string memory reportHash,
            address declaredBy,
            bool isActive
        ) 
    {
        require(_declarationId > 0 && _declarationId <= declarationCounter, "Invalid declaration ID");
        
        ReserveDeclaration memory decl = declarations[_declarationId];
        
        return (
            decl.timestamp,
            decl.totalReserves,
            decl.usdkSupply,
            decl.collateralRatio,
            decl.reportHash,
            decl.declaredBy,
            decl.isActive
        );
    }
    
    /**
     * @notice Get all attestations for a declaration
     */
    function getDeclarationAttestations(uint256 _declarationId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return declarationToAttestations[_declarationId];
    }
    
    /**
     * @notice Get specific attestation details
     */
    function getAttestation(uint256 _attestationId) 
        external 
        view 
        returns (
            uint256 timestamp,
            uint256 declarationId,
            address attestor,
            bool approved,
            string memory attestationHash,
            string memory comments
        ) 
    {
        require(_attestationId > 0 && _attestationId <= attestationCounter, "Invalid attestation ID");
        
        Attestation memory att = attestations[_attestationId];
        
        return (
            att.timestamp,
            att.declarationId,
            att.attestor,
            att.approved,
            att.attestationHash,
            att.comments
        );
    }
    
    /**
     * @notice Get current collateral ratio
     */
    function getCurrentCollateralRatio() external view returns (uint256) {
        require(currentDeclarationId > 0, "No active declaration");
        return declarations[currentDeclarationId].collateralRatio;
    }
    
    /**
     * @notice Check if current reserves are fully backed
     */
    function isFullyBacked() external view returns (bool) {
        require(currentDeclarationId > 0, "No active declaration");
        return declarations[currentDeclarationId].collateralRatio >= 10000;
    }
    
    /**
     * @notice Grant attestor role to an address
     */
    function authorizeAttestor(address _attestor) external onlyRole(ADMIN_ROLE) {
        grantRole(ATTESTOR_ROLE, _attestor);
        authorizedAttestors[_attestor] = true;
        emit AttestorAuthorized(_attestor, true);
    }
    
    /**
     * @notice Revoke attestor role from an address
     */
    function revokeAttestor(address _attestor) external onlyRole(ADMIN_ROLE) {
        revokeRole(ATTESTOR_ROLE, _attestor);
        authorizedAttestors[_attestor] = false;
        emit AttestorAuthorized(_attestor, false);
    }
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}