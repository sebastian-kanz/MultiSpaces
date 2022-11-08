require("ts-node").register({
  files: true,
});
require('dotenv').config({ path: '.env' })
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard Ethereum port (default: none)
      network_id: "*",       // Any network (default: none)
      // gas: 20000000,
      timeoutBlocks: 200,
      networkCheckTimeout: 10000,
    },
    coverage: {
      host: '127.0.0.1',
      port: 8555,
      network_id: "*",
      gas: 20000000,
      timeoutBlocks: 200,
      networkCheckTimeout: 10000,
    },
    alfajores: {
      provider: new HDWalletProvider({
        privateKeys: [process.env.PRIVATE_KEY],
        providerOrUrl: `https://alfajores-forno.celo-testnet.org`
      }),
      network_id: 44787,
      gas: 20000000
    },
    goerli: {
      // provider: () => new HDWalletProvider({
      //   privateKeys: ["6f8074f4d89c4adc637b1afe3f11a14e38953b2df56527a6958ad4bc2a0e411d"],
      //   // mnemonic: process.env.MNEMONIC,
      //   providerOrUrl: `https://goerli.infura.io/v3/${process.env.infuraProjectId}`,
      // }),
      provider: () => new HDWalletProvider(process.env.MNEMONIC, `https://goerli.infura.io/v3/${process.env.infuraProjectId}`),
      from: '0xF4c690b6440e8cb6BD39D010417C1dc25bf4EB9D',
      network_id: 5,
      timeoutBlocks: 200,
      networkCheckTimeout: 10000,
      // gas: 4465030
      // gasPrice: 10000000000,
    },
  },

  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
      excludeContracts: ['Migrations'],
      currency: "USD",
      gasPrice: 0.3,
      outputFile: './gas-report.txt'
    }
  },

  compilers: {
    solc: {
      version: "0.8.12",    // Fetch exact version from solc-bin (default: truffle's version)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        // optimizer: {
        //   enabled: true,
        //   runs: 200
        // },
      }
    }
  },

  plugins: ["truffle-contract-size", "solidity-coverage"]
};

