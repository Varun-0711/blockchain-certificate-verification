require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Use the solc version bundled in the dependency tree so local builds work
// in environments without access to Solidity's compiler download service.
const solc = require("solc");

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(
  async ({ solcVersion }, _hre, runSuper) => {
    if (solcVersion === solc.version().split("+")[0]) {
      return {
        compilerPath: require.resolve("solc/soljson.js"),
        isSolcJs: true,
        version: solcVersion,
        longVersion: solc.version(),
      };
    }
    return runSuper();
  }
);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: solc.version().split("+")[0],
    settings: {},
  },
  networks: {
    hardhat: {},
    // Example testnet config (fill in via .env before use):
    // sepolia: {
    //   url: process.env.SEPOLIA_RPC_URL || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    // },
  },
};
