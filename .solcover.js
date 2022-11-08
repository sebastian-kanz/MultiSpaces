module.exports = {
  client: require("ganache"), // Will load the outermost ganache-cli in node_modules
  providerOptions: {
    mnemonic: process.env.MNEMONIC,
    allowUnlimitedContractSize: true,
  },
  configureYulOptimizer: true,
};
