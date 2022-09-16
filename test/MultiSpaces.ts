const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const MultiSpaces = artifacts.require('MultiSpaces');
const Space = artifacts.require('Space');
const PaymentManager = artifacts.require('PaymentManager');

contract('MultiSpaces', (accounts) => {
  describe('Creating the MultiSpace', () => {
    it('works as expected', async () => {
      const instance = await MultiSpaces.new();
      await expectRevert(instance.spaces(0), 'revert');
      const baseFee = await instance.baseFee();
      expect(baseFee.cmp(new BN(1000000000000000))).equals(0);
      const baseLimit = await instance.baseLimit();
      expect(baseLimit.cmp(new BN(100))).equals(0);

      const paymentManager = await instance.paymentManager();
      expect(paymentManager).not.equals(constants.ZERO_ADDRESS);
      const bucketFactory = await instance.bucketFactory();
      expect(bucketFactory).not.equals(constants.ZERO_ADDRESS);
    });
  });

  describe('Creating a new Space', () => {
    it('works as expected', async () => {
      const instance = await MultiSpaces.new();
      await instance.createSpace(
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        { from: accounts[0], value: new BN(1000000000000000) }
      );
      const space = await instance.spaces(0);
      const ownedSpace = await instance.ownedSpaces(
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436'
      );
      expect(space).not.equals(constants.ZERO_ADDRESS);
      expect(space).equals(ownedSpace);
      const spaceContract = await Space.at(space);
      const spaceOwner = await spaceContract.spaceOwner();
      expect(spaceOwner[1]).equals('Peter');
    });

    it('returns already existing space', async () => {
      const instance = await MultiSpaces.new();
      await instance.createSpace(
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        { from: accounts[0], value: new BN(1000000000000000) }
      );
      const space = await instance.spaces(0);
      expect(space).not.equals(constants.ZERO_ADDRESS);
      await instance.createSpace(
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        { from: accounts[0], value: new BN(1000000000000000) }
      );
      const space2 = await instance.spaces(0);
      expect(space).equals(space2);
      await expectRevert(instance.spaces(1), 'revert');
    });
  });

  describe('Sending ether to MultiSpace', () => {
    it('forwards amount to payment manager', async () => {
      const instance = await MultiSpaces.new();
      const paymentManager = await instance.paymentManager();
      const paymentManagerContract = await PaymentManager.at(paymentManager);
      const balance = await paymentManagerContract.getBalance(accounts[0]);
      assert(balance.eq(new BN(0)), 'Balance incorrect!');
      await instance.send(1000000000000000);
      const finalBalance = await paymentManagerContract.getBalance(accounts[0]);
      assert(finalBalance.eq(new BN(1000000000000000)), 'Balance incorrect!');
    });

    it('forwards amount to payment manager', async () => {
      const instance = await MultiSpaces.new();
      const paymentManager = await instance.paymentManager();
      const paymentManagerContract = await PaymentManager.at(paymentManager);
      const balance = await paymentManagerContract.getBalance(accounts[0]);
      assert(balance.eq(new BN(0)), 'Balance incorrect!');
      await instance.sendTransaction({
        data: '0x34567543456765543',
        value: new BN(1000000000000000),
      });
      const finalBalance = await paymentManagerContract.getBalance(accounts[0]);
      assert(finalBalance.eq(new BN(1000000000000000)), 'Balance incorrect!');
    });
  });
});

export {};
