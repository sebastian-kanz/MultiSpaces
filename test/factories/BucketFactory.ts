const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const InvitationChecker = artifacts.require('InvitationChecker');
const PubKeyChecker = artifacts.require('PubKeyChecker');
const PaymentManager = artifacts.require('PaymentManager');
const BucketFactory = artifacts.require('BucketFactory');
const ParticipantManager = artifacts.require('ParticipantManager');

contract('BucketFactory', (accounts) => {
  describe('Creating new Buckets', () => {
    it('works as expected', async () => {
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      const bucketFactory = await BucketFactory.new();

      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);

      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      const pubKey =
        '0x68cb0cffc92a03959e6fdc99a24f8c94143050099ca104863528c25e3c024f61a7049e09e669397f43d0fd63432b5b358f3d0caaf03b34acbcdc7f2cbe227db9';
      const participantManager = await ParticipantManager.new(
        'name',
        '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
        pubKey,
        paymentManager.address
      );

      await bucketFactory.createBucket(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
    });

    it('fails for insufficient fee', async () => {
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      const bucketFactory = await BucketFactory.new();

      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);

      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      const pubKey =
        '0x68cb0cffc92a03959e6fdc99a24f8c94143050099ca104863528c25e3c024f61a7049e09e669397f43d0fd63432b5b358f3d0caaf03b34acbcdc7f2cbe227db9';
      const participantManager = await ParticipantManager.new(
        'name',
        '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
        pubKey,
        paymentManager.address
      );

      await expectRevert(
        bucketFactory.createBucket(
          paymentManager.address,
          participantManager.address,
          { value: new BN(0) }
        ),
        'revert'
      );
    });
  });
});

export {};
