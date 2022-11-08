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
const BucketFactory = artifacts.require('BucketFactory');
const Space = artifacts.require('Space');

contract('Space', (accounts) => {
  describe('Creating a new Space', () => {
    it('works as expected', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);
      const spaceOwner = await instance.spaceOwner();
      expect(spaceOwner[0]).equals(accounts[0]);
      expect(spaceOwner[1]).equals('Peter');
      expect(spaceOwner[2]).equals(
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436'
      );
    });

    it('fails if provided fee too low', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      await expectRevert(
        Space.new(
          accounts[0],
          'Peter',
          '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
          bucketFactory.address,
          paymentManager.address,
          { value: new BN(100000000) }
        ),
        'revert'
      );
    });
  });

  describe('Creating a new Bucket', () => {
    it('works as expected', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );

      await bucketFactory.registerSpace(instance.address);

      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });
      const bucket = await instance.getAllBuckets();
      expect(bucket[0].bucket).not.equals(constants.ZERO_ADDRESS);

      expect(await instance.allBucketNames(0)).equals('Bucket1');
    });

    it('emits event', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);
      const receipt = await instance.addBucket('Bucket1', {
        value: new BN(1000000000000000),
      });

      const bucket = await instance.getAllBuckets();
      expectEvent(receipt, 'Create', {
        _addr: bucket[0].bucket,
        _sender: accounts[0],
      });
    });

    it('fails if provided fee too low', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await expectRevert(
        instance.addBucket('Bucket1', { value: new BN(123) }),
        'revert'
      );
    });

    it('fails if sender is not space owner', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await expectRevert(
        instance.addBucket('Bucket1', {
          value: new BN(1000000000000000),
          from: accounts[1],
        }),
        'revert'
      );
    });

    it('fails if bucket exists', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);
      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });

      await expectRevert(
        instance.addBucket('Bucket1', { value: new BN(1000000000000000) }),
        'revert'
      );
    });
  });

  describe('Removing a Bucket', () => {
    it.only('works as expected', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await instance.addBucket('Bucket1', {
        value: new BN(1000000000000000),
        from: accounts[0],
      });
      // TODO: This does not work because of the rights-system
      // Access control must be handled directly on bucket level
      // and also on space level. Ensure that space has sufficient rights
      // to alter bucket state. => add space to bucket owner
      await instance.removeBucket('Bucket1', { from: accounts[0] });

      const buckets = await instance.getAllBuckets();
      expect(buckets.length).equals(0);
    });

    it('emits event', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);
      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });
      const receipt = await instance.removeBucket('Bucket1');

      expectEvent(receipt, 'Remove', { _sender: accounts[0] });
    });

    it('fails if sender is not space owner', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);
      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });
      await expectRevert(
        instance.removeBucket('Bucket1', { from: accounts[1] }),
        'Forbidden'
      );
    });

    it('fails if bucket does not exist', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await expectRevert(instance.removeBucket('Bucket1'), 'revert');
    });
  });

  describe('Renaming a Bucket', () => {
    it('works as expected', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await instance.addBucket('Bucket1', {
        value: new BN(1000000000000000),
        from: accounts[0],
      });
      await instance.renameBucket('Bucket1', 'Bucket_01', {
        from: accounts[0],
      });

      const buckets = await instance.allBucketNames(0);
      expect(buckets).equals('Bucket_01');

      const bucket1 = await instance.allBuckets('Bucket1');
      const bucket01 = await instance.allBuckets('Bucket_01');

      expect(bucket1[1]).equals(false);
      expect(bucket01[1]).equals(true);
    });

    it('emits event', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);
      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) });
      const receipt = await instance.renameBucket('Bucket1', 'Bucket_01');

      expectEvent(receipt, 'Rename', {
        _name: web3.utils.keccak256('Bucket1'),
        _newName: web3.utils.keccak256('Bucket_01'),
        _sender: accounts[0],
      });
    });

    it('fails if sender is not space owner', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);
      await instance.addBucket('Bucket1', { value: new BN(1000000000000000) }),
        await expectRevert(
          instance.renameBucket('Bucket1', 'Bucket_01', { from: accounts[1] }),
          'Forbidden'
        );
    });

    it('fails if bucket does not exist', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await expectRevert(
        instance.renameBucket('Bucket1', 'Bucket_01'),
        'revert'
      );
    });
  });

  describe('Adding elements to a Bucket', () => {
    it('fails if bucket is not active', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await expectRevert(
        instance.addElementsToBucket('Bucket1', [], [], [], [], 0),
        'revert'
      );
    });
  });

  describe('Updating elements to a Bucket', () => {
    it('fails if bucket is not active', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await expectRevert(
        instance.updateElementsInBucket(
          'Bucket1',
          [],
          [],
          [],
          [],
          [],
          [],
          [],
          0
        ),
        'revert'
      );
    });
  });

  describe('Removing elements to a Bucket', () => {
    it('fails if bucket is not active', async () => {
      const creditChecker = await CreditChecker.new();
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      Space.link('PubKeyChecker', pubKeyChecker.address);
      Space.link('InvitationChecker', invitationChecker.address);
      const bucketFactory = await BucketFactory.new();
      const paymentManager = await PaymentManager.new(1000000000000000, 100);

      const instance = await Space.new(
        accounts[0],
        'Peter',
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436',
        bucketFactory.address,
        paymentManager.address,
        { value: new BN(1000000000000000) }
      );
      await bucketFactory.registerSpace(instance.address);

      await expectRevert(
        instance.removeElementsFromBucket('Bucket1', [], [], []),
        'revert'
      );
    });
  });
});

export {};
