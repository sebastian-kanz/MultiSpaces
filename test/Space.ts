import { getAccountKeys } from './keys.helper';

const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const CreditChecker = artifacts.require('CreditChecker');
const InvitationChecker = artifacts.require('InvitationChecker');
const PubKeyChecker = artifacts.require('PubKeyChecker');
const PaymentManager = artifacts.require('PaymentManager');
const ParticipantManager = artifacts.require('ParticipantManager');
const BucketFactory = artifacts.require('BucketFactory');
const Bucket = artifacts.require('Bucket');
const Element = artifacts.require('Element');
const Space = artifacts.require('Space');

const { ACCOUNT_0_PUBLIC_KEY, ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

contract('Space', () => {
  const createNewSpace = async () => {
    const creditChecker = await CreditChecker.new();
    const invitationChecker = await InvitationChecker.new();
    const pubKeyChecker = await PubKeyChecker.new();
    PaymentManager.link('CreditChecker', creditChecker.address);
    Space.link('PubKeyChecker', pubKeyChecker.address);
    Space.link('InvitationChecker', invitationChecker.address);

    const bucket = await Bucket.new();
    const element = await Element.new();

    BucketFactory.link('InvitationChecker', invitationChecker.address);
    BucketFactory.link('PubKeyChecker', pubKeyChecker.address);
    const bucketFactory = await BucketFactory.new(
      bucket.address,
      element.address
    );
    const paymentManager = await PaymentManager.new(
      1000000000000000,
      100,
      1000000000000
    );

    const instance = await Space.new();
    await instance.initialize(
      ACCOUNT_0_ADDRESS,
      'Peter Parker',
      ACCOUNT_0_PUBLIC_KEY,
      bucketFactory.address,
      paymentManager.address,
      { value: new BN(1000000000000000) }
    );

    await bucketFactory.registerSpace(instance.address);

    return instance;
  };

  describe('Creating a new Space', () => {
    it('works as expected', async () => {
      const instance = await createNewSpace();
      const spaceOwner = await instance.spaceOwner();
      expect(spaceOwner[0]).equals(ACCOUNT_0_ADDRESS);
      expect(spaceOwner[1]).equals('Peter Parker');
      expect(spaceOwner[2]).equals(ACCOUNT_0_PUBLIC_KEY);
    });

    it('fails if provided fee too low', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);

      const bucket = await Bucket.new();
      const element = await Element.new();
      const bucketFactory = await BucketFactory.new(
        bucket.address,
        element.address
      );
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );

      const instance = await Space.new();

      await expectRevert(
        instance.initialize(
          ACCOUNT_0_ADDRESS,
          'Peter Parker',
          ACCOUNT_0_PUBLIC_KEY,
          bucketFactory.address,
          paymentManager.address,
          { value: new BN(100000000000000) }
        ),
        'revert'
      );
    });
  });

  describe('Creating a new Bucket', () => {
    it('works as expected', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });
      const bucket = await instance.getAllBuckets();
      expect(bucket[0].bucket).not.equals(constants.ZERO_ADDRESS);

      expect(await instance.allBucketNames(0)).equals('Bucket1');
    });

    it('adds owner role to participant manager of bucket', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', {
        value: new BN(1000000000000000),
      });
      const bucketContainer = await instance.allBuckets('Bucket1');
      const bucket = await Bucket.at(bucketContainer[0]);
      const participantManagerAddress = await bucket.participantManager();
      const participantManagerInstance = await ParticipantManager.at(
        participantManagerAddress
      );
      const ownerRole = await participantManagerInstance.ALL_ROLES(3);
      expect(
        await participantManagerInstance.hasRole(ownerRole, ACCOUNT_0_ADDRESS),
        'Missing owner role for space!'
      );
    });

    it('emits event', async () => {
      const instance = await createNewSpace();

      const receipt = await instance.addBucket('Bucket1', {
        value: new BN(1000000000000000),
      });

      const bucket = await instance.getAllBuckets();
      expectEvent(receipt, 'Create', {
        _addr: bucket[0].bucket,
        _sender: ACCOUNT_0_ADDRESS,
      });
    });

    it('fails if provided fee too low', async () => {
      const instance = await createNewSpace();

      await expectRevert(
        instance.addBucket('Bucket1', { value: new BN(123) }),
        'revert'
      );
    });

    it('fails if sender is not space owner', async () => {
      const instance = await createNewSpace();

      await expectRevert(
        instance.addBucket('Bucket1', {
          value: new BN(1000000000000000),
          from: ACCOUNT_1_ADDRESS,
        }),
        'revert'
      );
    });

    it('fails if bucket exists', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });

      await expectRevert(
        instance.addBucket('Bucket1', { value: new BN(1000000000000000) }),
        'revert'
      );
    });
  });

  describe('Removing a Bucket', () => {
    it('works as expected', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', {
        value: new BN(1000000000000000),
        from: ACCOUNT_0_ADDRESS,
      });
      await instance.removeBucket('Bucket1', { from: ACCOUNT_0_ADDRESS });

      const buckets = await instance.getAllBuckets();
      expect(buckets.length).equals(0);
    });

    it('emits event', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });
      const receipt = await instance.removeBucket('Bucket1');

      expectEvent(receipt, 'Remove', { _sender: ACCOUNT_0_ADDRESS });
    });

    it('fails if sender is not space owner', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });
      await expectRevert(
        instance.removeBucket('Bucket1', { from: ACCOUNT_1_ADDRESS }),
        'Forbidden'
      );
    });

    it('fails if bucket does not exist', async () => {
      const instance = await createNewSpace();

      await expectRevert(instance.removeBucket('Bucket1'), 'revert');
    });
  });

  describe('Renaming a Bucket', () => {
    it('works as expected', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', {
        value: new BN(1000000000000000),
        from: ACCOUNT_0_ADDRESS,
      });
      await instance.renameBucket('Bucket1', 'Bucket_01', {
        from: ACCOUNT_0_ADDRESS,
      });

      const buckets = await instance.allBucketNames(0);
      expect(buckets).equals('Bucket_01');

      const bucket1 = await instance.allBuckets('Bucket1');
      const bucket01 = await instance.allBuckets('Bucket_01');

      expect(bucket1[1]).equals(false);
      expect(bucket01[1]).equals(true);
    });

    it('emits event', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });
      const receipt = await instance.renameBucket('Bucket1', 'Bucket_01');

      expectEvent(receipt, 'Rename', {
        _name: web3.utils.keccak256('Bucket1'),
        _newName: web3.utils.keccak256('Bucket_01'),
        _sender: ACCOUNT_0_ADDRESS,
      });
    });

    it('fails if sender is not space owner', async () => {
      const instance = await createNewSpace();

      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) }),
        await expectRevert(
          instance.renameBucket('Bucket1', 'Bucket_01', {
            from: ACCOUNT_1_ADDRESS,
          }),
          'Forbidden'
        );
    });

    it('fails if bucket does not exist', async () => {
      const instance = await createNewSpace();

      await expectRevert(
        instance.renameBucket('Bucket1', 'Bucket_01'),
        'revert'
      );
    });
  });
});

export {};
