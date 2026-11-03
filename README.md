# Blockchain-Based Academic Certificate Verification
### SDG 4 — Quality Education

A tamper-proof system for universities to issue academic certificates on-chain,
and for anyone (employers, other institutions, students) to verify their
authenticity instantly — without emailing the registrar's office.

---

## 1. Problem it solves

Certificate fraud (forged degrees, altered grades, fake transcripts) is a
real and costly problem, and manual verification between institutions is
slow and centralized — if the issuing university's records office is
unreachable or the paperwork is lost, verification breaks down entirely.

## 2. How it works

1. A university (an **authorized issuer** on the smart contract) issues a
   certificate. Only a **hash** of the certificate document and a compact
   set of fields (student name, course, institution, date) are written
   on-chain — never personally identifiable raw data or the full document.
2. The student receives a **Certificate ID** (a unique on-chain reference).
3. Anyone holding the certificate document and the Certificate ID can call
   `verifyCertificate()` — a free, public, read-only function — to confirm:
   - the certificate exists,
   - it hasn't been revoked,
   - the document hash matches exactly what was issued (so any tampering,
     even a single changed character or grade, is detected).
4. If a certificate was issued in error or misconduct is discovered later,
   the issuer can **revoke** it — the record stays visible for auditability,
   but verification will now correctly report it as invalid.

## 3. Architecture

```
Student's certificate document (PDF/text)
        │  keccak256 hash (off-chain, in browser)
        ▼
┌─────────────────────────────┐
│   CertificateRegistry.sol    │   ← deployed once per institution/consortium
│  - issueCertificate()        │
│  - verifyCertificate()       │
│  - revokeCertificate()       │
│  - issuer access control     │
└─────────────────────────────┘
        ▲                    ▲
        │                    │
  University (issuer)   Anyone (employer, verifier)
  via frontend/MetaMask  via frontend, no wallet needed to verify
```

**Why only a hash on-chain?** Storing the raw certificate would put student
data permanently on a public ledger. Storing just a cryptographic hash lets
anyone *prove* a document is authentic and unaltered, without exposing or
duplicating the document itself on-chain.

## 4. Project structure

```
blockchain-certificate-verification/
├── contracts/
│   └── CertificateRegistry.sol   # the smart contract
├── test/
│   └── CertificateRegistry.test.js  # Hardhat test suite (9 tests)
├── scripts/
│   └── deploy.js                 # deployment script
├── frontend/
│   └── index.html                # Browser interface
├── hardhat.config.js
├── package.json
└── README.md
```

## 5. Setup & running it

Requires [Node.js](https://nodejs.org) (v18+) and, for the browser interface,
the [MetaMask](https://metamask.io) browser extension.

```bash
# 1. Install dependencies
npm install

# 2. Compile the contract
npx hardhat compile

# 3. Run the test suite
npx hardhat test

# 4. Start a local blockchain (in one terminal)
npx hardhat node

# 5. Deploy to it (in a second terminal)
npx hardhat run scripts/deploy.js --network localhost
# copy the printed contract address
```

For Windows, start the complete application with `start-local.bat` from File
Explorer (or run `start-local.bat` in Command Prompt). It opens separate
terminals for the blockchain and application, waits for the chain, compiles and
deploys the contract, and starts the frontend/backend. Open
`http://127.0.0.1:3000` in your browser.

You can also start the application manually in another terminal:

```bash
npm run local
```

Open `http://127.0.0.1:3000`. The server uses the first Hardhat development
account to submit issue and revoke transactions; the browser makes read-only
calls for verification. The deployed address is detected
automatically for the default local chain. Set `LOCAL_CONTRACT_ADDRESS` if you
deployed at another address.

The server binds to loopback and uses a publicly known development private key.
Keep it on this computer and use it only with the Hardhat development chain.
Never expose it to a network, point it at a public blockchain, or enter real
student data. Keep `npx hardhat node` running in one terminal and `npm run local`
running in another.

To deploy to a real testnet (e.g. Sepolia) instead of a local chain, fill in
an RPC URL and private key in `hardhat.config.js` and run with
`--network sepolia`.

## 6. Smart contract summary

| Function | Who can call | What it does |
|---|---|---|
| `addIssuer(address)` / `removeIssuer(address)` | contract owner | manage which institutions can issue |
| `issueCertificate(...)` | authorized issuers only | writes a new certificate record, emits `CertificateIssued` |
| `revokeCertificate(id, reason)` | authorized issuers only | flags a certificate as revoked, emits `CertificateRevoked` |
| `verifyCertificate(id, docHash)` | **anyone**, free (view function) | returns `(isValid, status)` |
| `getCertificate(id)` | anyone | returns full stored record |

## 7. Possible extensions (good "future work" talking points)

- **IPFS integration**: store the actual certificate PDF on IPFS and keep
  only the IPFS CID + hash on-chain, so verifiers can fetch the original file.
- **NFT-based certificates (ERC-721)**: mint each certificate as a
  non-transferable ("soulbound") NFT owned by the student's wallet.
- **DID (Decentralized Identifiers)**: tie certificates to W3C Verifiable
  Credentials for interoperability with other identity systems.
- **Multi-institution consortium governance**: replace the single-owner
  `addIssuer` model with a DAO or multi-sig for adding new institutions.
- **QR-code verification**: encode the Certificate ID + a link to the
  frontend in a QR code printed on the physical certificate.

## 8. SDG 4 alignment

- **Target 4.1 / 4.3 (access to quality education & credentials):** makes
  credential verification instant and free, lowering barriers for graduates
  applying internationally where manual verification is slow or expensive.
- **Institutional trust:** reduces credential fraud, protecting the value
  of legitimate degrees.
- **Equity:** works the same for any student regardless of which country or
  institution is trying to verify their certificate — no bilateral
  agreements between universities needed.
