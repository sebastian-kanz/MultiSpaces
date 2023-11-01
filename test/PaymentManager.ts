import { getAccountKeys } from "./helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { PaymentManager } from "../typechain-types";

const { ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } = getAccountKeys();

describe("PaymentManager", () => {
  let paymentManager: PaymentManager;

  beforeEach(async () => {
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
  });

  describe("Getting the data", () => {
    it("Works as expected", async () => {
      const defaultLimitAdd = await paymentManager.DEFAULT_LIMITS(0);
      expect(Number(defaultLimitAdd), "Default limit (add) incorrect!").to.eq(
        100
      );
      const limitPrice = await paymentManager.limitPrice();
      expect(Number(limitPrice), "Limit price incorrect!").to.eq(1000000000000);
      const defaultPaymentCreate = await paymentManager.DEFAULT_PAYMENTS(0);
      const defaultPaymentAdd = await paymentManager.DEFAULT_PAYMENTS(1);
      const defaultPaymentParticipant = await paymentManager.DEFAULT_PAYMENTS(
        2
      );
      expect(
        Number(defaultPaymentCreate),
        "Default payment (create) incorrect!"
      ).to.eq(1000000000000000);
      expect(
        Number(defaultPaymentAdd),
        "Default payment (add) incorrect!"
      ).to.eq(1000000000000000);
      expect(
        Number(defaultPaymentParticipant),
        "Default payment (participant) incorrect!"
      ).to.eq(1000000000000000);
      const freeOfCharge0 = await paymentManager.isFreeOfCharge(
        ACCOUNT_0_ADDRESS,
        0
      );
      const freeOfCharge1 = await paymentManager.isFreeOfCharge(
        ACCOUNT_0_ADDRESS,
        1
      );
      const freeOfCharge2 = await paymentManager.isFreeOfCharge(
        ACCOUNT_0_ADDRESS,
        2
      );
      expect(freeOfCharge0, "freeOfCharge0 incorrect!").to.be.false;
      expect(freeOfCharge1, "freeOfCharge1 incorrect!").to.be.false;
      expect(freeOfCharge2, "freeOfCharge2 incorrect!").to.be.false;
      const voucherCount0 = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      const voucherCount1 = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        1
      );
      const voucherCount2 = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        2
      );
      expect(Number(voucherCount0), "voucherCount0 incorrect!").to.eq(0);
      expect(Number(voucherCount1), "voucherCount1 incorrect!").to.eq(0);
      expect(Number(voucherCount2), "voucherCount2 incorrect!").to.eq(0);
      const limit = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      expect(Number(limit), "limit incorrect!").to.eq(0);
      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      expect(Number(balance), "balance incorrect!").to.eq(0);
    });
  });

  describe("Decreasing a limit", () => {
    it("initializes the limit for an account if not yet initialized", async () => {
      const limit = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.decreaseLimit(0, 1);
      const limitAfter = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      expect(Number(limit), "Limit already initialized.").to.eq(0);
      expect(Number(limit), "Limit initializing failed.").to.be.lt(
        Number(limitAfter)
      );
    });

    it("fails if limit is depleted", async () => {
      await expect(paymentManager.decreaseLimit(0, 101)).to.be.revertedWith(
        new RegExp(/Limit depleted/)
      );
    });

    it("decreases the limit of an account", async () => {
      await paymentManager.decreaseLimit(0, 1);
      const limit = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.decreaseLimit(0, 1);
      const limitAfter = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      expect(Number(limitAfter), "Limit decreasing failed.").to.be.lt(
        Number(limit)
      );
    });

    it("emits event", async () => {
      const receipt = await paymentManager.decreaseLimit(0, 1);
      expect(receipt)
        .to.emit(paymentManager, "LimitedActionEvent")
        .withArgs(0, ACCOUNT_0_ADDRESS, 99);
    });

    it("does not decrease limit if unlimited", async () => {
      await paymentManager.decreaseLimit(0, 1);
      await paymentManager.setAccountUnlimited(ACCOUNT_0_ADDRESS, 0, true);
      const limitBefore = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.decreaseLimit(0, 1);
      const limitAfter = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      expect(
        Number(limitBefore),
        "Limit should not have been decreased."
      ).to.eq(Number(limitAfter));
    });
  });

  describe("Increasing a limit", () => {
    it("initializes the limit for an account if not yet initialized", async () => {
      const limit = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.increaseLimit(0, 1, ACCOUNT_0_ADDRESS);
      const limitAfter = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      expect(Number(limit), "Limit already initialized.").to.eq(0);
      expect(Number(limit), "Limit initializing failed.").to.be.lt(
        Number(limitAfter)
      );
    });

    it("works for owner without value", async () => {
      await paymentManager.increaseLimit(0, 1, ACCOUNT_0_ADDRESS);
    });

    it("only works for others with valid value", async () => {
      await expect(
        paymentManager
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .increaseLimit(0, 1000000000000, ACCOUNT_1_ADDRESS)
      ).to.be.revertedWith(new RegExp(/Amount and sent value mismatch./));
    });

    it("increases the limit of an account", async () => {
      const limit = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.increaseLimit(0, 1, ACCOUNT_0_ADDRESS);
      const limitAfter = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      expect(Number(limitAfter), "Limit increasing failed.").to.be.gt(
        Number(limit)
      );
    });

    it("emits event", async () => {
      const receipt = await paymentManager.increaseLimit(
        0,
        1000000000000,
        ACCOUNT_0_ADDRESS
      );
      expect(receipt)
        .to.emit(paymentManager, "LimitedActionEvent")
        .withArgs(0, ACCOUNT_0_ADDRESS, 101);
    });
  });

  describe("Charging a fee", () => {
    it("does not charge if free of charge", async () => {
      await paymentManager.setAccountFreeOfCharge(ACCOUNT_0_ADDRESS, 0, true);
      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchers = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      const receipt = await paymentManager.chargeFee(0);
      const balanceAfter = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchersAfter = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(Number(balance), "Balance incorrect.").to.eq(Number(balanceAfter));
      expect(Number(vouchers), "Vourchers incorrect.").to.eq(
        Number(vouchersAfter)
      );
      expect(receipt)
        .to.emit(paymentManager, "PayableActionEvent")
        .withArgs(0, ACCOUNT_0_ADDRESS, 0, false, true);
    });

    it("first charges vouchers if existing", async () => {
      await paymentManager.addVoucher(ACCOUNT_0_ADDRESS, 0, 1);
      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchers = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      const receipt = await paymentManager.chargeFee(0);
      const balanceAfter = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchersAfter = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(Number(balance), "Balance incorrect.").to.eq(Number(balanceAfter));
      expect(Number(vouchers), "Vourchers incorrect.").to.be.gt(
        Number(vouchersAfter)
      );
      expect(receipt)
        .to.emit(paymentManager, "PayableActionEvent")
        .withArgs(0, ACCOUNT_0_ADDRESS, 1, true, false);
    });

    it("then charges credits if existing", async () => {
      const signer = await ethers.getSigner(ACCOUNT_0_ADDRESS);
      const tx = {
        to: await paymentManager.getAddress(),
        value: 2000000000000000,
      };
      await signer.sendTransaction(tx);
      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchers = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      const receipt = await paymentManager.chargeFee(0);
      const balanceAfter = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchersAfter = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(Number(balance), "Balance incorrect.").to.be.gt(
        Number(balanceAfter)
      );
      expect(Number(vouchers), "Vourchers incorrect.").to.eq(
        Number(vouchersAfter)
      );
      expect(receipt)
        .to.emit(paymentManager, "PayableActionEvent")
        .withArgs(0, ACCOUNT_0_ADDRESS, 0, false, false);
    });

    it("finally charges the msg value if existing", async () => {
      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchers = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      const receipt = await paymentManager.chargeFee(0, {
        value: 1000000000000000,
      });
      const balanceAfter = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchersAfter = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(Number(balance), "Balance incorrect.").to.eq(Number(balanceAfter));
      expect(Number(vouchers), "Vourchers incorrect.").to.eq(
        Number(vouchersAfter)
      );
      expect(receipt)
        .to.emit(paymentManager, "PayableActionEvent")
        .withArgs(0, ACCOUNT_0_ADDRESS, 1000000000000000, false, false);
    });
  });

  describe("Redeeming credits", () => {
    it("works as expected", async () => {
      const credit = 1;
      const random = "This is a random invitation code";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(
          ["uint256", "string"],
          [credit, random]
        )
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      const balance = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      await paymentManager.redeemCredit(
        ACCOUNT_1_ADDRESS,
        credit,
        random,
        signResult,
        { value: credit }
      );
      const balanceAfter = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      expect(Number(balance), "Balance incorrect!").to.eq(0);
      expect(Number(balanceAfter), "Balance incorrect!").to.eq(1);
    });

    it("works only once for a signature", async () => {
      const credit = 1;
      const random = "This is a random invitation code";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(
          ["uint256", "string"],
          [credit, random]
        )
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      await paymentManager.redeemCredit(
        ACCOUNT_1_ADDRESS,
        credit,
        random,
        signResult,
        { value: credit }
      );
      await expect(
        paymentManager.redeemCredit(
          ACCOUNT_1_ADDRESS,
          credit,
          random,
          signResult,
          { value: credit }
        )
      ).to.be.revertedWith(new RegExp(/Already used/));
    });
  });

  describe("Increasing credits", () => {
    it("works as expected", async () => {
      const creditsBefore = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      await paymentManager.increaseCredits(ACCOUNT_1_ADDRESS, {
        value: 100,
      });
      const creditsAfter = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      expect(Number(creditsAfter)).to.eq(Number(creditsBefore) + 100);
    });
  });

  describe("Sending ether to the payment manager", () => {
    it("increases the balance of the sender", async () => {
      const signer = await ethers.getSigner(ACCOUNT_0_ADDRESS);
      const tx = {
        to: await paymentManager.getAddress(),
        value: 1000,
      };
      await signer.sendTransaction(tx);
      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      expect(Number(balance), "Balance incorrect.").to.eq(1000);
    });
  });

  describe("Transfering credits", () => {
    it("increases receiver's credits with amount", async () => {
      const signer = await ethers.getSigner(ACCOUNT_0_ADDRESS);
      const tx = {
        to: await paymentManager.getAddress(),
        value: 1000,
      };
      await signer.sendTransaction(tx);
      const creditsBefore = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      await paymentManager.transferCredits(10, ACCOUNT_1_ADDRESS);
      const creditsAfter = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      expect(Number(creditsAfter), "Wrong credit amount.").to.eq(
        Number(creditsBefore) + 10
      );
    });

    it("fails if sender's balance in insufficient", async () => {
      await expect(
        paymentManager.transferCredits(1, ACCOUNT_0_ADDRESS)
      ).to.be.revertedWith(new RegExp(/Insufficient credits/));
    });
  });

  describe("Setting an account free of charge", () => {
    it("only works for owner", async () => {
      await expect(
        paymentManager
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setAccountFreeOfCharge(ACCOUNT_1_ADDRESS, 0, true)
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });

    it("works as expected", async () => {
      await paymentManager.setAccountFreeOfCharge(ACCOUNT_0_ADDRESS, 0, true);
      const freeOfCharge = await paymentManager.isFreeOfCharge(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(freeOfCharge, "Not free of charge").to.be.true;
    });
  });

  describe("Setting an account unlimited", () => {
    it("only works for owner", async () => {
      await expect(
        paymentManager
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setAccountUnlimited(ACCOUNT_1_ADDRESS, 0, true)
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });

    it("works as expected", async () => {
      await paymentManager.setAccountUnlimited(ACCOUNT_0_ADDRESS, 0, true);
      const unlimited = await paymentManager.isUnlimited(ACCOUNT_0_ADDRESS, 0);
      expect(unlimited, "Not unlimited.").to.be.true;
    });
  });

  describe("Adding a voucher", () => {
    it("only works for owner", async () => {
      await expect(
        paymentManager
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .addVoucher(ACCOUNT_1_ADDRESS, 0, 10)
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });

    it("works as expected", async () => {
      await paymentManager.addVoucher(ACCOUNT_0_ADDRESS, 0, 10);
      const vouchers = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(Number(vouchers), "Vouchers incorrect").to.eq(10);
    });
  });

  describe("Adding a limit", () => {
    it("works as expected", async () => {
      await paymentManager.addLimit(ACCOUNT_0_ADDRESS, 0, 10);
      const limit = await paymentManager.getLimit(ACCOUNT_0_ADDRESS, 0);
      expect(Number(limit), "Limit incorrect").to.eq(110);
    });
  });

  describe("Setting the default fee", () => {
    it("only works for owner", async () => {
      await expect(
        paymentManager
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setDefaultFee(1)
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });

    it("works as expected", async () => {
      await paymentManager.setDefaultFee(1);
      const defaultPayment0 = await paymentManager.DEFAULT_PAYMENTS(0);
      const defaultPayment1 = await paymentManager.DEFAULT_PAYMENTS(1);
      const defaultPayment2 = await paymentManager.DEFAULT_PAYMENTS(2);
      expect(Number(defaultPayment0)).to.eq(1);
      expect(Number(defaultPayment1)).to.eq(1);
      expect(Number(defaultPayment2)).to.eq(1);
    });
  });

  describe("Setting the default limit", () => {
    it("only works for owner", async () => {
      await expect(
        paymentManager
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .setDefaultLimit(1)
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });

    it("works as expected", async () => {
      await paymentManager.setDefaultLimit(1);
      const defaultLimit0 = await paymentManager.DEFAULT_LIMITS(0);
      expect(Number(defaultLimit0)).to.eq(1);
    });
  });

  describe("Manufacturer withdraw", () => {
    it("only works for owner", async () => {
      await expect(
        paymentManager
          .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
          .manufacturerWithdraw()
      ).to.be.revertedWith(new RegExp(/caller is not the owner/));
    });

    it("sends all ether to owner", async () => {
      const signer = await ethers.getSigner(ACCOUNT_0_ADDRESS);
      const balanceBefore = await ethers.provider.getBalance(ACCOUNT_0_ADDRESS);
      const tx = {
        to: await paymentManager.getAddress(),
        value: 1000000000000000,
      };
      await signer.sendTransaction(tx);
      const balanceAfter = await ethers.provider.getBalance(ACCOUNT_0_ADDRESS);
      await paymentManager.manufacturerWithdraw();
      const balanceLast = await ethers.provider.getBalance(ACCOUNT_0_ADDRESS);

      const owner = await paymentManager.owner();
      expect(owner, "Wrong owner.").to.eq(ACCOUNT_0_ADDRESS);
      expect(balanceBefore, "Balances 1 not equal.").to.be.gt(balanceAfter);
      expect(balanceLast, "Balances 2 not equal.").to.be.gt(balanceAfter);
      expect(balanceBefore, "Balances 3 not equal.").to.be.gt(balanceLast);
    });
  });
});
