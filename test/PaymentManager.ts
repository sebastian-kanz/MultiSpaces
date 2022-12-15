import { PaymentManagerInstance } from '../types/truffle-contracts';
import { getAccountKeys } from './keys.helper';

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

const CreditChecker = artifacts.require('CreditChecker');
const PaymentManager = artifacts.require('PaymentManager');

const { ACCOUNT_0_PRIVATE_KEY, ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

contract('PaymentManager', () => {
  let paymentManager: PaymentManagerInstance;

  beforeEach(async () => {
    const creditChecker = await CreditChecker.new();
    PaymentManager.link('CreditChecker', creditChecker.address);
    paymentManager = await PaymentManager.new(
      1000000000000000,
      100,
      1000000000000
    );
  });

  describe('Getting the data', () => {
    it('Works as expected', async () => {
      const defaultLimitAdd = await paymentManager.DEFAULT_LIMITS(0);
      assert(defaultLimitAdd.eq(new BN(100)), 'Default limit (add) incorrect!');

      const limitPrice = await paymentManager.limitPrice();
      assert(limitPrice.eq(new BN(1000000000000)), 'Limit price incorrect!');

      const defaultPaymentCreate = await paymentManager.DEFAULT_PAYMENTS(0);
      const defaultPaymentAdd = await paymentManager.DEFAULT_PAYMENTS(1);
      const defaultPaymentParticipant = await paymentManager.DEFAULT_PAYMENTS(
        2
      );
      expect(
        defaultPaymentCreate.eq(new BN(1000000000000000)),
        'Default payment (create) incorrect!'
      );
      expect(
        defaultPaymentAdd.eq(new BN(1000000000000000)),
        'Default payment (add) incorrect!'
      );
      expect(
        defaultPaymentParticipant.eq(new BN(1000000000000000)),
        'Default payment (participant) incorrect!'
      );

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
      expect(!freeOfCharge0, 'freeOfCharge0 incorrect!');
      expect(!freeOfCharge1, 'freeOfCharge1 incorrect!');
      expect(!freeOfCharge2, 'freeOfCharge2 incorrect!');

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
      expect(voucherCount0.eq(new BN(0)), 'voucherCount0 incorrect!');
      expect(voucherCount1.eq(new BN(0)), 'voucherCount1 incorrect!');
      expect(voucherCount2.eq(new BN(0)), 'voucherCount2 incorrect!');

      const limit = await paymentManager.getLimit.call(ACCOUNT_0_ADDRESS, 0);
      expect(limit.eq(new BN(0)), 'limit incorrect!');

      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      expect(balance.eq(new BN(0)), 'balance incorrect!');
    });
  });

  describe('Decreasing a limit', () => {
    it('initializes the limit for an account if not yet initialized', async () => {
      const limit = await paymentManager.getLimit.call(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.decreaseLimit(0, 1);
      const limitAfter = await paymentManager.getLimit.call(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(limit.eq(new BN(0)), 'Limit already initialized.');
      expect(limit.lt(limitAfter), 'Limit initializing failed.');
    });

    it('fails if limit is depleted', async () => {
      await expectRevert(
        paymentManager.decreaseLimit(0, 101),
        'Limit depleted'
      );
    });

    it('decreases the limit of an account', async () => {
      await paymentManager.decreaseLimit(0, 1);
      const limit = await paymentManager.getLimit.call(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.decreaseLimit(0, 1);
      const limitAfter = await paymentManager.getLimit.call(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(limitAfter.lt(limit), 'Limit decreasing failed.');
    });

    it('emits event', async () => {
      const receipt = await paymentManager.decreaseLimit(0, 1);
      expectEvent(receipt, 'LimitedActionEvent', {
        _action: new BN(0),
        _sender: ACCOUNT_0_ADDRESS,
        limitLeftOver: new BN(99),
      });
    });

    it('does not decrease limit if unlimited', async () => {
      await paymentManager.decreaseLimit(0, 1);
      await paymentManager.setAccountUnlimited(ACCOUNT_0_ADDRESS, 0, true);
      const limitBefore = await paymentManager.getLimit.call(
        ACCOUNT_0_ADDRESS,
        0
      );
      await paymentManager.decreaseLimit(0, 1);
      const limitAfter = await paymentManager.getLimit.call(
        ACCOUNT_0_ADDRESS,
        0
      );
      assert(
        limitBefore.eq(limitAfter),
        'Limit should not have been decreased.'
      );
    });
  });

  describe('Increasing a limit', () => {
    it('initializes the limit for an account if not yet initialized', async () => {
      const limit = await paymentManager.getLimit.call(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.increaseLimit(0, 1, ACCOUNT_0_ADDRESS);
      const limitAfter = await paymentManager.getLimit.call(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(limit.eq(new BN(0)), 'Limit already initialized.');
      expect(limit.lt(limitAfter), 'Limit initializing failed.');
    });

    it('works for owner without value', async () => {
      await paymentManager.increaseLimit(0, 1, ACCOUNT_0_ADDRESS);
    });

    it('only works for others with valid value', async () => {
      await expectRevert(
        paymentManager.increaseLimit(0, 1000000000000, ACCOUNT_1_ADDRESS, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'Amount and sent value mismatch.'
      );
    });

    it('increases the limit of an account', async () => {
      const limit = await paymentManager.getLimit.call(ACCOUNT_0_ADDRESS, 0);
      await paymentManager.increaseLimit(0, 1, ACCOUNT_0_ADDRESS);
      const limitAfter = await paymentManager.getLimit.call(
        ACCOUNT_0_ADDRESS,
        0
      );
      expect(limitAfter.gt(limit), 'Limit increasing failed.');
    });

    it('emits event', async () => {
      const receipt = await paymentManager.increaseLimit(
        0,
        1000000000000,
        ACCOUNT_0_ADDRESS
      );
      expectEvent(receipt, 'LimitedActionEvent', {
        _action: new BN(0),
        _sender: ACCOUNT_0_ADDRESS,
        limitLeftOver: new BN(101),
      });
    });
  });

  describe('Charging a fee', () => {
    it('does not charge if free of charge', async () => {
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
      assert(balance.eq(balanceAfter), 'Balance incorrect.');
      assert(vouchers.eq(vouchersAfter), 'Vourchers incorrect.');
      expectEvent(receipt, 'PayableActionEvent', {
        _action: new BN(0),
        _sender: ACCOUNT_0_ADDRESS,
        fee: new BN(0),
        voucher: false,
        unlimited: true,
      });
    });

    it('first charges vouchers if existing', async () => {
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
      assert(balance.eq(balanceAfter), 'Balance incorrect.');
      assert(vouchers.gt(vouchersAfter), 'Vourchers incorrect.');
      expectEvent(receipt, 'PayableActionEvent', {
        _action: new BN(0),
        _sender: ACCOUNT_0_ADDRESS,
        fee: new BN(1),
        voucher: true,
        unlimited: false,
      });
    });

    it('then charges credits if existing', async () => {
      await paymentManager.send(2000000000000000);
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
      assert(balance.gt(balanceAfter), 'Balance incorrect.');
      assert(vouchers.eq(vouchersAfter), 'Vourchers incorrect.');
      expectEvent(receipt, 'PayableActionEvent', {
        _action: new BN(0),
        _sender: ACCOUNT_0_ADDRESS,
        fee: new BN(0),
        voucher: false,
        unlimited: false,
      });
    });

    it('finally charges the msg value if existing', async () => {
      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchers = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      const receipt = await paymentManager.chargeFee(0, {
        value: new BN(1000000000000000),
      });
      const balanceAfter = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      const vouchersAfter = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      assert(balance.eq(balanceAfter), 'Balance incorrect.');
      assert(vouchers.eq(vouchersAfter), 'Vourchers incorrect.');
      expectEvent(receipt, 'PayableActionEvent', {
        _action: new BN(0),
        _sender: ACCOUNT_0_ADDRESS,
        fee: new BN(1000000000000000),
        voucher: false,
        unlimited: false,
      });
    });
  });

  describe('Redeeming credits', () => {
    it('works as expected', async () => {
      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );

      const balance = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      await paymentManager.redeemCredit(
        ACCOUNT_1_ADDRESS,
        credit,
        random,
        signResult.signature,
        { value: new BN(credit) }
      );
      const balanceAfter = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      assert(balance.eq(new BN(0)), 'Balance incorrect!');
      assert(balanceAfter.eq(new BN(credit)), 'Balance incorrect!');
    });

    it('works only once for a signature', async () => {
      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );

      await paymentManager.redeemCredit(
        ACCOUNT_1_ADDRESS,
        credit,
        random,
        signResult.signature,
        { value: new BN(credit) }
      );

      await expectRevert(
        paymentManager.redeemCredit(
          ACCOUNT_1_ADDRESS,
          credit,
          random,
          signResult.signature,
          { value: new BN(credit) }
        ),
        'Already used'
      );
    });
  });

  describe('Increasing credits', () => {
    it('works as expected', async () => {
      const creditsBefore = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      await paymentManager.increaseCredits(ACCOUNT_1_ADDRESS, {
        value: new BN(100),
      });
      const creditsAfter = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);

      assert(
        creditsAfter.eq(creditsBefore.add(new BN(100))),
        'Wrong credit amount.'
      );
    });
  });

  describe('Sending ether to the payment manager', () => {
    it('increases the balance of the sender', async () => {
      await paymentManager.send(1000);
      const balance = await paymentManager.getBalance(ACCOUNT_0_ADDRESS);
      assert(balance.eq(new BN(1000)), 'Balance incorrect.');
    });
  });

  describe('Transfering credits', () => {
    it("increases receiver's credits with amount", async () => {
      await paymentManager.send(1000);
      const creditsBefore = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);
      await paymentManager.transferCredits(10, ACCOUNT_1_ADDRESS);
      const creditsAfter = await paymentManager.getBalance(ACCOUNT_1_ADDRESS);

      assert(
        creditsAfter.eq(creditsBefore.add(new BN(10))),
        'Wrong credit amount.'
      );
    });

    it("fails if sender's balance in insufficient", async () => {
      await expectRevert(
        paymentManager.transferCredits(1, ACCOUNT_0_ADDRESS),
        'Insufficient credits'
      );
    });
  });

  describe('Setting an account free of charge', () => {
    it('only works for owner', async () => {
      await expectRevert(
        paymentManager.setAccountFreeOfCharge(ACCOUNT_1_ADDRESS, 0, true, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'caller is not the owner'
      );
    });

    it('works as expected', async () => {
      await paymentManager.setAccountFreeOfCharge(ACCOUNT_0_ADDRESS, 0, true);
      const freeOfCharge = await paymentManager.isFreeOfCharge(
        ACCOUNT_0_ADDRESS,
        0
      );
      assert(freeOfCharge, 'Not free of charge');
    });
  });

  describe('Setting an account unlimited', () => {
    it('only works for owner', async () => {
      await expectRevert(
        paymentManager.setAccountUnlimited(ACCOUNT_1_ADDRESS, 0, true, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'caller is not the owner'
      );
    });

    it('works as expected', async () => {
      await paymentManager.setAccountUnlimited(ACCOUNT_0_ADDRESS, 0, true);
      const unlimited = await paymentManager.isUnlimited(ACCOUNT_0_ADDRESS, 0);
      assert(unlimited, 'Not unlimited.');
    });
  });

  describe('Adding a voucher', () => {
    it('only works for owner', async () => {
      await expectRevert(
        paymentManager.addVoucher(ACCOUNT_1_ADDRESS, 0, 10, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'caller is not the owner'
      );
    });

    it('works as expected', async () => {
      await paymentManager.addVoucher(ACCOUNT_0_ADDRESS, 0, 10);
      const vouchers = await paymentManager.getVoucherCount(
        ACCOUNT_0_ADDRESS,
        0
      );
      assert(vouchers.eq(new BN(10)), 'Vouchers incorrect');
    });
  });

  describe('Adding a limit', () => {
    it('works as expected', async () => {
      await paymentManager.addLimit(ACCOUNT_0_ADDRESS, 0, 10);
      const limit = await paymentManager.getLimit.call(ACCOUNT_0_ADDRESS, 0);
      assert(limit.eq(new BN(110)), 'Limit incorrect');
    });
  });

  describe('Setting the default fee', () => {
    it('only works for owner', async () => {
      await expectRevert(
        paymentManager.setDefaultFee(1, { from: ACCOUNT_1_ADDRESS }),
        'caller is not the owner'
      );
    });

    it('works as expected', async () => {
      await paymentManager.setDefaultFee(1);
      const defaultPayment0 = await paymentManager.DEFAULT_PAYMENTS(0);
      const defaultPayment1 = await paymentManager.DEFAULT_PAYMENTS(1);
      const defaultPayment2 = await paymentManager.DEFAULT_PAYMENTS(2);
      assert(defaultPayment0.eq(new BN(1)));
      assert(defaultPayment1.eq(new BN(1)));
      assert(defaultPayment2.eq(new BN(1)));
    });
  });

  describe('Setting the default limit', () => {
    it('only works for owner', async () => {
      await expectRevert(
        paymentManager.setDefaultLimit(1, { from: ACCOUNT_1_ADDRESS }),
        'caller is not the owner'
      );
    });

    it('works as expected', async () => {
      await paymentManager.setDefaultLimit(1);
      const defaultLimit0 = await paymentManager.DEFAULT_LIMITS(0);
      assert(defaultLimit0.eq(new BN(1)));
    });
  });

  describe('Manufacturer withdraw', () => {
    it('only works for owner', async () => {
      await expectRevert(
        paymentManager.manufacturerWithdraw({ from: ACCOUNT_1_ADDRESS }),
        'caller is not the owner'
      );
    });

    it('sends all ether to owner', async () => {
      const balanceBefore = await web3.eth.getBalance(ACCOUNT_0_ADDRESS);
      await paymentManager.send(1000000000000000);
      const balanceAfter = await web3.eth.getBalance(ACCOUNT_0_ADDRESS);
      await paymentManager.manufacturerWithdraw();
      const balanceLast = await web3.eth.getBalance(ACCOUNT_0_ADDRESS);
      const owner = await paymentManager.owner();

      assert(owner === ACCOUNT_0_ADDRESS, 'Wrong owner.');
      assert(balanceBefore > balanceAfter, 'Balances 1 not equal.');
      assert(balanceLast > balanceAfter, 'Balances 2 not equal.');
      assert(balanceBefore > balanceLast, 'Balances 3 not equal.');
    });
  });
});

export {};
