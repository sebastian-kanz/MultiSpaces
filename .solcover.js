module.exports = {
  client: require("ganache-cli"), // Will load the outermost ganache-cli in node_modules
  providerOptions: {
    mnemonic:
      "heart rocket ripple ritual arrow group visa execute possible castle balcony worry",
    allowUnlimitedContractSize: true,
  },
  configureYulOptimizer: true,
};
