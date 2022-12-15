import {
  BucketMockElemInstance,
  ElementInstance,
  ParticipantManagerInstance,
  PaymentManagerInstance,
} from '../types/truffle-contracts';
import { getAccountKeys } from './keys.helper';

const {
  BN, // Big Number support
  expectRevert, // Assertions for transactions that should fail
  time,
  constants,
  expectEvent,
} = require('@openzeppelin/test-helpers');

const Element = artifacts.require('Element');
const BucketMockElem = artifacts.require('BucketMockElem');
const ParticipantManager = artifacts.require('ParticipantManager');
const PubKeyChecker = artifacts.require('PubKeyChecker');
const InvitationChecker = artifacts.require('InvitationChecker');
const CreditChecker = artifacts.require('CreditChecker');
const PaymentManager = artifacts.require('PaymentManager');

const {
  ACCOUNT_0_PRIVATE_KEY,
  ACCOUNT_0_ADDRESS,
  ACCOUNT_0_PUBLIC_KEY,
  ACCOUNT_1_ADDRESS,
} = getAccountKeys();

contract('Element', () => {
  let participantManager: ParticipantManagerInstance;
  let paymentManager: PaymentManagerInstance;
  let element: ElementInstance;
  let bucket: BucketMockElemInstance;

  beforeEach(async () => {
    const invitationChecker = await InvitationChecker.new();
    const pubKeyChecker = await PubKeyChecker.new();
    ParticipantManager.link('InvitationChecker', invitationChecker.address);
    ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
    const creditChecker = await CreditChecker.new();
    PaymentManager.link('CreditChecker', creditChecker.address);
    paymentManager = await PaymentManager.new(
      1000000000000000,
      100,
      1000000000000
    );
    participantManager = await ParticipantManager.new(
      'Peter Parker',
      ACCOUNT_0_ADDRESS,
      ACCOUNT_0_PUBLIC_KEY,
      paymentManager.address
    );
    bucket = await BucketMockElem.new();
    const elemImpl = await Element.new();
    bucket.initialize(
      paymentManager.address,
      participantManager.address,
      elemImpl.address
    );
    element = await Element.new();
  });

  const createElement = async () => {
    const instance = await Element.new();
    await bucket.mockRegisterElement(instance.address);
    await instance.initialize(
      {
        creator: ACCOUNT_0_ADDRESS,
        participantManager: participantManager.address,
        parent: constants.ZERO_ADDRESS,
        previous: constants.ZERO_ADDRESS,
        bucket: bucket.address,
        elemImpl: element.address,
      },
      { meta: 'meta', data: 'data', container: 'container' },
      0,
      0
    );
    return instance;
  };

  describe('Initializing an element', () => {
    it('sets all data correctly', async () => {
      const instance = await createElement();
      const meta = await instance.metaHash();
      assert(meta == 'meta', 'Wrong meta');
      const data = await instance.dataHash();
      assert(data == 'data', 'Wrong data');
      const container = await instance.containerHash();
      assert(container == 'container', 'Wrong container');
      const contentType = await instance.contentType();
      assert(contentType.eq(new BN(0)), 'Wrong contentType');
      const creator = await instance.creator();
      assert(creator == ACCOUNT_0_ADDRESS, 'Wrong creator');
      const parent = await instance.parentElement();
      assert(parent == constants.ZERO_ADDRESS, 'Wrong parent');
      const previous = await instance.previousElement();
      assert(previous == constants.ZERO_ADDRESS, 'Wrong previous');
      const next = await instance.nextElement();
      assert(next == instance.address, 'Wrong next');
      const parentBucket = await instance.parentBucket();
      assert(parentBucket == bucket.address, 'Wrong parentBucket');
      const elemImpl = await instance.elemImpl();
      assert(elemImpl == element.address, 'Wrong elemImpl');

      const holdersCount = await instance.holdersCount();
      assert(holdersCount.eq(new BN(1)), 'Wrong holdersCount');

      const redundancy = await instance.redundancy();
      assert(redundancy.eq(new BN(1)), 'Wrong redundancy');
      const minRedundancy = await instance.minRedundancy();
      assert(minRedundancy.eq(new BN(0)), 'Wrong minRedundancy');
    });

    it('notifies the bucket of the creation', async () => {
      const instance = await createElement();
      const history = await bucket.history(0);
      assert(history[0] == instance.address, 'Wrong element');
      assert(history[1].eq(new BN(0)), 'Wrong operation type');
    });
  });

  describe('Updating an element', () => {
    it('only works for bucket participants', async () => {
      const instance = await createElement();

      await expectRevert(
        instance.update(
          { meta: 'meta', data: 'data', container: 'container' },
          constants.ZERO_ADDRESS,
          { from: ACCOUNT_1_ADDRESS }
        ),
        'is missing role'
      );
    });

    it('only works if keys are available', async () => {
      const instance = await createElement();

      await expectRevert(
        instance.update(
          { meta: 'meta2', data: 'data2', container: 'container2' },
          constants.ZERO_ADDRESS
        ),
        'No key available!'
      );
    });

    it('only works if not already updated', async () => {
      const instance = await createElement();
      await bucket.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);

      await instance.update(
        { meta: 'meta2', data: 'data2', container: 'container2' },
        constants.ZERO_ADDRESS
      );

      await expectRevert(
        instance.update(
          { meta: 'meta3', data: 'data3', container: 'container3' },
          constants.ZERO_ADDRESS,
          { from: ACCOUNT_0_ADDRESS }
        ),
        'Newer version already exists'
      );
    });

    it('only works if new hashes do not yet exist', async () => {
      await bucket.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);
      await bucket.createElements(
        ['meta'],
        ['data'],
        ['container'],
        [constants.ZERO_ADDRESS],
        0
      );
      const adr = await bucket.allElements(0);
      const instance = await Element.at(adr);

      await expectRevert(
        instance.update(
          { meta: 'meta', data: 'data', container: 'container' },
          constants.ZERO_ADDRESS
        ),
        'New meta already exists'
      );
      await expectRevert(
        instance.update(
          { meta: 'meta2', data: 'data', container: 'container' },
          constants.ZERO_ADDRESS
        ),
        'New data already exists'
      );
      await expectRevert(
        instance.update(
          { meta: 'meta2', data: 'data2', container: 'container' },
          constants.ZERO_ADDRESS
        ),
        'New container already exists'
      );
    });

    it('notifies the bucket of the creation of the new element', async () => {
      const instance = await createElement();
      await bucket.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);

      await instance.update(
        { meta: 'meta2', data: 'data2', container: 'container2' },
        constants.ZERO_ADDRESS
      );

      const history = await bucket.history(1);
      assert(history[0] != instance.address, 'Wrong element');
      assert(history[1].eq(new BN(0)), 'Wrong operation type');
      const history2 = await bucket.history(2);
      assert(history2[0] != instance.address, 'Wrong element');
      assert(history2[1].eq(new BN(1)), 'Wrong operation type');
    });

    it('set previous <-> next relationship correctly', async () => {
      await bucket.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);
      await bucket.createElements(
        ['meta'],
        ['data'],
        ['container'],
        [constants.ZERO_ADDRESS],
        0
      );
      const adr = await bucket.allElements(0);
      const instance = await Element.at(adr);
      await instance.update(
        { meta: 'meta2', data: 'data2', container: 'container2' },
        constants.ZERO_ADDRESS
      );

      const next = await instance.nextElement();
      const adr2 = await bucket.allElements(1);
      const instance2 = await Element.at(adr2);
      const previous = await instance2.previousElement();
      assert(next == instance2.address, 'Wrong next element');
      assert(previous == instance.address, 'Wrong previous element');
    });
  });

  describe('Removing an element', () => {
    it('only works for bucket participants', async () => {
      const instance = await createElement();
      await expectRevert(
        instance.remove({ from: ACCOUNT_1_ADDRESS }),
        'is missing role'
      );
    });

    it('only works if redundancy is set to NONE', async () => {
      const instance = await createElement();
      await expectRevert(instance.remove(), 'Wrong redundancy level');
      await instance.setRedundancyLevel(0);
      await instance.remove();
    });

    it('notifies the bucket of the deletion', async () => {
      const instance = await createElement();
      await instance.setRedundancyLevel(0);
      await instance.remove();

      const history = await bucket.history(1);
      assert(history[0] == instance.address, 'Wrong element');
      assert(history[1].eq(new BN(3)), 'Wrong operation type');
    });
  });

  describe('Setting the parent', () => {
    it('only works for bucket participants', async () => {
      const instance = await createElement();
      await expectRevert(
        instance.setParent(constants.ZERO_ADDRESS, { from: ACCOUNT_1_ADDRESS }),
        'is missing role'
      );
    });

    it('notifies the bucket of the update', async () => {
      const instance = await createElement();
      await instance.setParent(constants.ZERO_ADDRESS);

      const history = await bucket.history(1);
      assert(history[0] == instance.address, 'Wrong element');
      assert(history[1].eq(new BN(2)), 'Wrong operation type');
    });
  });

  describe('Requesting data', () => {
    it('emits event', async () => {
      const instance = await createElement();
      const receipt = await instance.requestData();
      expectEvent(receipt, 'Request', {
        _elem: instance.address,
        requestor: ACCOUNT_0_ADDRESS,
      });
    });
  });

  describe('Announce holding data', () => {
    it('only works for bucket participants', async () => {
      const instance = await createElement();
      await expectRevert(
        instance.announceHolding({ from: ACCOUNT_1_ADDRESS }),
        'is missing role'
      );
    });

    it('increases holder count', async () => {
      const instance = await createElement();
      await instance.announceHolding();
      const holding = await instance.holders(ACCOUNT_0_ADDRESS);
      assert(holding, 'Wrong holding');
    });
  });

  describe('Announce removing data', () => {
    it('only works for bucket participants', async () => {
      const instance = await createElement();
      await expectRevert(
        instance.announceRemoval({ from: ACCOUNT_1_ADDRESS }),
        'is missing role'
      );
    });

    it('decreases holder count', async () => {
      const instance = await createElement();
      await instance.announceRemoval();
      const holding = await instance.holders(ACCOUNT_0_ADDRESS);
      assert(!holding, 'Wrong holding');
    });
  });

  describe('Setting the redundancy level', () => {
    it('only works for bucket participants', async () => {
      const instance = await createElement();
      await expectRevert(
        instance.setRedundancyLevel(1, { from: ACCOUNT_1_ADDRESS }),
        'is missing role'
      );
    });

    it('updates redundancy correctly', async () => {
      const instance = await createElement();
      await instance.setRedundancyLevel(2);
      const level = await instance.redundancy();
      assert(level.eq(new BN(2)), 'Wrong level');
    });
  });
});

export {};
