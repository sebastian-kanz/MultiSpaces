import { getAccountKeys } from "./helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
  BucketMockElem,
  Element,
  ParticipantManager,
  PaymentManager,
} from "../typechain-types";

const {
  ACCOUNT_0_PUBLIC_KEY,
  ACCOUNT_0_ADDRESS,
  ACCOUNT_1_ADDRESS,
  ACCOUNT_1_PUBLIC_KEY,
} = getAccountKeys();

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
          CreditChecker: creditChecker.address,
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
          InvitationChecker: invitationChecker.address,
          PubKeyChecker: pubKeyChecker.address,
        },
      }
    );

    participantManager = await ParticipantManager.deploy(
      "Peter Parker",
      ACCOUNT_0_ADDRESS,
      ACCOUNT_0_PUBLIC_KEY,
      paymentManager.address
    );

    const Bucket = await hre.ethers.getContractFactory("BucketMockElem");
    bucket = await Bucket.deploy();

    const Element = await hre.ethers.getContractFactory("Element");
    element = await Element.deploy();
    const elemImpl = await Element.deploy();
    bucket.initialize(
      paymentManager.address,
      participantManager.address,
      elemImpl.address
    );
  });

  const createElement = async () => {
    const Element = await hre.ethers.getContractFactory("Element");
    const instance = await Element.deploy();
    await bucket.mockRegisterElement(instance.address);
    await instance.initialize(
      {
        creator: ACCOUNT_0_ADDRESS,
        participantManager: participantManager.address,
        parent: ethers.constants.AddressZero,
        previous: ethers.constants.AddressZero,
        bucket: bucket.address,
        elemImpl: element.address,
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
      expect(meta === "meta", "Wrong meta");
      const data = await instance.dataHash();
      expect(data === "data", "Wrong data");
      const container = await instance.containerHash();
      expect(container === "container", "Wrong container");
      const contentType = await instance.contentType();
      expect(contentType.eq(0), "Wrong contentType");
      const creator = await instance.creator();
      expect(creator === ACCOUNT_0_ADDRESS, "Wrong creator");
      const parent = await instance.parentElement();
      expect(parent === ethers.constants.AddressZero, "Wrong parent");
      const previous = await instance.previousElement();
      expect(previous === ethers.constants.AddressZero, "Wrong previous");
      const next = await instance.nextElement();
      expect(next === instance.address, "Wrong next");
      const parentBucket = await instance.parentBucket();
      expect(parentBucket === bucket.address, "Wrong parentBucket");
      const elemImpl = await instance.elemImpl();
      expect(elemImpl === element.address, "Wrong elemImpl");

      const holdersCount = await instance.holdersCount();
      expect(holdersCount.eq(1), "Wrong holdersCount");

      const redundancy = await instance.redundancy();
      expect(redundancy === 1, "Wrong redundancy");
      const minRedundancy = await instance.minRedundancy();
      expect(minRedundancy === 0, "Wrong minRedundancy");
    });

    it("notifies the bucket of the creation", async () => {
      const instance = await createElement();
      const history = await bucket.history(0);
      expect(history[0] === instance.address, "Wrong element");
      expect(history[1] === 0, "Wrong operation type");
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
            ethers.constants.AddressZero
          )
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("only works if keys are available", async () => {
      const instance = await createElement();

      await expect(
        instance.update(
          { meta: "meta2", data: "data2", container: "container2" },
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith(new RegExp(/No key available!/));
    });

    it("only works if not already updated", async () => {
      const instance = await createElement();
      await bucket.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);

      await instance.update(
        { meta: "meta2", data: "data2", container: "container2" },
        ethers.constants.AddressZero
      );

      await expect(
        instance.update(
          { meta: "meta3", data: "data3", container: "container3" },
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith(new RegExp(/Newer version already exists/));
    });

    it("only works if new hashes do not yet exist", async () => {
      await bucket.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);
      await bucket.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [ethers.constants.AddressZero],
        0
      );
      const adr = await bucket.allElements(0);
      const instance = await hre.ethers.getContractAt("Element", adr);

      await expect(
        instance.update(
          { meta: "meta", data: "data", container: "container" },
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith(new RegExp(/New meta already exists/));
      await expect(
        instance.update(
          { meta: "meta2", data: "data", container: "container" },
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith(new RegExp(/New data already exists/));
      await expect(
        instance.update(
          { meta: "meta2", data: "data2", container: "container" },
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith(new RegExp(/New container already exists/));
    });

    it("notifies the bucket of the creation of the new element", async () => {
      const instance = await createElement();
      await bucket.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);

      await instance.update(
        { meta: "meta2", data: "data2", container: "container2" },
        ethers.constants.AddressZero
      );

      const history = await bucket.history(1);
      expect(history[0] != instance.address, "Wrong element");
      expect(history[1] === 0, "Wrong operation type");
      const history2 = await bucket.history(2);
      expect(history2[0] != instance.address, "Wrong element");
      expect(history2[1] === 1, "Wrong operation type");
    });

    it("set previous <-> next relationship correctly", async () => {
      await bucket.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);
      await bucket.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [ethers.constants.AddressZero],
        0
      );
      const adr = await bucket.allElements(0);
      const instance = await hre.ethers.getContractAt("Element", adr);
      await instance.update(
        { meta: "meta2", data: "data2", container: "container2" },
        ethers.constants.AddressZero
      );

      const next = await instance.nextElement();
      const adr2 = await bucket.allElements(1);
      const instance2 = await hre.ethers.getContractAt("Element", adr2);
      const previous = await instance2.previousElement();
      expect(next === instance2.address, "Wrong next element");
      expect(previous === instance.address, "Wrong previous element");
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
      expect(history[0] === instance.address, "Wrong element");
      expect(history[1] === 3, "Wrong operation type");
    });
  });

  describe("Setting the parent", () => {
    it("only works for bucket participants", async () => {
      const instance = await createElement();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setParent(ethers.constants.AddressZero)
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("notifies the bucket of the update", async () => {
      const instance = await createElement();
      await instance.setParent(ethers.constants.AddressZero);

      const history = await bucket.history(1);
      expect(history[0] === instance.address, "Wrong element");
      expect(history[1] === 2, "Wrong operation type");
    });
  });

  describe("Requesting data", () => {
    it("emits event", async () => {
      const instance = await createElement();
      const receipt = await instance.requestData();
      expect(receipt)
        .to.emit(instance, "Request")
        .withArgs(instance.address, ACCOUNT_0_ADDRESS);
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
      expect(holding, "Wrong holding");
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
      expect(!holding, "Wrong holding");
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
      expect(level === 2, "Wrong level");
    });
  });
});
