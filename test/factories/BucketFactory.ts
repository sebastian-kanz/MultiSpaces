import { getAccountKeys } from '../keys.helper';

const {
  expectRevert, // Assertions for transactions that should fail
  constants,
} = require('@openzeppelin/test-helpers');

const BucketFactory = artifacts.require('BucketFactory');
const Bucket = artifacts.require('Bucket');
const Element = artifacts.require('Element');

const { ACCOUNT_0_ADDRESS, ACCOUNT_0_PUBLIC_KEY, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

contract('BucketFactory', () => {
  describe('Creating new Buckets', () => {
    it('fails if no registered space', async () => {
      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      await expectRevert(
        bucketFactory.createBucket(
          constants.ZERO_ADDRESS,
          'Peter Parker',
          ACCOUNT_0_ADDRESS,
          ACCOUNT_0_PUBLIC_KEY
        ),
        'Only registered spaces allowed!'
      );
    });

    it('works for registered space', async () => {
      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      await bucketFactory.registerSpace(ACCOUNT_0_ADDRESS);
      await bucketFactory.createBucket(
        constants.ZERO_ADDRESS,
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY
      );
    });
  });

  describe('Registering space new Buckets', () => {
    it('works for owner', async () => {
      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      await bucketFactory.registerSpace(ACCOUNT_0_ADDRESS);
    });

    it('fails if not owner', async () => {
      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      await expectRevert(
        bucketFactory.registerSpace(ACCOUNT_1_ADDRESS, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'caller is not the owner'
      );
    });
  });

  describe('Setting implementation', () => {
    it('works as expected for elements', async () => {
      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      await bucketFactory.setElementImplementation(ACCOUNT_0_ADDRESS);
    });

    it('only works for owner', async () => {
      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      await expectRevert(
        bucketFactory.setElementImplementation(ACCOUNT_1_ADDRESS, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'caller is not the owner'
      );
    });

    it('works as expected for buckets', async () => {
      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      await bucketFactory.setBucketImplementation(ACCOUNT_0_ADDRESS);
    });

    it('only works for owner', async () => {
      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      await expectRevert(
        bucketFactory.setBucketImplementation(ACCOUNT_1_ADDRESS, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'caller is not the owner'
      );
    });
  });
});

export {};
