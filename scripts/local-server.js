// Local-only demo server. Uses Hardhat's publicly known development key.
// Never expose this server to a network or point it at a public chain.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const root = path.resolve(__dirname, "..");
const frontendPath = path.join(root, "frontend", "index.html");
const rpcUrl = process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";
const port = Number(process.env.LOCAL_WEB_PORT || 3000);
let savedAddress = "";
try { savedAddress = fs.readFileSync(path.join(root, ".local-contract-address"), "utf8").trim(); } catch {}
const localKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const abi = [
  "function issueCertificate(bytes32 _certificateId, bytes32 _documentHash, string _studentName, string _courseName, string _institutionName) external",
  "function revokeCertificate(bytes32 _certificateId, string _reason) external",
  "function isAuthorizedIssuer(address _addr) external view returns (bool)"
];

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" });
  res.end(JSON.stringify(data));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 32_768) { reject(new Error("Request body is too large.")); req.destroy(); }
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); } catch { reject(new Error("Request must contain valid JSON.")); }
    });
    req.on("error", reject);
  });
}
function validateBody(body, needsNames = false) {
  if (!body || !ethers.isAddress(body.address)) throw new Error("Invalid contract address.");
  if (!ethers.isHexString(body.certificateId, 32)) throw new Error("Certificate ID must be a 32-byte hex value.");
  if (needsNames) {
    if (!ethers.isHexString(body.documentHash, 32)) throw new Error("Document hash must be a 32-byte hex value.");
    for (const field of ["studentName", "courseName", "institutionName"]) {
      if (typeof body[field] !== "string" || body[field].trim().length === 0 || body[field].length > 200) throw new Error(`Invalid ${field}.`);
    }
  }
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const signer = new ethers.Wallet(localKey, provider);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      res.writeHead(200, { "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store" });
      return res.end(fs.readFileSync(frontendPath));
    }
    if (req.method === "GET" && url.pathname === "/api/status") {
      const network = await provider.getNetwork();
      const configuredAddress = process.env.LOCAL_CONTRACT_ADDRESS || savedAddress || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
      const code = await provider.getCode(configuredAddress);
      sendJson(res, 200, {
        rpcUrl,
        chainId: network.chainId.toString(),
        issuer: await signer.getAddress(),
        contractAddress: code === "0x" ? "" : configuredAddress
      });
      return;
    }
    if (req.method === "POST" && ["/api/issue", "/api/revoke"].includes(url.pathname)) {
      if (url.pathname === "/api/issue" && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new Error("Cross-origin requests are not allowed.");
      if (url.pathname === "/api/revoke" && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new Error("Cross-origin requests are not allowed.");
      const body = await readJson(req);
      validateBody(body, url.pathname === "/api/issue");
      if (url.pathname === "/api/revoke" && (typeof body.reason !== "string" || body.reason.length > 500)) throw new Error("Invalid revocation reason.");
      const code = await provider.getCode(body.address);
      if (code === "0x") throw new Error("No contract is deployed at that address on the local chain.");
      const contract = new ethers.Contract(body.address, abi, signer);
      if (!(await contract.isAuthorizedIssuer(await signer.getAddress()))) throw new Error("The local demo account is not authorized to issue or revoke on this contract.");
      const tx = url.pathname === "/api/issue"
        ? await contract.issueCertificate(body.certificateId, body.documentHash, body.studentName.trim(), body.courseName.trim(), body.institutionName.trim())
        : await contract.revokeCertificate(body.certificateId, body.reason);
      const receipt = await tx.wait();
      return sendJson(res, 200, { transactionHash: receipt.hash, certificateId: body.certificateId });
    }
    sendJson(res, 404, { error:"Not found." });
  } catch (error) {
    if (!res.headersSent) sendJson(res, 400, { error:error.shortMessage || error.reason || error.message || "Request failed." });
  }
});

// Bind only to loopback. The signing key is for local development only.
server.listen(port, "127.0.0.1", () => {
  console.log(`Local certificate demo: http://127.0.0.1:${port}`);
  console.log(`Using local RPC: ${rpcUrl}`);
  console.log(`Development issuer: ${signer.address}`);
  console.log("Keep this server local. Never expose it to a network or public chain.");
});
