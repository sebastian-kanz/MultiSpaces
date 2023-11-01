import { getAccountKeys } from "./helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
  BucketMockElem,
  Element,
  ParticipantManager,
  PaymentManager,
} from "../typechain-types";

const { ACCOUNT_0_PUBLIC_KEY, ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

describe("Element", () => {
  let participantManager: ParticipantManager;
  let paymentManager: PaymentManager;
  let element: Element;
  let bucket: BucketMockElem;

  beforeEach(async () => {
    const InvitationChecker = await hre.ethers.getContractFactory(
      "InvitationChecker"
    );
    const invitationChecker = await InvitationChecker.deploy();

    const PubKeyChecker = await hre.ethers.getContractFactory("PubKeyChecker");
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

    paymentManager = await PaymentManager.deploy(
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

    participantManager = await ParticipantManager.deploy();

    await participantManager.initialize(
      "Peter Parker",
      ACCOUNT_0_ADDRESS,
      ACCOUNT_0_PUBLIC_KEY,
      await paymentManager.getAddress()
    );

    const Bucket = await hre.ethers.getContractFactory("BucketMockElem");
    bucket = await Bucket.deploy();

    const Element = await hre.ethers.getContractFactory("Element");
    element = await Element.deploy();
    const elemImpl = await Element.deploy();
    bucket.initialize(
      await paymentManager.getAddress(),
      await participantManager.getAddress(),
      await elemImpl.getAddress()
    );
  });

  const createElement = async () => {
    const Element = await hre.ethers.getContractFactory("Element");
    const instance = await Element.deploy();
    await bucket.mockRegisterElement(await instance.getAddress());
    await instance.initialize(
      {
        creator: ACCOUNT_0_ADDRESS,
        participantManager: await participantManager.getAddress(),
        parent: ethers.ZeroAddress,
        previous: ethers.ZeroAddress,
        bucket: await bucket.getAddress(),
        elemImpl: await element.getAddress(),
      },
      { meta: "meta", data: "data", container: "container" },
      0,
      0
    );
    return instance;
  };

  describe("Initializing an element", () => {
    it("sets all data correctly", async () => {
      const instance = await createElement();
      const meta = await instance.metaHash();
      expect(meta, "Wrong meta").to.eq("meta");
      const data = await instance.dataHash();
      expect(data, "Wrong data").to.eq("data");
      const container = await instance.containerHash();
      expect(container, "Wrong container").to.eq("container");
      const contentType = await instance.contentType();
      expect(Number(contentType), "Wrong contentType").to.eq(0);
      const creator = await instance.creator();
      expect(creator, "Wrong creator").to.eq(ACCOUNT_0_ADDRESS);
      const parent = await instance.parentElement();
      expect(parent, "Wrong parent").to.eq(ethers.ZeroAddress);
      const previous = await instance.previousElement();
      expect(previous, "Wrong previous").to.eq(ethers.ZeroAddress);
      const next = await instance.nextElement();
      expect(next, "Wrong next").to.eq(await instance.getAddress());
      const parentBucket = await instance.parentBucket();
      expect(parentBucket, "Wrong parentBucket").to.eq(
        await bucket.getAddress()
      );
      const elemImpl = await instance.elemImpl();
      expect(elemImpl, "Wrong elemImpl").to.eq(await element.getAddress());

      const holdersCount = await instance.holdersCount();
      expect(Number(holdersCount), "Wrong holdersCount").to.eq(1);

      const redundancy = await instance.redundancy();
      expect(Number(redundancy), "Wrong redundancy").to.eq(1);
      const minRedundancy = await instance.minRedundancy();
      expect(Number(minRedundancy), "Wrong minRedundancy").to.eq(0);
    });

    it("notifies the bucket of the creation", async () => {
      const instance = await createElement();
      const history = await bucket.history(0);
      expect(history[0], "Wrong element").to.eq(await instance.getAddress());
      expect(Number(history[1]), "Wrong operation type").to.eq(0);
    });
  });

  describe("Updating an element", () => {
    it("only works for bucket participants", async () => {
      const instance = await createElement();

      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .update(
            { meta: "meta", data: "data", container: "container" },
            ethers.ZeroAddress
          )
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("only works if keys are available", async () => {
      const instance = await createElement();

      await expect(
        instance.update(
          { meta: "meta2", data: "data2", container: "container2" },
          ethers.ZeroAddress
        )
      ).to.be.revertedWith(new RegExp(/No key available!/));
    });

    it("only works if not already updated", async () => {
      const instance = await createElement();
      await bucket.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );

      await instance.update(
        { meta: "meta2", data: "data2", container: "container2" },
        ethers.ZeroAddress
      );

      await expect(
        instance.update(
          { meta: "meta3", data: "data3", container: "container3" },
          ethers.ZeroAddress
        )
      ).to.be.revertedWith(new RegExp(/Newer version already exists/));
    });

    it("only works if new hashes do not yet exist", async () => {
      await bucket.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await bucket.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [ethers.ZeroAddress],
        0
      );
      const adr = await bucket.allElements(0);
      const instance = await hre.ethers.getContractAt("Element", adr);

      await expect(
        instance.update(
          { meta: "meta", data: "data", container: "container" },
          ethers.ZeroAddress
        )
      ).to.be.revertedWith(new RegExp(/New meta already exists/));
      await expect(
        instance.update(
          { meta: "meta2", data: "data2", container: "container" },
          ethers.ZeroAddress
        )
      ).to.be.revertedWith(new RegExp(/New container already exists/));
    });

    it("notifies the bucket of the creation of the new element", async () => {
      const instance = await createElement();
      await bucket.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );

      await instance.update(
        { meta: "meta2", data: "data2", container: "container2" },
        ethers.ZeroAddress
      );

      const history = await bucket.history(1);
      expect(history[0], "Wrong element").to.not.eq(
        await instance.getAddress()
      );
      expect(Number(history[1]), "Wrong operation type").to.eq(0);
      const history2 = await bucket.history(2);
      expect(history2[0], "Wrong element").to.not.eq(
        await instance.getAddress()
      );
      expect(Number(history2[1]), "Wrong operation type").to.eq(1);
    });

    it("set previous <-> next relationship correctly", async () => {
      await bucket.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await bucket.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [ethers.ZeroAddress],
        0
      );
      const adr = await bucket.allElements(0);
      const instance = await hre.ethers.getContractAt("Element", adr);
      await instance.update(
        { meta: "meta2", data: "data2", container: "container2" },
        ethers.ZeroAddress
      );

      const next = await instance.nextElement();
      const adr2 = await bucket.allElements(1);
      const instance2 = await hre.ethers.getContractAt("Element", adr2);
      const previous = await instance2.previousElement();
      expect(next, "Wrong next element").to.eq(await instance2.getAddress());
      expect(previous, "Wrong previous element").to.eq(
        await instance.getAddress()
      );
    });
  });

  describe("Removing an element", () => {
    it("only works for bucket participants", async () => {
      const instance = await createElement();
      await expect(
        instance.connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS)).remove()
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("only works if redundancy is set to NONE", async () => {
      const instance = await createElement();
      await expect(instance.remove()).to.be.revertedWith(
        new RegExp(/Wrong redundancy level/)
      );
      await instance.setRedundancyLevel(0);
      await instance.remove();
    });

    it("notifies the bucket of the deletion", async () => {
      const instance = await createElement();
      await instance.setRedundancyLevel(0);
      await instance.remove();

      const history = await bucket.history(1);
      expect(history[0], "Wrong element").to.eq(await instance.getAddress());
      expect(Number(history[1]), "Wrong operation type").to.eq(3);
    });
  });

  describe("Setting the parent", () => {
    it("only works for bucket participants", async () => {
      const instance = await createElement();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setParent(ethers.ZeroAddress)
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("notifies the bucket of the update", async () => {
      const instance = await createElement();
      await instance.setParent(ethers.ZeroAddress);

      const history = await bucket.history(1);
      expect(history[0], "Wrong element").to.eq(await instance.getAddress());
      expect(Number(history[1]), "Wrong operation type").to.eq(2);
    });
  });

  describe("Requesting data", () => {
    it("emits event", async () => {
      const instance = await createElement();
      const receipt = await instance.requestData();
      expect(receipt)
        .to.emit(instance, "Request")
        .withArgs(await instance.getAddress(), ACCOUNT_0_ADDRESS);
    });
  });

  describe("Announce holding data", () => {
    it("only works for bucket participants", async () => {
      const instance = await createElement();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .announceHolding()
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("increases holder count", async () => {
      const instance = await createElement();
      await instance.announceHolding();
      const holding = await instance.holders(ACCOUNT_0_ADDRESS);
      expect(holding, "Wrong holding").to.be.true;
    });

    it("emits event", async () => {
      const instance = await createElement();
      const receipt = await instance.announceHolding();
      expect(receipt)
        .to.emit(instance, "HoldersCountChanged")
        .withArgs(await instance.getAddress(), 1);
    });
  });

  describe("Announce removing data", () => {
    it("only works for bucket participants", async () => {
      const instance = await createElement();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .announceRemoval()
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("decreases holder count", async () => {
      const instance = await createElement();
      await instance.announceRemoval();
      const holding = await instance.holders(ACCOUNT_0_ADDRESS);
      expect(holding, "Wrong holding").to.be.false;
    });

    it("emits event", async () => {
      const instance = await createElement();
      await instance.announceHolding();
      const receipt = await instance.announceRemoval();
      expect(receipt)
        .to.emit(instance, "HoldersCountChanged")
        .withArgs(await instance.getAddress(), 0);
    });
  });

  describe("Setting the redundancy level", () => {
    it("only works for bucket participants", async () => {
      const instance = await createElement();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setRedundancyLevel(1)
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("updates redundancy correctly", async () => {
      const instance = await createElement();
      await instance.setRedundancyLevel(2);
      const level = await instance.redundancy();
      expect(Number(level), "Wrong level").to.eq(2);
    });
  });
});
