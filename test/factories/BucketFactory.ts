import { getAccountKeys } from "../helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { BucketFactory } from "../../typechain-types";

const { ACCOUNT_0_PUBLIC_KEY, ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

describe("BucketFactory", () => {
  let bucketFactory: BucketFactory;

  beforeEach(async () => {
    const Bucket = await hre.ethers.getContractFactory("Bucket");
    const Element = await hre.ethers.getContractFactory("Element");
    const bucket = await Bucket.deploy();
    const element = await Element.deploy();

    const InvitationChecker = await ethers.getContractFactory(
      "InvitationChecker"
    );
    const invitationChecker = await InvitationChecker.deploy();
    const PubKeyChecker = await ethers.getContractFactory("PubKeyChecker");
    const pubKeyChecker = await PubKeyChecker.deploy();

    const BucketFactory = await ethers.getContractFactory("BucketFactory", {
      libraries: {
        InvitationChecker: invitationChecker.address,
        PubKeyChecker: pubKeyChecker.address,
      },
    });
    bucketFactory = await BucketFactory.deploy(bucket.address, element.address);
  });

  describe("Creating new Buckets", () => {
    it("fails if no registered space", async () => {
      await expect(
        bucketFactory.createBucket(
          ethers.constants.AddressZero,
          "Peter Parker",
          ACCOUNT_0_ADDRESS,
          ACCOUNT_0_PUBLIC_KEY
        )
      ).to.be.revertedWith(new RegExp(/Only registered spaces allowed/));
    });

    it("works for registered space", async () => {
      await bucketFactory.registerSpace(ACCOUNT_0_ADDRESS);
      await bucketFactory.createBucket(
        ethers.constants.AddressZero,
        "Peter Parker",
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY
      );
    });
  });

  describe("Registering space new Buckets", () => {
    it("works for owner", async () => {
      await bucketFactory.registerSpace(ACCOUNT_0_ADDRESS);
    });

    it("fails if not owner", async () => {
      await expect(
        bucketFactory
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .registerSpace(ACCOUNT_1_ADDRESS)
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });
  });

  describe("Setting implementation", () => {
    it("works as expected for elements", async () => {
      await bucketFactory.setElementImplementation(ACCOUNT_0_ADDRESS);
    });

    it("only works for owner", async () => {
      await expect(
        bucketFactory
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setElementImplementation(ACCOUNT_1_ADDRESS)
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });

    it("works as expected for buckets", async () => {
      await bucketFactory.setBucketImplementation(ACCOUNT_0_ADDRESS);
    });

    it("only works for owner", async () => {
      await expect(
        bucketFactory
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setBucketImplementation(ACCOUNT_1_ADDRESS)
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });
  });
});
