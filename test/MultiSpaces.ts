import { getAccountKeys } from "./helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";

const {
  ACCOUNT_0_PUBLIC_KEY,
  ACCOUNT_0_ADDRESS,
  ACCOUNT_1_PUBLIC_KEY,
  ACCOUNT_1_ADDRESS,
} = getAccountKeys();

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

    const CreditChecker = await hre.ethers.getContractFactory("CreditChecker");
    const creditChecker = await CreditChecker.deploy();

    const PaymentManager = await hre.ethers.getContractFactory(
      "PaymentManager",
      {
        libraries: {
          CreditChecker: await creditChecker.getAddress(),
        },
      }
    );

    const paymentManager = await PaymentManager.deploy(
      1000000000000000,
      100,
      1000000000000
    );

    const ParticipantManager = await hre.ethers.getContractFactory(
      "ParticipantManager",
      {
        libraries: {
          InvitationChecker: await invitationChecker.getAddress(),
          PubKeyChecker: await pubKeyChecker.getAddress(),
        },
      }
    );
    const participantManager = await ParticipantManager.deploy();
    await participantManager.initialize(
      "Peter Parker",
      ACCOUNT_0_ADDRESS,
      ACCOUNT_0_PUBLIC_KEY,
      await paymentManager.getAddress()
    );

    const ParticipantManagerFactory = await ethers.getContractFactory(
      "ParticipantManagerFactory"
    );
    const participantManagerFactory = await ParticipantManagerFactory.deploy(
      await participantManager.getAddress()
    );

    const BucketFactory = await ethers.getContractFactory("BucketFactory", {});
    const bucketFactory = await BucketFactory.deploy(
      await bucket.getAddress(),
      await element.getAddress(),
      await participantManagerFactory.getAddress()
    );

    const Space = await ethers.getContractFactory("Space", {
      libraries: {
        PubKeyChecker: await pubKeyChecker.getAddress(),
      },
    });

    const space = await Space.deploy();

    const MultiSpaces = await ethers.getContractFactory("MultiSpaces", {
      libraries: {
        CreditChecker: await creditChecker.getAddress(),
      },
    });

    const multiSpaces = await MultiSpaces.deploy(
      await bucketFactory.getAddress(),
      await participantManagerFactory.getAddress(),
      await space.getAddress()
    );

    await bucketFactory.transferOwnership(await multiSpaces.getAddress());
    await participantManagerFactory.transferOwnership(
      await multiSpaces.getAddress()
    );

    return multiSpaces;
  };

  describe("Creating the MultiSpace", () => {
    it("works as expected", async () => {
      const instance = await createNewMultiSpace();
      await expect(instance.spaces(0)).to.be.reverted;
      const baseFee = await instance.BASE_FEE();
      expect(Number(baseFee), "Wrong base fee").to.eq(1000000000000000);
      const baseLimit = await instance.BASE_LIMIT();
      expect(Number(baseLimit), "Wrong base limit").to.eq(100);

      const paymentManager = await instance.paymentManager();
      expect(paymentManager).not.equals(ethers.ZeroAddress);
      const bucketFactory = await instance.bucketFactory();
      expect(bucketFactory).not.equals(ethers.ZeroAddress);
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
      expect(space).not.equals(ethers.ZeroAddress);
      expect(space).equals(ownedSpace);
      const spaceContract = await hre.ethers.getContractAt("Space", space);
      const spaceOwner = await spaceContract.spaceOwner();
      expect(spaceOwner[1]).equals("Peter");
    });

    it("works with other account", async () => {
      const instance = await createNewMultiSpace();
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
        .createSpace("Peter", ACCOUNT_1_PUBLIC_KEY, {
          value: 1000000000000000,
        });
      const space = await instance.spaces(0);
      const ownedSpace = await instance.ownedSpaces(ACCOUNT_1_PUBLIC_KEY);
      expect(space).not.equals(ethers.ZeroAddress);
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
      expect(space).not.equals(ethers.ZeroAddress);
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
      expect(Number(balance), "Balance incorrect!").to.eq(0);

      const signer = await ethers.getSigner(ACCOUNT_0_ADDRESS);
      const tx = {
        to: await instance.getAddress(),
        value: 1000000000000000,
      };
      await signer.sendTransaction(tx);

      const finalBalance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      expect(Number(finalBalance), "Balance incorrect!").to.eq(
        1000000000000000
      );
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
      expect(Number(balance), "Balance incorrect!").to.eq(0);
      const signer = await ethers.getSigner(ACCOUNT_0_ADDRESS);
      const tx = {
        to: await instance.getAddress(),
        value: 1000000000000000,
        data: "0x034567543456765543",
      };
      await signer.sendTransaction(tx);
      const finalBalance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      expect(Number(finalBalance), "Balance incorrect!").to.eq(
        1000000000000000
      );
    });
  });
});
