// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateRegistry
 * @notice Tamper-proof storage and verification of academic certificates.
 *         Supports SDG 4 (Quality Education) by giving institutions a
 *         trustless, publicly verifiable way to issue and validate
 *         academic credentials, and giving anyone (employers, other
 *         universities, students) a way to instantly verify authenticity
 *         without contacting the issuing institution.
 *
 * Design:
 *  - Only addresses granted the ISSUER role (e.g. registrar's office,
 *    university admin) can issue or revoke certificates.
 *  - A certificate is identified by a unique certificateId (bytes32),
 *    typically keccak256 of (studentId + course + issueDate + nonce) —
 *    computed off-chain, so raw student data never touches the chain.
 *  - Only a hash of the certificate document (documentHash) is stored,
 *    not the document itself, preserving privacy while still allowing
 *    anyone to prove a given PDF/JSON matches what was issued.
 *  - Revocation is supported (e.g. certificate issued in error, or
 *    academic misconduct found later) without deleting history.
 */
contract CertificateRegistry {
    address public owner;

    struct Certificate {
        bytes32 documentHash;   // keccak256 hash of the certificate document/data
        address issuer;         // institution wallet that issued it
        string studentName;     // display name (kept minimal by design)
        string courseName;
        string institutionName;
        uint256 issueDate;      // unix timestamp
        bool revoked;
        bool exists;
    }

    mapping(bytes32 => Certificate) private certificates;   // certificateId => Certificate
    mapping(address => bool) public issuers;                // authorized issuing institutions

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event CertificateIssued(
        bytes32 indexed certificateId,
        address indexed issuer,
        bytes32 documentHash,
        string studentName,
        string courseName
    );
    event CertificateRevoked(bytes32 indexed certificateId, address indexed revokedBy, string reason);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier onlyIssuer() {
        require(issuers[msg.sender], "Not an authorized issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        issuers[msg.sender] = true; // deployer is an issuer by default
        emit IssuerAdded(msg.sender);
    }

    // ---------- Admin: manage authorized issuers ----------

    function addIssuer(address _issuer) external onlyOwner {
        require(_issuer != address(0), "Zero address");
        issuers[_issuer] = true;
        emit IssuerAdded(_issuer);
    }

    function removeIssuer(address _issuer) external onlyOwner {
        issuers[_issuer] = false;
        emit IssuerRemoved(_issuer);
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Zero address");
        owner = _newOwner;
    }

    // ---------- Core: issue & revoke ----------

    /**
     * @notice Issue a new certificate. certificateId should be computed
     *         off-chain as a unique hash so the same document can't be
     *         accidentally re-issued under a different ID.
     */
    function issueCertificate(
        bytes32 _certificateId,
        bytes32 _documentHash,
        string calldata _studentName,
        string calldata _courseName,
        string calldata _institutionName
    ) external onlyIssuer {
        require(!certificates[_certificateId].exists, "Certificate ID already exists");
        require(_documentHash != bytes32(0), "Document hash required");

        certificates[_certificateId] = Certificate({
            documentHash: _documentHash,
            issuer: msg.sender,
            studentName: _studentName,
            courseName: _courseName,
            institutionName: _institutionName,
            issueDate: block.timestamp,
            revoked: false,
            exists: true
        });

        emit CertificateIssued(_certificateId, msg.sender, _documentHash, _studentName, _courseName);
    }

    function revokeCertificate(bytes32 _certificateId, string calldata _reason) external onlyIssuer {
        require(certificates[_certificateId].exists, "Certificate does not exist");
        require(!certificates[_certificateId].revoked, "Already revoked");
        certificates[_certificateId].revoked = true;
        emit CertificateRevoked(_certificateId, msg.sender, _reason);
    }

    // ---------- Verification (read-only, callable by anyone) ----------

    /**
     * @notice Verify a certificate exists, is not revoked, and that the
     *         provided document hash matches what was originally issued.
     * @return isValid true only if it exists, hash matches, and not revoked
     */
    function verifyCertificate(bytes32 _certificateId, bytes32 _documentHash)
        external
        view
        returns (bool isValid, string memory status)
    {
        Certificate memory c = certificates[_certificateId];
        if (!c.exists) return (false, "Certificate not found");
        if (c.revoked) return (false, "Certificate revoked");
        if (c.documentHash != _documentHash) return (false, "Document hash mismatch (tampered or wrong file)");
        return (true, "Valid");
    }

    function getCertificate(bytes32 _certificateId)
        external
        view
        returns (
            bool exists,
            bool revoked,
            address issuer,
            bytes32 documentHash,
            string memory studentName,
            string memory courseName,
            string memory institutionName,
            uint256 issueDate
        )
    {
        Certificate memory c = certificates[_certificateId];
        return (c.exists, c.revoked, c.issuer, c.documentHash, c.studentName, c.courseName, c.institutionName, c.issueDate);
    }

    function isAuthorizedIssuer(address _addr) external view returns (bool) {
        return issuers[_addr];
    }
}
