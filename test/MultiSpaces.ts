import { getAccountKeys } from './keys.helper';

const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const MultiSpaces = artifacts.require('MultiSpaces');
const PaymentManager = artifacts.require('PaymentManager');
const BucketFactory = artifacts.require('BucketFactory');
const Bucket = artifacts.require('Bucket');
const Element = artifacts.require('Element');
const Space = artifacts.require('Space');

const { ACCOUNT_0_PUBLIC_KEY, ACCOUNT_0_ADDRESS } = getAccountKeys();

contract('MultiSpaces', () => {
  const createNewMultiSpace = async () => {
    const bucket = await Bucket.new();
    const element = await Element.new();
    const bucketFactory = await BucketFactory.new(
      bucket.address,
      element.address
    );

    const space = await Space.new();
    const instance = await MultiSpaces.new(
      bucketFactory.address,
      space.address
    );

    await bucketFactory.transferOwnership(instance.address);

    return instance;
  };

  describe('Creating the MultiSpace', () => {
    it('works as expected', async () => {
      const instance = await createNewMultiSpace();
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

    it('sets creator as owner of payment manager', async () => {
      const instance = await createNewMultiSpace();
      const pManagerAdr = await instance.paymentManager();
      const paymentManager = await PaymentManager.at(pManagerAdr);
      const owner = await paymentManager.owner();
      expect(owner).equals(ACCOUNT_0_ADDRESS);
    });
  });

  describe('Creating a new Space', () => {
    it('works as expected', async () => {
      const instance = await createNewMultiSpace();
      await instance.createSpace('Peter', ACCOUNT_0_PUBLIC_KEY, {
        from: ACCOUNT_0_ADDRESS,
        value: new BN(1000000000000000),
      });
      const space = await instance.spaces(0);
      const ownedSpace = await instance.ownedSpaces(ACCOUNT_0_PUBLIC_KEY);
      expect(space).not.equals(constants.ZERO_ADDRESS);
      expect(space).equals(ownedSpace);
      const spaceContract = await Space.at(space);
      const spaceOwner = await spaceContract.spaceOwner();
      expect(spaceOwner[1]).equals('Peter');
    });

    it('returns already existing space', async () => {
      const instance = await createNewMultiSpace();
      await instance.createSpace('Peter', ACCOUNT_0_PUBLIC_KEY, {
        from: ACCOUNT_0_ADDRESS,
        value: new BN(1000000000000000),
      });
      const space = await instance.spaces(0);
      expect(space).not.equals(constants.ZERO_ADDRESS);
      await instance.createSpace('Peter', ACCOUNT_0_PUBLIC_KEY, {
        from: ACCOUNT_0_ADDRESS,
        value: new BN(1000000000000000),
      });
      const space2 = await instance.spaces(0);
      expect(space).equals(space2);
      await expectRevert(instance.spaces(1), 'revert');
    });
  });

  describe('Sending ether to MultiSpace', () => {
    it('forwards amount to payment manager', async () => {
      const instance = await createNewMultiSpace();
      const paymentManager = await instance.paymentManager();
      const paymentManagerContract = await PaymentManager.at(paymentManager);
      const balance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      assert(balance.eq(new BN(0)), 'Balance incorrect!');
      await instance.send(1000000000000000);
      const finalBalance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      assert(finalBalance.eq(new BN(1000000000000000)), 'Balance incorrect!');
    });

    it('forwards amount to payment manager', async () => {
      const instance = await createNewMultiSpace();
      const paymentManager = await instance.paymentManager();
      const paymentManagerContract = await PaymentManager.at(paymentManager);
      const balance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      assert(balance.eq(new BN(0)), 'Balance incorrect!');
      await instance.sendTransaction({
        data: '0x34567543456765543',
        value: new BN(1000000000000000),
      });
      const finalBalance = await paymentManagerContract.getBalance(
        ACCOUNT_0_ADDRESS
      );
      assert(finalBalance.eq(new BN(1000000000000000)), 'Balance incorrect!');
    });
  });
});

export {};
