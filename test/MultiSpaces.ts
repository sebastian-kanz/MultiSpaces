import { getAccountKeys } from "./helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

const { ACCOUNT_0_PUBLIC_KEY, ACCOUNT_0_ADDRESS } = getAccountKeys();

describe("MultiSpaces", () => {
  const createNewMultiSpace = async () => {
    const Element = await ethers.getContractFactory("Element");
    const element = await Element.deploy();
    const Bucket = await ethers.getContractFactory("Bucket");
    const bucket = await Bucket.deploy();

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
    const bucketFactory = await BucketFactory.deploy(
      bucket.address,
      element.address
    );

    const CreditChecker = await ethers.getContractFactory("CreditChecker");
    const creditChecker = await CreditChecker.deploy();

    const Space = await ethers.getContractFactory("Space", {
      libraries: {
        PubKeyChecker: pubKeyChecker.address,
      },
    });

    const space = await Space.deploy();

    const MultiSpaces = await ethers.getContractFactory("MultiSpaces", {
      libraries: {
        CreditChecker: creditChecker.address,
      },
    });

    const multiSpaces = await MultiSpaces.deploy(
      bucketFactory.address,
      space.address
    );

    await bucketFactory.transferOwnership(multiSpaces.address);

    return multiSpaces;
  };

  describe("Creating the MultiSpace", () => {
    it("works as expected", async () => {
      const instance = await createNewMultiSpace();
      await expect(instance.spaces(0)).to.be.reverted;
      const baseFee = await instance.baseFee();
      expect(baseFee.eq(1000000000000000), "Wrong base fee");
      const baseLimit = await instance.baseLimit();
      expect(baseLimit.eq(100), "Wrong base limit");

      const paymentManager = await instance.paymentManager();
      expect(paymentManager).not.equals(ethers.constants.AddressZero);
      const bucketFactory = await instance.bucketFactory();
      expect(bucketFactory).not.equals(ethers.constants.AddressZero);
    });

    it("sets creator as owner of payment manager", async () => {
      const instance = await createNewMultiSpace();
      const pManagerAdr = await instance.paymentManager();
      const paymentManager = await hre.ethers.getContractAt(
        "PaymentManager",
        pManagerAdr
      );
      const owner = await paymentManager.owner();
      expect(owner).equals(ACCOUNT_0_ADDRESS);
    });
  });

  describe("Creating a new Space", () => {
    it("works as expected", async () => {
      const instance = await createNewMultiSpace();
      await instance.createSpace("Peter", ACCOUNT_0_PUBLIC_KEY, {
        value: 1000000000000000,
      });
      const space = await instance.spaces(0);
      const ownedSpace = await instance.ownedSpaces(ACCOUNT_0_PUBLIC_KEY);
      expect(space).not.equals(ethers.constants.AddressZero);
      expect(space).equals(ownedSpace);
      const spaceContract = await hre.ethers.getContractAt("Space", space);
      const spaceOwner = await spaceContract.spaceOwner();
      expect(spaceOwner[1]).equals("Peter");
    });

    it("returns already existing space", async () => {
      const instance = await createNewMultiSpace();
      await instance.createSpace("Peter", ACCOUNT_0_PUBLIC_KEY, {
        value: 1000000000000000,
      });
      const space = await instance.spaces(0);
      expect(space).not.equals(ethers.constants.AddressZero);
      await instance.createSpace("Peter", ACCOUNT_0_PUBLIC_KEY, {
        value: 1000000000000000,
      });
      const space2 = await instance.spaces(0);
      expect(space).equals(space2);
      await expect(instance.spaces(1)).to.be.reverted;
    });
  });

  describe("Sending ether to MultiSpace", () => {
    it("forwards amount to payment manager", async () => {
      const instance = await createNewMultiSpace();
      const paymentManager = await instance.paymentManager();
      const paymentManagerContract = await hre.ethers.getContractAt(
        "PaymentManager",
        paymentManager
      );
      const balance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      expect(balance.eq(0), "Balance incorrect!");

      const signer = await ethers.getSigner(ACCOUNT_0_ADDRESS);
      const tx = {
        to: instance.address,
        value: 1000000000000000,
      };
      await signer.sendTransaction(tx);

      const finalBalance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      expect(finalBalance.eq(1000000000000000), "Balance incorrect!");
    });

    it("forwards amount to payment manager", async () => {
      const instance = await createNewMultiSpace();
      const paymentManager = await instance.paymentManager();
      const paymentManagerContract = await hre.ethers.getContractAt(
        "PaymentManager",
        paymentManager
      );
      const balance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      expect(balance.eq(0), "Balance incorrect!");
      const signer = await ethers.getSigner(ACCOUNT_0_ADDRESS);
      const tx = {
        to: instance.address,
        value: 1000000000000000,
        data: "0x034567543456765543",
      };
      await signer.sendTransaction(tx);
      const finalBalance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      expect(finalBalance.eq(1000000000000000), "Balance incorrect!");
    });
  });
});
