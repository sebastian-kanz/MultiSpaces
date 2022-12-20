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
      paymentManager.address,
      participantManager.address,
      element.address
    );

    await participantManager.grantRole(
      hre.ethers.utils.hexZeroPad("0x00", 32),
      instance.address
    );
    return instance;
  };

  const getParticipationCodePayload = async () => {
    const randomCode = "This is a random invitation code";
    const hash = hre.ethers.utils.arrayify(
      hre.ethers.utils.solidityKeccak256(["string"], [randomCode])
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
      const expectedBlockNumber = instance.deployTransaction.blockNumber ?? -1;
      const genesis = await instance.GENESIS();
      const minRedundancy = await instance.minElementRedundancy();
      expect(minRedundancy).to.equal(1, "False initial minimal redundancy!");
      expect(
        genesis.sub(1).eq(expectedBlockNumber),
        "False genesis block number!"
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
          .addKeys(["key123"], [ACCOUNT_1_ADDRESS])
      ).to.be.revertedWith(new RegExp(/is missing role/));
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
        .addKeys(["key123"], [ACCOUNT_1_ADDRESS]);
    });

    it("are checked on adding", async () => {
      const instance = await createNewBucket();
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
          .addKeys([], [ACCOUNT_1_ADDRESS])
      ).to.be.revertedWith("Invalid input");
      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
          .addKeys(["key123"], [])
      ).to.be.revertedWith("Invalid input");
    });

    it("can be read per participant", async () => {
      const instance = await createNewBucket();
      const result = await instance.addKeys(["hash123"], [ACCOUNT_0_ADDRESS]);
      const blockNumber = result.blockNumber ?? -1;
      const epoch = await instance.EPOCH();
      const key = await instance.getKey(ACCOUNT_0_ADDRESS, blockNumber);
      // minus 3 because of 0 index (0-99), the block in blockNumber is the one before the transaction creating the contract is mined and one block is already passed by
      const key2 = await instance.getKey(
        ACCOUNT_0_ADDRESS,
        blockNumber + epoch.toNumber() - 3
      );
      expect(key === "hash123", "Key invalid.");
      expect(key === key2, "Key2 invalid.");
    });

    it("can not be set before contract creation", async () => {
      const rootNumber = await (
        await hre.ethers.provider.getBlock("latest")
      ).number;
      const instance = await createNewBucket();
      await expect(
        instance.setKeyForParticipant("keyHash", ACCOUNT_0_ADDRESS, rootNumber)
      ).to.be.revertedWith("Block number before genesis.");
    });

    it("can be set per participant after contract creation", async () => {
      const instance = await createNewBucket();
      const blockNumber = await (
        await hre.ethers.provider.getBlock("latest")
      ).number;
      await instance.setKeyForParticipant(
        "keyHash",
        ACCOUNT_0_ADDRESS,
        blockNumber
      );
    });

    it("can be set for participant only from a participant", async () => {
      const instance = await createNewBucket();
      const blockNumber = await (
        await hre.ethers.provider.getBlock("latest")
      ).number;

      await expect(
        instance
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setKeyForParticipant("keyHash", ACCOUNT_0_ADDRESS, blockNumber)
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("can not be set if already available", async () => {
      const instance = await createNewBucket();
      const blockNumber = await (
        await hre.ethers.provider.getBlock("latest")
      ).number;
      await instance.setKeyForParticipant(
        "keyHash",
        ACCOUNT_0_ADDRESS,
        blockNumber
      );
      await expect(
        instance.setKeyForParticipant("keyHash", ACCOUNT_0_ADDRESS, blockNumber)
      ).to.be.revertedWith("Key already available!");
    });

    it("can not be set for future blocks", async () => {
      const instance = await createNewBucket();
      const blockNumber = 10000000;

      await expect(
        instance.setKeyForParticipant("keyHash", ACCOUNT_0_ADDRESS, blockNumber)
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
      await instance.addKeys(["hash123"], [ACCOUNT_0_ADDRESS]);
      await instance.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [ethers.constants.AddressZero],
        0
      );
    });

    it("decreases limit of bucket and not the participant", async () => {
      const instance = await createNewBucket();
      const balance = await paymentManager.callStatic.getLimit(
        instance.address,
        0
      );
      const balanceSender = await paymentManager.callStatic.getLimit(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(!balance.eq(0), "Limit not yet initialized.");
      await instance.addKeys(["hash123"], [ACCOUNT_0_ADDRESS]);
      await instance.createElements(
        ["meta"],
        ["data"],
        ["container"],
        [ethers.constants.AddressZero],
        0
      );
      const newBalance = await paymentManager.callStatic.getLimit(
        instance.address,
        0
      );
      const newBalanceSender = await paymentManager.callStatic.getLimit(
        ACCOUNT_0_ADDRESS,
        0
      );
      const defaultBalance = await paymentManager.DEFAULT_LIMITS(0);
      expect(defaultBalance.gt(newBalance), "Limit was not decreased.");
      expect(
        balanceSender.eq(newBalanceSender),
        "Limit of sender was changed."
      );
    });

    it("checks workload", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(["hash123"], [ACCOUNT_0_ADDRESS]);

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
          [ethers.constants.AddressZero],
          0
        )
      ).to.be.revertedWith(new RegExp(/Workload too high!/));
    });

    it("checks element counts", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(["hash123"], [ACCOUNT_0_ADDRESS]);

      await expect(
        instance.createElements(
          ["meta1", "meta2"],
          ["data1"],
          ["container1"],
          [ethers.constants.AddressZero],
          0
        )
      ).to.be.revertedWith(new RegExp(/Invalid data hashes length/));

      await expect(
        instance.createElements(
          ["meta1", "meta2"],
          ["data1", "data2"],
          ["container1"],
          [ethers.constants.AddressZero, ethers.constants.AddressZero],
          0
        )
      ).to.be.revertedWith(new RegExp(/Invalid container hashes length/));

      await expect(
        instance.createElements(
          ["meta1", "meta2"],
          ["data1", "data2"],
          ["container1", "container2"],
          [ethers.constants.AddressZero],
          0
        )
      ).to.be.revertedWith(new RegExp(/Invalid parents length/));
    });

    it("does not override existing elements", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(["hash123"], [ACCOUNT_0_ADDRESS]);
      await instance.createElements(
        ["metaParent"],
        ["dataParent"],
        ["containerParent"],
        [ethers.constants.AddressZero],
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
          [ethers.constants.AddressZero],
          0
        )
      ).to.be.revertedWith(new RegExp(/Meta already exists/));

      await expect(
        instance.createElements(
          ["meta2"],
          ["data"],
          ["container"],
          [ethers.constants.AddressZero],
          0
        )
      ).to.be.revertedWith(new RegExp(/Data already exists/));

      await expect(
        instance.createElements(
          ["meta2"],
          ["data2"],
          ["container"],
          [ethers.constants.AddressZero],
          0
        )
      ).to.be.revertedWith(new RegExp(/Container already exists/));
    });

    it("creates a new element for every input data set", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(["hash123"], [ACCOUNT_0_ADDRESS]);
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
        .createElements(
          ["meta1", "meta2"],
          ["data1", "data2"],
          ["container1", "container2"],
          [ethers.constants.AddressZero, ethers.constants.AddressZero],
          0
        );
      const element0 = await instance.allElements(0);
      const element1 = await instance.allElements(1);
      await expect(instance.allElements(2)).to.be.reverted;
    });

    it("adds newly created elements to internal state", async () => {
      const instance = await createNewBucket();
      await instance.addKeys(["hash123"], [ACCOUNT_0_ADDRESS]);
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_0_ADDRESS))
        .createElements(
          ["meta1", "meta2"],
          ["data1", "data2"],
          ["container1", "container2"],
          [ethers.constants.AddressZero, ethers.constants.AddressZero],
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
      expect(history1[0] === elem1, "Wrong address");
      expect(history1[1] === 0, "Wrong operation");
      const history2 = await instance.history(0);
      expect(history2[1] === 0, "Wrong operation");
    });
  });

  describe("Redeeming participation code", () => {
    it("works as expected", async () => {
      const instance = await createNewBucket();
      const payload = await getParticipationCodePayload();
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
        .redeemParticipationCode(
          "Paul",
          payload.inviter,
          payload.signature,
          payload.randomCode,
          ACCOUNT_1_PUBLIC_KEY,
          { value: 1000000000000000 }
        );
      const participantManagerAddress = await instance.participantManager();
      const participantManager = await await hre.ethers.getContractAt(
        "ParticipantManager",
        participantManagerAddress
      );
      const count = await participantManager.participantCount();
      expect(count.eq(2), "Wrong participant count!");
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

    it("removes the sender as participant", async () => {
      const instance = await createNewBucket();
      const payload = await getParticipationCodePayload();
      await instance
        .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
        .redeemParticipationCode(
          "Paul",
          payload.inviter,
          payload.signature,
          payload.randomCode,
          ACCOUNT_1_PUBLIC_KEY,
          { value: 1000000000000000 }
        );
      await instance

        .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
        .removeParticipation();
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
      expect(history[0] === ACCOUNT_0_ADDRESS, "Wrong element address");
      expect(history[1] === 0, "Wrong operation type");
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
      await instance.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);
      await instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS);
      const history = await instance.history(0);
      expect(history[0] === ACCOUNT_0_ADDRESS, "Wrong element address");
      expect(history[1] === 1, "Wrong operation type");
    });

    it("emits event", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      await instance.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);
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
      await instance.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);
      await instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS);
      const limitAfter = await paymentManager.callStatic.getLimit(
        instance.address,
        0
      );
      expect(limitAfter.lt(limitBefore), "Limit was not decreased.");
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
      await instance.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);
      await instance.notifyUpdateParent(elem.address, ACCOUNT_0_ADDRESS);
      const history = await instance.history(0);
      expect(history[0] === elem.address, "Wrong element address");
      expect(history[1] === 2, "Wrong operation type");
    });

    it("emits event", async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMock).mockRegisterElement(ACCOUNT_0_ADDRESS);
      const Element = await hre.ethers.getContractFactory("Element");
      const elem = await Element.deploy();
      await instance.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);
      const receipt = await instance.notifyUpdateParent(
        elem.address,
        ACCOUNT_0_ADDRESS
      );
      expect(receipt)
        .to.emit(instance, "UpdateParent")
        .withArgs(
          elem.address,
          receipt.blockNumber,
          ethers.constants.AddressZero,
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
      await instance.addKeys(["key123"], [ACCOUNT_0_ADDRESS]);
      const receipt = await instance.notifyDelete(
        elem.address,
        ACCOUNT_0_ADDRESS
      );
      expect(receipt)
        .to.emit(instance, "Delete")
        .withArgs(elem.address, ACCOUNT_0_ADDRESS);
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
          .setElementImplementation(elem.address)
      ).to.be.revertedWith(new RegExp(/is missing role/));
    });

    it("works as expected", async () => {
      const instance = await createNewBucket();
      const Element = await hre.ethers.getContractFactory("Element");
      const elem = await Element.deploy();
      await instance.setElementImplementation(elem.address);
      const address = await instance.elementImpl();
      expect(address === elem.address, "Wrong element implementation set.");
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
      expect(redundancy === 2, "Wrong redundancy level set.");
    });
  });
});
