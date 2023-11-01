import { getAccountKeys } from "../helpers/keys.helper";
import { expect } from "chai";
import hre from "hardhat";

const { ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } = getAccountKeys();

describe("InvitationChecker", () => {
  describe("Validating invitation", () => {
    it("identifies correct signature", async () => {
      const text = "This is a random invitation code";

      const stringHash = hre.ethers.solidityPackedKeccak256(["string"], [text]);
      const hash = hre.ethers.getBytes(stringHash);

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      const InvitationChecker = await hre.ethers.getContractFactory(
        "InvitationChecker"
      );
      const instance = await InvitationChecker.deploy();
      const result = await instance.isValidInvitation(
        signResult,
        ACCOUNT_0_ADDRESS,
        text
      );
      expect(result[0]).to.be.true;
      expect(result[1] === stringHash, "Hash comparison failed");
    });

    it("fails for invalid invitation code", async () => {
      const text = "This is a random invitation code";

      const stringHash = hre.ethers.solidityPackedKeccak256(["string"], [text]);
      const hash = hre.ethers.getBytes(stringHash);

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      const InvitationChecker = await hre.ethers.getContractFactory(
        "InvitationChecker"
      );
      const instance = await InvitationChecker.deploy();
      const result = await instance.isValidInvitation(
        signResult,
        ACCOUNT_0_ADDRESS,
        "invalid code"
      );
      expect(result[0]).to.be.false;
      expect(result[1] !== stringHash, "Hash comparison failed");
    });

    it("identifies invalid signer", async () => {
      const text = "This is a random invitation code";

      const stringHash = hre.ethers.solidityPackedKeccak256(["string"], [text]);
      const hash = hre.ethers.getBytes(stringHash);

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      const InvitationChecker = await hre.ethers.getContractFactory(
        "InvitationChecker"
      );
      const instance = await InvitationChecker.deploy();
      const result = await instance.isValidInvitation(
        signResult,
        ACCOUNT_1_ADDRESS,
        text
      );
      expect(result[0]).to.be.false;
    });
  });
});
