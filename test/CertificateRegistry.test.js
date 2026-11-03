const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CertificateRegistry", function () {
  let registry, owner, issuer2, outsider, employer;

  const certId = ethers.keccak256(ethers.toUtf8Bytes("student123-CS101-2026"));
  const docHash = ethers.keccak256(ethers.toUtf8Bytes("certificate-pdf-bytes-v1"));
  const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("tampered-file"));

  beforeEach(async function () {
    [owner, issuer2, outsider, employer] = await ethers.getSigners();
    const CertificateRegistry = await ethers.getContractFactory("CertificateRegistry");
    registry = await CertificateRegistry.deploy();
    await registry.waitForDeployment();
  });

  it("sets deployer as owner and default issuer", async function () {
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.isAuthorizedIssuer(owner.address)).to.equal(true);
  });

  it("allows owner to add/remove issuers", async function () {
    await registry.addIssuer(issuer2.address);
    expect(await registry.isAuthorizedIssuer(issuer2.address)).to.equal(true);

    await registry.removeIssuer(issuer2.address);
    expect(await registry.isAuthorizedIssuer(issuer2.address)).to.equal(false);
  });

  it("rejects non-owner from adding issuers", async function () {
    await expect(registry.connect(outsider).addIssuer(issuer2.address)).to.be.revertedWith(
      "Not contract owner"
    );
  });

  it("issues a certificate and lets anyone verify it", async function () {
    await expect(
      registry.issueCertificate(certId, docHash, "Asha Rao", "B.Tech CS", "IIT Example")
    )
      .to.emit(registry, "CertificateIssued")
      .withArgs(certId, owner.address, docHash, "Asha Rao", "B.Tech CS");

    // Anyone (e.g. an employer with no special role) can verify
    const [isValid, status] = await registry.connect(employer).verifyCertificate(certId, docHash);
    expect(isValid).to.equal(true);
    expect(status).to.equal("Valid");
  });

  it("flags a mismatched document hash as invalid (tamper detection)", async function () {
    await registry.issueCertificate(certId, docHash, "Asha Rao", "B.Tech CS", "IIT Example");
    const [isValid, status] = await registry.verifyCertificate(certId, wrongHash);
    expect(isValid).to.equal(false);
    expect(status).to.include("mismatch");
  });

  it("rejects issuance from an unauthorized address", async function () {
    await expect(
      registry.connect(outsider).issueCertificate(certId, docHash, "Asha Rao", "B.Tech CS", "IIT Example")
    ).to.be.revertedWith("Not an authorized issuer");
  });

  it("prevents duplicate certificate IDs", async function () {
    await registry.issueCertificate(certId, docHash, "Asha Rao", "B.Tech CS", "IIT Example");
    await expect(
      registry.issueCertificate(certId, docHash, "Asha Rao", "B.Tech CS", "IIT Example")
    ).to.be.revertedWith("Certificate ID already exists");
  });

  it("allows revocation and reflects it in verification", async function () {
    await registry.issueCertificate(certId, docHash, "Asha Rao", "B.Tech CS", "IIT Example");
    await expect(registry.revokeCertificate(certId, "Issued in error"))
      .to.emit(registry, "CertificateRevoked")
      .withArgs(certId, owner.address, "Issued in error");

    const [isValid, status] = await registry.verifyCertificate(certId, docHash);
    expect(isValid).to.equal(false);
    expect(status).to.equal("Certificate revoked");
  });

  it("returns not-found for a non-existent certificate", async function () {
    const [isValid, status] = await registry.verifyCertificate(certId, docHash);
    expect(isValid).to.equal(false);
    expect(status).to.equal("Certificate not found");
  });
});
