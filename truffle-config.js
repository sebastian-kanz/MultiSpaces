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
        privateKeys: [process.env.ACCOUNT_0_PRIVATE_KEY],
        providerOrUrl: `https://alfajores-forno.celo-testnet.org`
      }),
      network_id: 44787,
      gas: 20000000
    },
    goerli: {
      provider: () => new HDWalletProvider(process.env.MNEMONIC, `https://goerli.infura.io/v3/${process.env.infuraProjectId}`),
      from: '0xF4c690b6440e8cb6BD39D010417C1dc25bf4EB9D',
      network_id: 5,
      timeoutBlocks: 200,
      networkCheckTimeout: 10000,
    },
    matic: {
      // provider: () => new HDWalletProvider(process.env.MNEMONIC, `https://rpc-mumbai.maticvigil.com/v1/1861e50894501745b2a53b966b577fa8ac3efea9`),
      provider: () => new HDWalletProvider(process.env.MNEMONIC, `https://polygon-mumbai.g.alchemy.com/v2/lhVv94odHT0ekv-p8L1PPzVxEwhlLmE9`),
      from: '0xF4c690b6440e8cb6BD39D010417C1dc25bf4EB9D',
      network_id: 80001,
      timeoutBlocks: 200,
      networkCheckTimeout: 10000,
      skipDryRun: true,
      // reduces request load (e.g. to Alchemy) dramatically 
      pollingInterval: 1800000,
      disableConfirmationListener: true,
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

