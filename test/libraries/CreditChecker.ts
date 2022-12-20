import { getAccountKeys } from "../helpers/keys.helper";
import { expect } from "chai";
import hre from "hardhat";

const { ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } = getAccountKeys();

describe("CreditChecker", () => {
  describe("Validating credits", () => {
    it("identifies correct signature", async () => {
      const credit = 1;
      const random = "This is a random invitation code";
      const stringHash = hre.ethers.utils.solidityKeccak256(
        ["uint256", "string"],
        [credit, random]
      );
      const hash = hre.ethers.utils.arrayify(stringHash);

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      const CreditChecker = await hre.ethers.getContractFactory(
        "CreditChecker"
      );
      const instance = await CreditChecker.deploy();

      const result = await instance.isValidCredit(
        signResult,
        ACCOUNT_0_ADDRESS,
        credit,
        random
      );
      expect(result[0]).to.be.true;
      expect(result[1] === stringHash, "Hash comparison failed");
    });

    it("fails for invalid invitation code", async () => {
      const credit = 1;
      const random = "This is a random invitation code";
      const stringHash = hre.ethers.utils.solidityKeccak256(
        ["uint256", "string"],
        [credit, random]
      );
      const hash = hre.ethers.utils.arrayify(stringHash);

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      const CreditChecker = await hre.ethers.getContractFactory(
        "CreditChecker"
      );
      const instance = await CreditChecker.deploy();

      const result = await instance.isValidCredit(
        signResult,
        ACCOUNT_0_ADDRESS,
        credit,
        "invalid"
      );
      expect(result[0]).to.be.false;
      expect(result[1] !== stringHash, "Hash comparison failed");
    });

    it("identifies invalid signer", async () => {
      const credit = 1;
      const random = "This is a random invitation code";
      const stringHash = hre.ethers.utils.solidityKeccak256(
        ["uint256", "string"],
        [credit, random]
      );
      const hash = hre.ethers.utils.arrayify(stringHash);

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      const CreditChecker = await hre.ethers.getContractFactory(
        "CreditChecker"
      );
      const instance = await CreditChecker.deploy();

      const result = await instance.isValidCredit(
        signResult,
        ACCOUNT_1_ADDRESS,
        credit,
        "invalid"
      );
      expect(result[0] === false, "Signature validation failed");
    });
  });
});
