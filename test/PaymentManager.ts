import { PaymentManagerInstance } from '../types/truffle-contracts';

const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  time,
} = require('@openzeppelin/test-helpers');

// const Bucket = artifacts.require("Bucket");
// const ParticipantManager = artifacts.require("ParticipantManager");
// const PubKeyChecker = artifacts.require("PubKeyChecker");
const CreditChecker = artifacts.require('CreditChecker');
const PaymentManager = artifacts.require('PaymentManager');

contract('PaymentManager', (accounts) => {
  let paymentManager: PaymentManagerInstance;

  beforeEach(async () => {
    const creditChecker = await CreditChecker.new();
    PaymentManager.link('CreditChecker', creditChecker.address);
    paymentManager = await PaymentManager.new(1000000000000000, 100);
  });

  describe('Getting the data', () => {
    it('Works as expected', async () => {
      const defaultLimitAdd = await paymentManager.DEFAULT_LIMITS(0);
      assert(defaultLimitAdd.eq(new BN(100)), 'Default limit (add) incorrect!');

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

      const freeOfCharge0 = await paymentManager.isFreeOfCharge(accounts[0], 0);
      const freeOfCharge1 = await paymentManager.isFreeOfCharge(accounts[0], 1);
      const freeOfCharge2 = await paymentManager.isFreeOfCharge(accounts[0], 2);
      expect(!freeOfCharge0, 'freeOfCharge0 incorrect!');
      expect(!freeOfCharge1, 'freeOfCharge1 incorrect!');
      expect(!freeOfCharge2, 'freeOfCharge2 incorrect!');

      const voucherCount0 = await paymentManager.getVoucherCount(
        accounts[0],
        0
      );
      const voucherCount1 = await paymentManager.getVoucherCount(
        accounts[0],
        1
      );
      const voucherCount2 = await paymentManager.getVoucherCount(
        accounts[0],
        2
      );
      expect(voucherCount0.eq(new BN(0)), 'voucherCount0 incorrect!');
      expect(voucherCount1.eq(new BN(0)), 'voucherCount1 incorrect!');
      expect(voucherCount2.eq(new BN(0)), 'voucherCount2 incorrect!');

      const limit = await paymentManager.getLimit(accounts[0], 0);
      expect(limit.eq(new BN(0)), 'limit incorrect!');

      const balance = await paymentManager.getBalance(accounts[0]);
      expect(balance.eq(new BN(0)), 'balance incorrect!');
    });
  });

  describe('Decreasing a limit', () => {
    it('initializes the limit for an account if not yet initialized', async () => {
      const limit = await paymentManager.getLimit(accounts[0], 0);
      await paymentManager.decreaseLimit(0, 1);
      const limitAfter = await paymentManager.getLimit(accounts[0], 0);
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
      const limit = await paymentManager.getLimit(accounts[0], 0);
      await paymentManager.decreaseLimit(0, 1);
      const limitAfter = await paymentManager.getLimit(accounts[0], 0);
      expect(limitAfter.lt(limit), 'Limit decreasing failed.');
    });

    it('emits event', async () => {
      const receipt = await paymentManager.decreaseLimit(0, 1);
      expectEvent(receipt, 'LimitedActionEvent', {
        _action: new BN(0),
        _sender: accounts[0],
        limitLeftOver: new BN(99),
      });
    });
  });

  describe('Increasing a limit', () => {
    it('initializes the limit for an account if not yet initialized', async () => {
      const limit = await paymentManager.getLimit(accounts[0], 0);
      await paymentManager.increaseLimit(0, 1, accounts[0]);
      const limitAfter = await paymentManager.getLimit(accounts[0], 0);
      expect(limit.eq(new BN(0)), 'Limit already initialized.');
      expect(limit.lt(limitAfter), 'Limit initializing failed.');
    });

    it('only works for owner', async () => {
      await expectRevert(
        paymentManager.increaseLimit(0, 101, accounts[1], {
          from: accounts[1],
        }),
        'caller is not the owner'
      );
    });

    it('increases the limit of an account', async () => {
      const limit = await paymentManager.getLimit(accounts[0], 0);
      await paymentManager.increaseLimit(0, 1, accounts[0]);
      const limitAfter = await paymentManager.getLimit(accounts[0], 0);
      expect(limitAfter.gt(limit), 'Limit increasing failed.');
    });

    it('emits event', async () => {
      const receipt = await paymentManager.increaseLimit(0, 1, accounts[0]);
      expectEvent(receipt, 'LimitedActionEvent', {
        _action: new BN(0),
        _sender: accounts[0],
        limitLeftOver: new BN(101),
      });
    });
  });

  describe('Charging a fee', () => {
    it('does not charge if free of charge', async () => {
      await paymentManager.unleashPayableActionForAccount(accounts[0], 0);
      const balance = await paymentManager.getBalance(accounts[0]);
      const vouchers = await paymentManager.getVoucherCount(accounts[0], 0);
      const receipt = await paymentManager.chargeFee(0);
      const balanceAfter = await paymentManager.getBalance(accounts[0]);
      const vouchersAfter = await paymentManager.getVoucherCount(
        accounts[0],
        0
      );
      assert(balance.eq(balanceAfter), 'Balance incorrect.');
      assert(vouchers.eq(vouchersAfter), 'Vourchers incorrect.');
      expectEvent(receipt, 'PayableActionEvent', {
        _action: new BN(0),
        _sender: accounts[0],
        fee: new BN(0),
        voucher: false,
        unlimited: true,
      });
    });

    it('first charges vouchers if existing', async () => {
      await paymentManager.addVoucher(accounts[0], 0, 1);
      const balance = await paymentManager.getBalance(accounts[0]);
      const vouchers = await paymentManager.getVoucherCount(accounts[0], 0);
      const receipt = await paymentManager.chargeFee(0);
      const balanceAfter = await paymentManager.getBalance(accounts[0]);
      const vouchersAfter = await paymentManager.getVoucherCount(
        accounts[0],
        0
      );
      assert(balance.eq(balanceAfter), 'Balance incorrect.');
      assert(vouchers.gt(vouchersAfter), 'Vourchers incorrect.');
      expectEvent(receipt, 'PayableActionEvent', {
        _action: new BN(0),
        _sender: accounts[0],
        fee: new BN(1),
        voucher: true,
        unlimited: false,
      });
    });

    it('then charges credits if existing', async () => {
      await paymentManager.send(2000000000000000);
      const balance = await paymentManager.getBalance(accounts[0]);
      const vouchers = await paymentManager.getVoucherCount(accounts[0], 0);
      const receipt = await paymentManager.chargeFee(0);
      const balanceAfter = await paymentManager.getBalance(accounts[0]);
      const vouchersAfter = await paymentManager.getVoucherCount(
        accounts[0],
        0
      );
      assert(balance.gt(balanceAfter), 'Balance incorrect.');
      assert(vouchers.eq(vouchersAfter), 'Vourchers incorrect.');
      expectEvent(receipt, 'PayableActionEvent', {
        _action: new BN(0),
        _sender: accounts[0],
        fee: new BN(0),
        voucher: false,
        unlimited: false,
      });
    });

    it('finally charges the msg value if existing', async () => {
      const balance = await paymentManager.getBalance(accounts[0]);
      const vouchers = await paymentManager.getVoucherCount(accounts[0], 0);
      const receipt = await paymentManager.chargeFee(0, {
        value: new BN(1000000000000000),
      });
      const balanceAfter = await paymentManager.getBalance(accounts[0]);
      const vouchersAfter = await paymentManager.getVoucherCount(
        accounts[0],
        0
      );
      assert(balance.eq(balanceAfter), 'Balance incorrect.');
      assert(vouchers.eq(vouchersAfter), 'Vourchers incorrect.');
      expectEvent(receipt, 'PayableActionEvent', {
        _action: new BN(0),
        _sender: accounts[0],
        fee: new BN(1000000000000000),
        voucher: false,
        unlimited: false,
      });
    });
  });

  describe('Adding credits', () => {
    it('works as expected', async () => {
      const accounts0PrivKey =
        '0x6f8074f4d89c4adc637b1afe3f11a14e38953b2df56527a6958ad4bc2a0e411d';

      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(hash, accounts0PrivKey);

      const balance = await paymentManager.getBalance(accounts[1]);
      await paymentManager.addCredits(
        accounts[1],
        credit,
        random,
        signResult.signature,
        { value: new BN(credit) }
      );
      const balanceAfter = await paymentManager.getBalance(accounts[1]);
      assert(balance.eq(new BN(0)), 'Balance incorrect!');
      assert(balanceAfter.eq(new BN(credit)), 'Balance incorrect!');
    });

    it('works only once for a signature', async () => {
      const accounts0PrivKey =
        '0x6f8074f4d89c4adc637b1afe3f11a14e38953b2df56527a6958ad4bc2a0e411d';

      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(hash, accounts0PrivKey);

      await paymentManager.addCredits(
        accounts[1],
        credit,
        random,
        signResult.signature,
        { value: new BN(credit) }
      );

      await expectRevert(
        paymentManager.addCredits(
          accounts[1],
          credit,
          random,
          signResult.signature,
          { value: new BN(credit) }
        ),
        'Already used'
      );
    });
  });

  describe('Unleashing a payable action for an account', () => {
    it('works as expected', async () => {
      await paymentManager.unleashPayableActionForAccount(accounts[0], 0);
      const freeOfCharge = await paymentManager.isFreeOfCharge(accounts[0], 0);
      assert(freeOfCharge, 'Not free of charge');
    });
  });

  describe('Adding a voucher', () => {
    it('works as expected', async () => {
      await paymentManager.addVoucher(accounts[0], 0, 10);
      const vouchers = await paymentManager.getVoucherCount(accounts[0], 0);
      assert(vouchers.eq(new BN(10)), 'Vouchers incorrect');
    });
  });

  describe('Adding a limit', () => {
    it('works as expected', async () => {
      await paymentManager.addLimit(accounts[0], 0, 10);
      const limit = await paymentManager.getLimit(accounts[0], 0);
      assert(limit.eq(new BN(10)), 'Limit incorrect');
    });
  });

  describe('Setting the default fee', () => {
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
    it('works as expected', async () => {
      await paymentManager.setDefaultLimit(1);
      const defaultLimit0 = await paymentManager.DEFAULT_LIMITS(0);
      assert(defaultLimit0.eq(new BN(1)));
    });
  });

  describe('Manufacturer withdraw', () => {
    it('sends all ether to owner', async () => {
      const balanceBefore = await web3.eth.getBalance(accounts[0]);
      await paymentManager.send(1000000000000000);
      const balanceAfter = await web3.eth.getBalance(accounts[0]);
      await paymentManager.manufacturerWithdraw();
      const balanceLast = await web3.eth.getBalance(accounts[0]);
      const owner = await paymentManager.owner();

      assert(owner === accounts[0], 'Wrong owner.');
      assert(balanceBefore > balanceAfter, 'Balances 1 not equal.');
      assert(balanceLast > balanceAfter, 'Balances 2 not equal.');
      assert(balanceBefore > balanceLast, 'Balances 3 not equal.');
    });
  });

  describe('Sending ether to the payment manager', () => {
    it('increases the balance of the sender', async () => {
      await paymentManager.send(1000);
      const balance = await paymentManager.getBalance(accounts[0]);
      assert(balance.eq(new BN(1000)), 'Balance incorrect.');
    });
  });
});

export {};
