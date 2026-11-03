// Compile with the installed solc-js package and deploy to the local Hardhat node.
const fs = require("node:fs");
const path = require("node:path");
const solc = require("solc");
const { ethers } = require("ethers");

async function main() {
  const root = path.resolve(__dirname, "..");
  const sourcePath = path.join(root, "contracts", "CertificateRegistry.sol");
  const source = fs.readFileSync(sourcePath, "utf8");
  const input = {
    language: "Solidity",
    sources: { "CertificateRegistry.sol": { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((error) => error.severity === "error");
  if (errors.length) throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
  const compiled = output.contracts["CertificateRegistry.sol"].CertificateRegistry;
  const artifactDir = path.join(root, "artifacts-local");
  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(path.join(artifactDir, "CertificateRegistry.json"), JSON.stringify({
    abi: compiled.abi,
    bytecode: `0x${compiled.evm.bytecode.object}`
  }, null, 2));

  const rpcUrl = process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = await provider.getSigner(0);
  const factory = new ethers.ContractFactory(compiled.abi, `0x${compiled.evm.bytecode.object}`, signer);
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`CertificateRegistry deployed to: ${address}`);
  console.log(`Deployer: ${await signer.getAddress()}`);
  console.log(`Compiler: ${solc.version()}`);
  console.log(`RPC: ${rpcUrl}`);
  return address;
}

main().then((address) => {
  fs.writeFileSync(path.join(__dirname, "..", ".local-contract-address"), address, "utf8");
}).catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
