import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("hardhat-abi-exporter");
require("hardhat-contract-sizer");
import "dotenv/config";

require("dotenv").config();
const mnemonic: string | undefined = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

const config: HardhatUserConfig = {
  solidity: "0.8.12",
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
    },
    polygon_mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/${process.env.alchemyid}`,
      accounts: {
        mnemonic,
      },
      from: "0xF4c690b6440e8cb6BD39D010417C1dc25bf4EB9D",
    },
    alfajores: {
      url: "https://alfajores-forno.celo-testnet.org",
      accounts: {
        mnemonic,
      },
      from: "0xF4c690b6440e8cb6BD39D010417C1dc25bf4EB9D",
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.infuraProjectId}`,
      accounts: {
        mnemonic,
      },
      from: "0xF4c690b6440e8cb6BD39D010417C1dc25bf4EB9D",
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  gasReporter: {
    enabled: true,
    showMethodSig: true,
    currency: "EUR",
    gasPrice: 16,
    noColors: true,
    outputFile: "gas-report.txt",
    coinmarketcap: process.env.coinmarketcapKey,
  },
  abiExporter: {
    path: "./multi_spaces/lib/core/contracts",
    runOnCompile: true,
    clear: true,
    except: ["./libraries"],
    rename: (sourceName: string, contractName: string) => contractName + ".abi",
    spacing: 2,
    format: "json",
  },
};

export default config;
