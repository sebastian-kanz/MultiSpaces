import { getAccountKeys } from "./helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { PaymentManager } from "../typechain-types";

const { ACCOUNT_0_PUBLIC_KEY, ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

describe("Space", () => {
  const createNewSpace = async () => {
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
    await participantManagerFactory.registerBucketFactory(
      await bucketFactory.getAddress()
    );

    const Space = await ethers.getContractFactory("Space", {
      libraries: {
        PubKeyChecker: await pubKeyChecker.getAddress(),
      },
    });

    const space = await Space.deploy();
    await space.initialize(
      ACCOUNT_0_ADDRESS,
      "Peter Parker",
      ACCOUNT_0_PUBLIC_KEY,
      await bucketFactory.getAddress(),
      await paymentManager.getAddress(),
      { value: 1000000000000000 }
    );
    await bucketFactory.registerSpace(await space.getAddress());
    return space;
  };
  describe("Creating a new Space", () => {
    it("works as expected", async () => {
      const instance = await createNewSpace();
      const spaceOwner = await instance.spaceOwner();
      expect(spaceOwner[0]).equals(ACCOUNT_0_ADDRESS);
      expect(spaceOwner[1]).equals("Peter Parker");
      expect(spaceOwner[2]).equals(ACCOUNT_0_PUBLIC_KEY);
    });

    it("fails if provided fee too low", async () => {
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

      const CreditChecker = await hre.ethers.getContractFactory(
        "CreditChecker"
      );
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

      const BucketFactory = await ethers.getContractFactory(
        "BucketFactory",
        {}
      );
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
      await expect(
        space.initialize(
          ACCOUNT_0_ADDRESS,
          "Peter Parker",
          ACCOUNT_0_PUBLIC_KEY,
          await bucketFactory.getAddress(),
          await paymentManager.getAddress(),
          { value: 100000000000000 }
        )
      ).to.be.reverted;
    });
  });

  describe("Creating a new Bucket", () => {
    it("works as expected", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", { value: 1000000000000000 });
      const bucket = await instance.getAllBuckets();
      expect(bucket[0].bucket).not.equals(ethers.ZeroAddress);
      expect(await instance.allBucketNames(0)).equals("Bucket1");
    });

    it("adds owner role to participant manager of bucket", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", {
        value: 1000000000000000,
      });
      const bucketContainer = await instance.allBuckets("Bucket1");
      const bucket = await ethers.getContractAt("Bucket", bucketContainer[0]);
      const participantManagerAddress = await bucket.participantManager();
      const participantManagerInstance = await ethers.getContractAt(
        "ParticipantManager",
        participantManagerAddress
      );
      const ownerRole = await participantManagerInstance.ALL_ROLES(3);
      expect(
        await participantManagerInstance.hasRole(ownerRole, ACCOUNT_0_ADDRESS)
      ).to.be.revertedWith("Missing owner role for space!");
    });

    it("emits event", async () => {
      const instance = await createNewSpace();
      const receipt = await instance.addBucket("Bucket1", {
        value: 1000000000000000,
      });
      const bucket = await instance.getAllBuckets();
      expect(receipt)
        .to.emit(instance, "Create")
        .withArgs(bucket[0].bucket, ACCOUNT_0_ADDRESS);
    });

    it("fails if provided fee too low", async () => {
      const instance = await createNewSpace();
      await expect(instance.addBucket("Bucket1", { value: 123 })).to.be
        .reverted;
    });

    it("fails if sender is not space owner", async () => {
      const instance = await createNewSpace();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .addBucket("Bucket1", {
            value: 1000000000000000,
          })
      ).to.be.reverted;
    });

    it("fails if bucket exists", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", { value: 1000000000000000 });
      await expect(instance.addBucket("Bucket1", { value: 1000000000000000 }))
        .to.be.reverted;
    });
  });

  describe("Removing a Bucket", () => {
    it("works as expected", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", {
        value: 1000000000000000,
      });
      await instance.removeBucket("Bucket1");
      const buckets = await instance.getAllBuckets();
      expect(buckets.length).equals(0);
    });

    it("emits event", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", { value: 1000000000000000 });
      const receipt = await instance.removeBucket("Bucket1");
      expect(receipt).to.emit(instance, "Remove").withArgs(ACCOUNT_0_ADDRESS);
    });

    it("fails if sender is not space owner", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", { value: 1000000000000000 });
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .removeBucket("Bucket1")
      ).to.be.revertedWith("Forbidden");
    });

    it("fails if bucket does not exist", async () => {
      const instance = await createNewSpace();
      await expect(instance.removeBucket("Bucket1")).to.be.reverted;
    });
  });

  describe("Renaming a Bucket", () => {
    it("works as expected", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", {
        value: 1000000000000000,
        from: ACCOUNT_0_ADDRESS,
      });
      await instance.renameBucket("Bucket1", "Bucket_01");
      const buckets = await instance.allBucketNames(0);
      expect(buckets).equals("Bucket_01");
      const bucket1 = await instance.allBuckets("Bucket1");
      const bucket01 = await instance.allBuckets("Bucket_01");
      expect(bucket1[1]).equals(false);
      expect(bucket01[1]).equals(true);
    });

    it("emits event", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", { value: 1000000000000000 });
      const receipt = await instance.renameBucket("Bucket1", "Bucket_01");
      expect(receipt)
        .to.emit(instance, "Rename")
        .withArgs(
          ethers.id("Bucket1"),
          ethers.id("Bucket_01"),
          ACCOUNT_0_ADDRESS
        );
    });

    it("fails if sender is not space owner", async () => {
      const instance = await createNewSpace();
      await instance.addBucket("Bucket1", { value: 1000000000000000 }),
        await expect(
          instance
            .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
            .renameBucket("Bucket1", "Bucket_01")
        ).to.be.revertedWith("Forbidden");
    });

    it("fails if bucket does not exist", async () => {
      const instance = await createNewSpace();
      await expect(instance.renameBucket("Bucket1", "Bucket_01")).to.be
        .reverted;
    });
  });
});
