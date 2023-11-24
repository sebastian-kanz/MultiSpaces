import { getAccountKeys } from "./helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
  Bucket,
  BucketMock,
  Element,
  ParticipantManager,
  PaymentManager,
} from "../typechain-types";

const {
  ACCOUNT_0_PUBLIC_KEY,
  ACCOUNT_0_ADDRESS,
  ACCOUNT_1_ADDRESS,
  ACCOUNT_1_PUBLIC_KEY,
  ACCOUNT_2_ADDRESS,
  ACCOUNT_2_PUBLIC_KEY,
} = getAccountKeys();

describe("Bucket", () => {
  let participantManager: ParticipantManager;
  let paymentManager: PaymentManager;
  let element: Element;

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

    const Element = await hre.ethers.getContractFactory("Element");
    element = await Element.deploy();
  });

  const createNewBucket = async (enableMock = false) => {
    let instance: BucketMock | Bucket;

    const BucketMock = await hre.ethers.getContractFactory("BucketMock");
    const Bucket = await hre.ethers.getContractFactory("Bucket");
    if (enableMock) {
      instance = await BucketMock.deploy();
    } else {
      instance = await Bucket.deploy();
    }
    await instance.initialize(
      await paymentManager.getAddress(),
      await participantManager.getAddress(),
      await element.getAddress()
    );

    await participantManager.grantRole(
      hre.ethers.zeroPadValue("0x00", 32),
      await instance.getAddress()
    );
    return instance;
  };

  const getParticipationCodePayload = async () => {
    const randomCode = "This is a random invitation code";
    const hash = hre.ethers.getBytes(
      hre.ethers.solidityPackedKeccak256(["string"], [randomCode])
    );

    // prefixes automatically with \x19Ethereum Signed Message:\n32
    const signResult = await (
      await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
    ).signMessage(hash);

    return {
      inviter: ACCOUNT_0_ADDRESS,
      signature: signResult,
      randomCode,
    };
  };

  describe("Creating a bucket", () => {
    it("Works as expected", async () => {
      const instance = await createNewBucket();
      const expectedBlockNumber =
        instance.deploymentTransaction()?.blockNumber ?? -1;
      const genesis = await instance.GENESIS();
      const minRedundancy = await instance.minElementRedundancy();
      expect(minRedundancy).to.equal(1, "False initial minimal redundancy!");
      expect(Number(genesis) - 1, "False genesis block number!").to.eq(
        Number(expectedBlockNumber)
      );
    });
  });

  describe("Closing a bucket", () => {
    it("Works as expected", async () => {
      const instance = await createNewBucket();
      await instance.closeBucket();
    });

    it("Only works for owner", async () => {
      const instance = await createNewBucket();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .closeBucket()
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });
  });

  describe("Keys", () => {
    it("can only be added from a participant", async () => {
      const instance = await createNewBucket();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .addKeys(["key123"], [ACCOUNT_1_ADDRESS], ACCOUNT_0_PUBLIC_KEY)
      ).to.be.revertedWith(new RegExp(/is missing role/));
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
        .addKeys(["key123"], [ACCOUNT_1_ADDRESS], ACCOUNT_0_PUBLIC_KEY);
    });

    it("are checked on adding", async () => {
      const instance = await createNewBucket();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
          .addKeys([], [ACCOUNT_1_ADDRESS], ACCOUNT_0_PUBLIC_KEY)
      ).to.be.revertedWith("Invalid input");
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
          .addKeys(["key123"], [], ACCOUNT_0_PUBLIC_KEY)
      ).to.be.revertedWith("Invalid input");
    });

    it("can be read per participant", async () => {
      const instance = await createNewBucket();
      const result = await instance.addKeys(
        ["hash123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      const blockNumber = result.blockNumber ?? -1;
      const [key] = await instance.getKeyBundle(ACCOUNT_0_ADDRESS, blockNumber);
      expect(key, "Key invalid.").to.eq("hash123");
    });

    it("can not be set before contract creation", async () => {
      const rootNumber =
        (await hre.ethers.provider.getBlock("latest"))?.number ?? -1;
      const instance = await createNewBucket();
      await expect(
        instance.setKeyForParticipant(
          "keyHash",
          ACCOUNT_0_ADDRESS,
          ACCOUNT_0_PUBLIC_KEY,
          rootNumber
        )
      ).to.be.revertedWith("Block number before genesis.");
    });

    it("can be set per participant after contract creation", async () => {
      const instance = await createNewBucket();
      const blockNumber =
        (await hre.ethers.provider.getBlock("latest"))?.number ?? -1;
      await instance.setKeyForParticipant(
        "keyHash",
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        blockNumber
      );
    });

    it("can be set for participant only from a participant", async () => {
      const instance = await createNewBucket();
      const blockNumber =
        (await hre.ethers.provider.getBlock("latest"))?.number ?? -1;

      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setKeyForParticipant(
            "keyHash",
            ACCOUNT_0_ADDRESS,
            ACCOUNT_0_PUBLIC_KEY,
            blockNumber
          )
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("can not be set if already available", async () => {
      const instance = await createNewBucket();
      const blockNumber =
        (await hre.ethers.provider.getBlock("latest"))?.number ?? -1;

      await instance.setKeyForParticipant(
        "keyHash",
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        blockNumber
      );
      await expect(
        instance.setKeyForParticipant(
          "keyHash",
          ACCOUNT_0_ADDRESS,
          ACCOUNT_0_PUBLIC_KEY,
          blockNumber
        )
      ).to.be.revertedWith("Key already available!");
    });

    it("can not be set for future blocks", async () => {
      const instance = await createNewBucket();
      const blockNumber = 10000000;

      await expect(
        instance.setKeyForParticipant(
          "keyHash",
          ACCOUNT_0_ADDRESS,
          ACCOUNT_0_PUBLIC_KEY,
          blockNumber
        )
      ).to.be.revertedWith("Block time in future.");
    });
  });

  describe("Creating new elements", () => {
    it("only works for participants", async () => {
      const instance = await createNewBucket();

      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .createElements([], [], [], [], 0)
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("only works if key is available", async () => {
      const instance = await createNewBucket();
      await expect(
        instance.createElements([], [], [], [], 0)
      ).to.be.revertedWith(new RegExp(/No key available!/));
      await instance.addKeys(
        ["hash123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await instance.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [ethers.ZeroAddress],
        0
      );
    });

    it("decreases limit of bucket and not the participant", async () => {
      const instance = await createNewBucket();
      await paymentManager.initLimits(await instance.getAddress());
      const balance = await paymentManager.getLimit(
        await instance.getAddress(),
        0
      );
      expect(Number(balance), "Limit not yet initialized.").to.not.eq(0);
      await paymentManager.initLimits(ACCOUNT_0_ADDRESS);
      const balanceSender = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      expect(Number(balanceSender), "Limit not yet initialized.").to.not.eq(0);
      await instance.addKeys(
        ["hash123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await instance.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [ethers.ZeroAddress],
        0
      );
      const newBalance = await paymentManager.getLimit(
        await instance.getAddress(),
        0
      );
      const newBalanceSender = await paymentManager.getLimit(
        ACCOUNT_0_ADDRESS,
        0
      );
      const defaultBalance = await paymentManager.DEFAULT_LIMITS(0);
      expect(Number(defaultBalance), "Limit was not decreased.").to.be.gt(
        newBalance
      );
      expect(Number(balanceSender), "Limit of sender was changed.").to.eq(
        Number(newBalanceSender)
      );
    });

    it("checks workload", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(
        ["hash123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );

      await expect(
        instance.createElements(
          [
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
            "meta",
          ],
          ["data"],
          ["container"],
          [ethers.ZeroAddress],
          0
        )
      ).to.be.revertedWith(new RegExp(/Workload too high!/));
    });

    it("checks element counts", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(
        ["hash123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );

      await expect(
        instance.createElements(
          ["meta1", "meta2"],
          ["data1"],
          ["container1"],
          [ethers.ZeroAddress],
          0
        )
      ).to.be.revertedWith(new RegExp(/Invalid data hashes length/));

      await expect(
        instance.createElements(
          ["meta1", "meta2"],
          ["data1", "data2"],
          ["container1"],
          [ethers.ZeroAddress, ethers.ZeroAddress],
          0
        )
      ).to.be.revertedWith(new RegExp(/Invalid container hashes length/));

      await expect(
        instance.createElements(
          ["meta1", "meta2"],
          ["data1", "data2"],
          ["container1", "container2"],
          [ethers.ZeroAddress],
          0
        )
      ).to.be.revertedWith(new RegExp(/Invalid parents length/));
    });

    it("does not override existing elements", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(
        ["hash123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await instance.createElements(
        ["metaParent"],
        ["dataParent"],
        ["containerParent"],
        [ethers.ZeroAddress],
        0
      );
      const parent = await instance.allElements(0);
      await instance.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [parent],
        0
      );

      await expect(
        instance.createElements(
          ["meta"],
          ["data"],
          ["container"],
          [ethers.ZeroAddress],
          0
        )
      ).to.be.revertedWith(new RegExp(/Meta already exists/));

      await expect(
        instance.createElements(
          ["meta2"],
          ["data2"],
          ["container"],
          [ethers.ZeroAddress],
          0
        )
      ).to.be.revertedWith(new RegExp(/Container already exists/));
    });

    it("creates a new element for every input data set", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(
        ["hash123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
        .createElements(
          ["meta1", "meta2"],
          ["data1", "data2"],
          ["container1", "container2"],
          [ethers.ZeroAddress, ethers.ZeroAddress],
          0
        );
      const element0 = await instance.allElements(0);
      const element1 = await instance.allElements(1);
      await expect(instance.allElements(2)).to.be.reverted;
    });

    it("adds newly created elements to internal state", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(
        ["hash123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
        .createElements(
          ["meta1", "meta2"],
          ["data1", "data2"],
          ["container1", "container2"],
          [ethers.ZeroAddress, ethers.ZeroAddress],
          0
        );
      const elem1 = await instance.allElements(0);
      const elem2 = await instance.allElements(1);

      const hashExistsMeta1 = await instance.hashExists("meta1");
      expect(hashExistsMeta1, "Missing hash");
      const hashExistsMeta2 = await instance.hashExists("meta2");
      expect(hashExistsMeta2, "Missing hash");
      const hashExistsData1 = await instance.hashExists("data1");
      expect(hashExistsData1, "Missing hash");
      const hashExistsData2 = await instance.hashExists("data2");
      expect(hashExistsData2, "Missing hash");
      const hashExistsContainer1 = await instance.hashExists("container1");
      expect(hashExistsContainer1, "Missing hash");
      const hashExistsContainer2 = await instance.hashExists("container2");
      expect(hashExistsContainer2, "Missing hash");

      const history1 = await instance.history(0);
      expect(history1[0], "Wrong address").to.eq(elem1);
      expect(Number(history1[1]), "Wrong operation").to.eq(0);

      const history2 = await instance.history(1);
      expect(history2[0], "Wrong address").to.eq(elem2);
      expect(Number(history2[1]), "Wrong operation").to.eq(0);
    });
  });

  describe("Requesting participation", () => {
    it("works as expected", async () => {
      const instance = await createNewBucket();
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_1_ADDRESS)
      ).signMessage(hash);
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
        .requestParticipation(
          name,
          ACCOUNT_1_ADDRESS,
          ACCOUNT_1_PUBLIC_KEY,
          "deviceName",
          ACCOUNT_2_ADDRESS,
          ACCOUNT_2_PUBLIC_KEY,
          signResult
        );
      const participantManagerAddress = await instance.participantManager();
      const participantManager = await await hre.ethers.getContractAt(
        "ParticipantManager",
        participantManagerAddress
      );
      const count = await participantManager.participantCount();
      expect(Number(count), "Wrong participant count!").to.eq(3);
    });
  });

  describe("Accepting participation", () => {
    it("works as expected", async () => {
      const instance = await createNewBucket();
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_1_ADDRESS)
      ).signMessage(hash);
      await instance.requestParticipation(
        name,
        ACCOUNT_1_ADDRESS,
        ACCOUNT_1_PUBLIC_KEY,
        "deviceName",
        ACCOUNT_2_ADDRESS,
        ACCOUNT_2_PUBLIC_KEY,
        signResult
      );
      await instance.acceptParticipation(ACCOUNT_1_ADDRESS, {
        value: 1000000000000000,
      });
      const participantManagerAddress = await instance.participantManager();
      const participantManager = await await hre.ethers.getContractAt(
        "ParticipantManager",
        participantManagerAddress
      );
      const hasRole = await participantManager.hasRole(
        ethers.id("PARTICIPANT"),
        ACCOUNT_1_ADDRESS
      );
      expect(hasRole).to.eq(true);
    });

    it("costs fee", async () => {
      const instance = await createNewBucket();
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_1_ADDRESS)
      ).signMessage(hash);
      await instance.requestParticipation(
        name,
        ACCOUNT_1_ADDRESS,
        ACCOUNT_1_PUBLIC_KEY,
        "deviceName",
        ACCOUNT_2_ADDRESS,
        ACCOUNT_2_PUBLIC_KEY,
        signResult
      );

      await expect(
        instance.acceptParticipation(ACCOUNT_1_ADDRESS)
      ).to.be.revertedWith(new RegExp(/Insufficient fee/));
    });

    it("only works for for particpants", async () => {
      const instance = await createNewBucket();
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_1_ADDRESS)
      ).signMessage(hash);
      await instance.requestParticipation(
        name,
        ACCOUNT_1_ADDRESS,
        ACCOUNT_1_PUBLIC_KEY,
        "deviceName",
        ACCOUNT_2_ADDRESS,
        ACCOUNT_2_PUBLIC_KEY,
        signResult
      );

      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .acceptParticipation(ACCOUNT_1_ADDRESS, {
            value: 1000000000000000,
          })
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });
  });

  describe("Removing participation", () => {
    it("only works for participants", async () => {
      const instance = await createNewBucket();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .removeParticipation()
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("only works if participant is left", async () => {
      const instance = await createNewBucket();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
          .removeParticipation()
      ).to.be.revertedWith(new RegExp(/Last participant/));
    });
  });

  describe("Notifiying about a creation", () => {
    it("only works for registered elements", async () => {
      const instance = await createNewBucket();
      await expect(
        instance.notifyCreation(ACCOUNT_0_ADDRESS)
      ).to.be.revertedWith(
        new RegExp(/Only callable from registered element!/)
      );
    });

    it("adds element to history", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      await instance.notifyCreation(ACCOUNT_0_ADDRESS);
      const history = await instance.history(0);
      expect(history[0], "Wrong element address").to.eq(ACCOUNT_0_ADDRESS);
      expect(Number(history[1]), "Wrong operation type").to.eq(0);
    });

    it("emits event", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      const receipt = await instance.notifyCreation(ACCOUNT_0_ADDRESS);
      await expect(receipt)
        .to.emit(instance, "Create")
        .withArgs(ACCOUNT_0_ADDRESS, receipt.blockNumber, ACCOUNT_0_ADDRESS);
    });
  });

  describe("Pre-registering and element", () => {
    it("only works for registered elements", async () => {
      const instance = await createNewBucket();
      await expect(
        instance.preRegisterElement(ACCOUNT_0_ADDRESS)
      ).to.be.revertedWith(
        new RegExp(/Only callable from registered element!/)
      );
    });

    it("pre-registers successfully", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      await instance.preRegisterElement(ACCOUNT_0_ADDRESS);
    });
  });

  describe("Notifiying about an update", () => {
    it("only works for registered elements", async () => {
      const instance = await createNewBucket();
      await expect(
        instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS)
      ).to.be.revertedWith(
        new RegExp(/Only callable from registered element!/)
      );
    });

    it("adds element to history", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      await instance.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS);
      const history = await instance.history(0);
      expect(history[0], "Wrong element address").to.eq(ACCOUNT_0_ADDRESS);
      expect(Number(history[1]), "Wrong operation type").to.eq(1);
    });

    it("emits event", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      await instance.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      const receipt = await instance.notifyUpdate(
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_ADDRESS
      );
      expect(receipt)
        .to.emit(instance, "Update")
        .withArgs(
          ACCOUNT_0_ADDRESS,
          receipt.blockNumber,
          ACCOUNT_0_ADDRESS,
          ACCOUNT_0_ADDRESS
        );
    });

    it("checks key availability", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      await expect(
        instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS)
      ).to.be.revertedWith(new RegExp(/No key available!/));
    });

    it("decreases limit of bucket", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      const limitBefore = await paymentManager.DEFAULT_LIMITS(0);
      await instance.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS);
      const limitAfter = await paymentManager.getLimit(
        await instance.getAddress(),
        0
      );
      expect(Number(limitAfter), "Limit was not decreased.").to.be.lt(
        Number(limitBefore)
      );
    });
  });

  describe("Notifiying about a parent update", () => {
    it("only works for registered elements", async () => {
      const instance = await createNewBucket();
      await expect(
        instance.notifyUpdateParent(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS)
      ).to.be.revertedWith(
        new RegExp(/Only callable from registered element!/)
      );
    });

    it("adds element to history", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      const Element = await hre.ethers.getContractFactory("Element");
      const elem = await Element.deploy();
      await instance.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      await instance.notifyUpdateParent(
        await elem.getAddress(),
        ACCOUNT_0_ADDRESS
      );
      const history = await instance.history(0);
      expect(history[0], "Wrong element address").to.eq(
        await elem.getAddress()
      );
      expect(Number(history[1]), "Wrong operation type").to.eq(2);
    });

    it("emits event", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      const Element = await hre.ethers.getContractFactory("Element");
      const elem = await Element.deploy();
      await instance.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      const receipt = await instance.notifyUpdateParent(
        await elem.getAddress(),
        ACCOUNT_0_ADDRESS
      );
      expect(receipt)
        .to.emit(instance, "UpdateParent")
        .withArgs(
          await elem.getAddress(),
          receipt.blockNumber,
          ethers.ZeroAddress,
          ACCOUNT_0_ADDRESS
        );
    });
  });

  describe("Notifiying about a deletion", () => {
    it("only works for registered elements", async () => {
      const instance = await createNewBucket();
      await expect(
        instance.notifyDelete(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS)
      ).to.be.revertedWith(
        new RegExp(/Only callable from registered element!/)
      );
    });

    it("emits event", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      const Element = await hre.ethers.getContractFactory("Element");
      const elem = await Element.deploy();
      await instance.addKeys(
        ["key123"],
        [ACCOUNT_0_ADDRESS],
        ACCOUNT_0_PUBLIC_KEY
      );
      const receipt = await instance.notifyDelete(
        await elem.getAddress(),
        ACCOUNT_0_ADDRESS
      );
      expect(receipt)
        .to.emit(instance, "Delete")
        .withArgs(await elem.getAddress(), ACCOUNT_0_ADDRESS);
    });
  });

  describe("Setting the element implementation", () => {
    it("only works for owner", async () => {
      const instance = await createNewBucket();
      const Element = await hre.ethers.getContractFactory("Element");
      const elem = await Element.deploy();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setElementImplementation(await elem.getAddress())
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("works as expected", async () => {
      const instance = await createNewBucket();
      const Element = await hre.ethers.getContractFactory("Element");
      const elem = await Element.deploy();
      await instance.setElementImplementation(await elem.getAddress());
      const address = await instance.elementImpl();
      expect(address, "Wrong element implementation set.").to.eq(
        await elem.getAddress()
      );
    });
  });

  describe("Updating the minimal redundancy", () => {
    it("only works for participants", async () => {
      const instance = await createNewBucket();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setMinElementRedundancy(0)
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("works as expected", async () => {
      const instance = await createNewBucket();
      await instance.setMinElementRedundancy(2);
      const redundancy = await instance.minElementRedundancy();
      expect(Number(redundancy), "Wrong redundancy level set.").to.eq(2);
    });
  });
});
