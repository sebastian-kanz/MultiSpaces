import { getAccountKeys } from "../helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

const { ACCOUNT_0_ADDRESS, ACCOUNT_0_PUBLIC_KEY, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

describe("PubKeyChecker", () => {
  describe("Validating public keys", () => {
    it("checks key length", async () => {
      const PubKeyChecker = await hre.ethers.getContractFactory(
        "PubKeyChecker"
      );
      const instance = await PubKeyChecker.deploy();
      await expect(
        instance.validatePubKey(
          ACCOUNT_0_ADDRESS,
          ACCOUNT_0_PUBLIC_KEY.replace("0x", "0x04")
        )
      ).to.be.revertedWith(new RegExp(/Invalid key length. Remove leading 0/));
    });

    it("succeeds for matching account and key", async () => {
      const PubKeyChecker = await hre.ethers.getContractFactory(
        "PubKeyChecker"
      );
      const instance = await PubKeyChecker.deploy();
      await instance.validatePubKey(ACCOUNT_0_ADDRESS, ACCOUNT_0_PUBLIC_KEY);
    });

    it("fails for non-matching account and key", async () => {
      const PubKeyChecker = await hre.ethers.getContractFactory(
        "PubKeyChecker"
      );
      const instance = await PubKeyChecker.deploy();
      await expect(
        instance.validatePubKey(ACCOUNT_1_ADDRESS, ACCOUNT_0_PUBLIC_KEY)
      ).to.be.revertedWith(
        `PubKeyChecker: account ${ACCOUNT_1_ADDRESS.toLowerCase()} does not match pubKey`
      );
    });
  });
});
