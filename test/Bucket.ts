import {
  BucketMockInstance,
  BucketInstance,
  ElementInstance,
  ParticipantManagerInstance,
  PaymentManagerInstance,
} from '../types/truffle-contracts';
import { getAccountKeys } from './keys.helper';
const truffleAssert = require('truffle-assertions');
const truffleEvent = require('truffle-events');

const {
  BN,
  expectRevert,
  constants,
  expectEvent,
} = require('@openzeppelin/test-helpers');

const Bucket = artifacts.require('Bucket');
const BucketMock = artifacts.require('BucketMock');
const ParticipantManager = artifacts.require('ParticipantManager');
const PubKeyChecker = artifacts.require('PubKeyChecker');
const InvitationChecker = artifacts.require('InvitationChecker');
const CreditChecker = artifacts.require('CreditChecker');
const PaymentManager = artifacts.require('PaymentManager');
const Element = artifacts.require('Element');

const {
  ACCOUNT_0_PUBLIC_KEY,
  ACCOUNT_0_ADDRESS,
  ACCOUNT_0_PRIVATE_KEY,
  ACCOUNT_1_ADDRESS,
  ACCOUNT_1_PUBLIC_KEY,
} = getAccountKeys();

contract('Bucket', () => {
  let participantManager: ParticipantManagerInstance;
  let paymentManager: PaymentManagerInstance;
  let element: ElementInstance;

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
    element = await Element.new();
  });

  const createNewBucket = async (enableMock = false) => {
    let instance: BucketMockInstance | BucketInstance;
    if (enableMock) {
      instance = await BucketMock.new();
    } else {
      instance = await Bucket.new();
    }
    await instance.initialize(
      paymentManager.address,
      participantManager.address,
      element.address
    );
    await participantManager.grantRole('0x00', instance.address);
    return instance;
  };

  const getParticipationCodePayload = async () => {
    const randomCode = 'This is a random invitation code';
    const hash = web3.utils.soliditySha3(randomCode) ?? '';
    // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
    const signResult = await web3.eth.accounts.sign(
      hash,
      ACCOUNT_0_PRIVATE_KEY
    );
    return {
      inviter: ACCOUNT_0_ADDRESS,
      signature: signResult.signature,
      randomCode,
    };
  };

  describe('Creating a bucket', () => {
    it('Works as expected', async () => {
      const instance = await createNewBucket();
      const expectedBlockNumber = await (
        await web3.eth.getTransaction(instance.transactionHash)
      ).blockNumber;
      const genesis = await instance.GENESIS();
      const minRedundancy = await instance.minElementRedundancy();
      assert(minRedundancy.eq(new BN(1)), 'False initial minimal redundancy!');
      assert(
        genesis.sub(new BN(1)).eq(new BN(expectedBlockNumber)),
        'False genesis block number!'
      );
    });
  });

  describe('Closing a bucket', () => {
    it('Works as expected', async () => {
      const instance = await createNewBucket();
      await instance.closeBucket();
    });

    it('Only works for owner', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.closeBucket({ from: ACCOUNT_1_ADDRESS }),
        'is missing role'
      );
    });
  });

  describe('Keys', () => {
    it('can only be added from a participant', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.addKeys(['key123'], [ACCOUNT_1_ADDRESS], {
          from: ACCOUNT_1_ADDRESS,
        }),
        'is missing role'
      );
      await instance.addKeys(['key123'], [ACCOUNT_1_ADDRESS], {
        from: ACCOUNT_0_ADDRESS,
      });
    });

    it('are checked on adding', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.addKeys([], [ACCOUNT_1_ADDRESS], {
          from: ACCOUNT_0_ADDRESS,
        }),
        'Invalid input'
      );
      await expectRevert(
        instance.addKeys(['key123'], [], {
          from: ACCOUNT_0_ADDRESS,
        }),
        'Invalid input'
      );
    });

    it('can be read per participant', async () => {
      const instance = await createNewBucket();
      const result = await instance.addKeys(['hash123'], [ACCOUNT_0_ADDRESS]);
      const blockNumber = (new BN(result.receipt.blockNumber) as BN).toNumber();
      const epoch = await instance.EPOCH();
      const key = await instance.getKey(ACCOUNT_0_ADDRESS, blockNumber);
      // minus 3 because of 0 index (0-99), the block in blockNumber is the one before the transaction creating the contract is mined and one block is already passed by
      const key2 = await instance.getKey(
        ACCOUNT_0_ADDRESS,
        blockNumber + epoch.toNumber() - 3
      );
      assert(key === 'hash123', 'Key invalid.');
      assert(key === key2, 'Key2 invalid.');
    });

    it('can not be set before contract creation', async () => {
      const rootNumber = await web3.eth.getBlockNumber();
      const instance = await createNewBucket();
      await expectRevert(
        instance.setKeyForParticipant('keyHash', ACCOUNT_0_ADDRESS, rootNumber),
        'Block number before genesis.'
      );
    });

    it('can be set per participant after contract creation', async () => {
      const instance = await createNewBucket();
      const blockNumber = await web3.eth.getBlockNumber();
      await instance.setKeyForParticipant(
        'keyHash',
        ACCOUNT_0_ADDRESS,
        blockNumber
      );
    });

    it('can be set for participant only from a participant', async () => {
      const instance = await createNewBucket();
      const blockNumber = await web3.eth.getBlockNumber();
      await expectRevert(
        instance.setKeyForParticipant(
          'keyHash',
          ACCOUNT_0_ADDRESS,
          blockNumber,
          { from: ACCOUNT_1_ADDRESS }
        ),
        'is missing role'
      );
    });

    it('can not be set if already available', async () => {
      const instance = await createNewBucket();
      const blockNumber = await web3.eth.getBlockNumber();
      await instance.setKeyForParticipant(
        'keyHash',
        ACCOUNT_0_ADDRESS,
        blockNumber
      );
      await expectRevert(
        instance.setKeyForParticipant(
          'keyHash',
          ACCOUNT_0_ADDRESS,
          blockNumber
        ),
        'Key already available'
      );
    });

    it('can not be set for future blocks', async () => {
      const instance = await createNewBucket();
      const blockNumber = 10000000;
      await expectRevert(
        instance.setKeyForParticipant(
          'keyHash',
          ACCOUNT_0_ADDRESS,
          blockNumber
        ),
        'Block time in future.'
      );
    });
  });

  describe('Creating new elements', () => {
    it('only works for participants', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.createElements([], [], [], [], 0, { from: ACCOUNT_1_ADDRESS }),
        'is missing role'
      );
    });

    it('only works if key is available', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.createElements([], [], [], [], 0),
        'No key available!'
      );
      await instance.addKeys(['hash123'], [ACCOUNT_0_ADDRESS]);
      await instance.createElements(
        ['meta'],
        ['data'],
        ['container'],
        [constants.ZERO_ADDRESS],
        0
      );
    });

    it('decreases limit of bucket and not the participant', async () => {
      const instance = await createNewBucket();
      const balance = await paymentManager.getLimit.call(instance.address, 0);
      const balanceSender = await paymentManager.getLimit.call(
        ACCOUNT_0_ADDRESS,
        0
      );
      assert(balance.cmp(new BN(0)) !== 0, 'Limit not yet initialized.');
      await instance.addKeys(['hash123'], [ACCOUNT_0_ADDRESS]);
      await instance.createElements(
        ['meta'],
        ['data'],
        ['container'],
        [constants.ZERO_ADDRESS],
        0
      );
      const newBalance = await paymentManager.getLimit.call(
        instance.address,
        0
      );
      const newBalanceSender = await paymentManager.getLimit.call(
        ACCOUNT_0_ADDRESS,
        0
      );
      const defaultBalance = await paymentManager.DEFAULT_LIMITS(0);
      assert(defaultBalance.cmp(newBalance) === 1, 'Limit was not decreased.');
      assert(
        balanceSender.eq(newBalanceSender),
        'Limit of sender was changed.'
      );
    });

    it('checks workload', async () => {
      const instance = await createNewBucket();
      await instance.addKeys(['hash123'], [ACCOUNT_0_ADDRESS]);
      await expectRevert(
        instance.createElements(
          [
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
            'meta',
          ],
          ['data'],
          ['container'],
          [constants.ZERO_ADDRESS],
          0
        ),
        'Workload to high!'
      );
    });

    it('checks element counts', async () => {
      const instance = await createNewBucket();
      await instance.addKeys(['hash123'], [ACCOUNT_0_ADDRESS]);

      await expectRevert(
        instance.createElements(
          ['meta1', 'meta2'],
          ['data1'],
          ['container1'],
          [constants.ZERO_ADDRESS],
          0
        ),
        'Invalid data hashes length'
      );

      await expectRevert(
        instance.createElements(
          ['meta1', 'meta2'],
          ['data1', 'data2'],
          ['container1'],
          [constants.ZERO_ADDRESS, constants.ZERO_ADDRESS],
          0
        ),
        'Invalid container hashes length'
      );

      await expectRevert(
        instance.createElements(
          ['meta1', 'meta2'],
          ['data1', 'data2'],
          ['container1', 'container2'],
          [constants.ZERO_ADDRESS],
          0
        ),
        'Invalid parents length'
      );
    });

    it('does not override existing elements', async () => {
      const instance = await createNewBucket();
      await instance.addKeys(['hash123'], [ACCOUNT_0_ADDRESS]);
      await instance.createElements(
        ['metaParent'],
        ['dataParent'],
        ['containerParent'],
        [constants.ZERO_ADDRESS],
        0
      );
      const parent = await instance.allElements(0);
      await instance.createElements(
        ['meta'],
        ['data'],
        ['container'],
        [parent],
        0
      );

      await expectRevert(
        instance.createElements(
          ['meta'],
          ['data'],
          ['container'],
          [constants.ZERO_ADDRESS],
          0
        ),
        'Meta already exists'
      );

      await expectRevert(
        instance.createElements(
          ['meta2'],
          ['data'],
          ['container'],
          [constants.ZERO_ADDRESS],
          0
        ),
        'Data already exists'
      );

      await expectRevert(
        instance.createElements(
          ['meta2'],
          ['data2'],
          ['container'],
          [constants.ZERO_ADDRESS],
          0
        ),
        'Container already exists'
      );
    });

    it('creates a new element for every input data set', async () => {
      const instance = await createNewBucket();
      await instance.addKeys(['hash123'], [ACCOUNT_0_ADDRESS]);
      await instance.createElements(
        ['meta1', 'meta2'],
        ['data1', 'data2'],
        ['container1', 'container2'],
        [constants.ZERO_ADDRESS, constants.ZERO_ADDRESS],
        0,
        { from: ACCOUNT_0_ADDRESS }
      );
      const element0 = await instance.allElements(0);
      const element1 = await instance.allElements(1);
      await expectRevert(instance.allElements(2), 'revert');
    });

    it('adds newly created elements to internal state', async () => {
      const instance = await createNewBucket();
      await instance.addKeys(['hash123'], [ACCOUNT_0_ADDRESS]);
      await instance.createElements(
        ['meta1', 'meta2'],
        ['data1', 'data2'],
        ['container1', 'container2'],
        [constants.ZERO_ADDRESS, constants.ZERO_ADDRESS],
        0,
        { from: ACCOUNT_0_ADDRESS }
      );
      const elem1 = await instance.allElements(0);
      const elem2 = await instance.allElements(1);

      const hashExistsMeta1 = await instance.hashExists('meta1');
      assert(hashExistsMeta1, 'Missing hash');
      const hashExistsMeta2 = await instance.hashExists('meta2');
      assert(hashExistsMeta2, 'Missing hash');
      const hashExistsData1 = await instance.hashExists('data1');
      assert(hashExistsData1, 'Missing hash');
      const hashExistsData2 = await instance.hashExists('data2');
      assert(hashExistsData2, 'Missing hash');
      const hashExistsContainer1 = await instance.hashExists('container1');
      assert(hashExistsContainer1, 'Missing hash');
      const hashExistsContainer2 = await instance.hashExists('container2');
      assert(hashExistsContainer2, 'Missing hash');

      const history1 = await instance.history(0);
      assert(history1[0] == elem1, 'Wrong address');
      assert(history1[1].eq(new BN(0)), 'Wrong operation');
      const history2 = await instance.history(0);
      assert(history2[1].eq(new BN(0)), 'Wrong operation');
    });
  });

  describe('Redeeming participation code', () => {
    it('works as expected', async () => {
      const instance = await createNewBucket();
      const payload = await getParticipationCodePayload();
      await instance.redeemParticipationCode(
        'Paul',
        payload.inviter,
        payload.signature,
        payload.randomCode,
        ACCOUNT_1_PUBLIC_KEY,
        { value: new BN(1000000000000000), from: ACCOUNT_1_ADDRESS }
      );
      const participantManagerAddress = await instance.participantManager();
      const participantManager = await ParticipantManager.at(
        participantManagerAddress
      );
      const count = await participantManager.participantCount();
      assert(count.eq(new BN(2)), 'Wrong participant count!');
    });
  });

  describe('Removing participation', () => {
    it('only works for participants', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.removeParticipation({ from: ACCOUNT_1_ADDRESS }),
        'is missing role'
      );
    });

    it('only works if participant is left', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.removeParticipation({ from: ACCOUNT_0_ADDRESS }),
        'Last participant'
      );
    });

    it('removes the sender as participant', async () => {
      const instance = await createNewBucket();
      const payload = await getParticipationCodePayload();
      await instance.redeemParticipationCode(
        'Paul',
        payload.inviter,
        payload.signature,
        payload.randomCode,
        ACCOUNT_1_PUBLIC_KEY,
        { value: new BN(1000000000000000), from: ACCOUNT_1_ADDRESS }
      );
      await instance.removeParticipation({ from: ACCOUNT_1_ADDRESS });
    });
  });

  describe('Notifiying about a creation', () => {
    it('only works for registered elements', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.notifyCreation(ACCOUNT_0_ADDRESS),
        'Only callable from registered element!'
      );
    });

    it('adds element to history', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      await instance.notifyCreation(ACCOUNT_0_ADDRESS);
      const history = await instance.history(0);
      assert(history[0] == ACCOUNT_0_ADDRESS, 'Wrong element address');
      assert(history[1].eq(new BN(0)), 'Wrong operation type');
    });

    it('emits event', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      const receipt = await instance.notifyCreation(ACCOUNT_0_ADDRESS);

      expectEvent(receipt, 'Create', {
        _elem: ACCOUNT_0_ADDRESS,
        // _blockNumber: receipt.logs,
        _sender: ACCOUNT_0_ADDRESS,
      });
    });
  });

  describe('Pre-registering and element', () => {
    it('only works for registered elements', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.preRegisterElement(ACCOUNT_0_ADDRESS),
        'Only callable from registered element!'
      );
    });

    it('pre-registers successfully', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      await instance.preRegisterElement(ACCOUNT_0_ADDRESS);
    });
  });

  describe('Notifiying about an update', () => {
    it('only works for registered elements', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS),
        'Only callable from registered element!'
      );
    });

    it('adds element to history', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      await instance.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);
      await instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS);
      const history = await instance.history(0);
      assert(history[0] == ACCOUNT_0_ADDRESS, 'Wrong element address');
      assert(history[1].eq(new BN(1)), 'Wrong operation type');
    });

    it('emits event', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      await instance.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);
      const receipt = await instance.notifyUpdate(
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_ADDRESS
      );
      expectEvent(receipt, 'Update', {
        _prevElem: ACCOUNT_0_ADDRESS,
        // _blockNumber: receipt.logs,
        _newElemt: ACCOUNT_0_ADDRESS,
        _sender: ACCOUNT_0_ADDRESS,
      });
    });

    it('checks key availability', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      await expectRevert(
        instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS),
        'No key available!'
      );
    });

    it('decreases limit of bucket', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      const limitBefore = await paymentManager.DEFAULT_LIMITS(0);
      await instance.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);
      await instance.notifyUpdate(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS);
      const limitAfter = await paymentManager.getLimit.call(
        instance.address,
        0
      );
      assert(limitAfter.lt(limitBefore), 'Limit was not decreased.');
    });
  });

  describe('Notifiying about a parent update', () => {
    it('only works for registered elements', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.notifyUpdateParent(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS),
        'Only callable from registered element!'
      );
    });

    it('adds element to history', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      const elem = await Element.new();
      await instance.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);
      await instance.notifyUpdateParent(elem.address, ACCOUNT_0_ADDRESS);
      const history = await instance.history(0);
      assert(history[0] == elem.address, 'Wrong element address');
      assert(history[1].eq(new BN(2)), 'Wrong operation type');
    });

    it('emits event', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      const elem = await Element.new();
      await instance.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);
      const receipt = await instance.notifyUpdateParent(
        elem.address,
        ACCOUNT_0_ADDRESS
      );
      expectEvent(receipt, 'UpdateParent', {
        _elem: elem.address,
        // _blockNumber: receipt.logs,
        _parent: constants.ZERO_ADDRESS,
        _sender: ACCOUNT_0_ADDRESS,
      });
    });
  });

  describe('Notifiying about a deletion', () => {
    it('only works for registered elements', async () => {
      const instance = await createNewBucket();
      await expectRevert(
        instance.notifyDelete(ACCOUNT_0_ADDRESS, ACCOUNT_0_ADDRESS),
        'Only callable from registered element!'
      );
    });

    it('emits event', async () => {
      const instance = await createNewBucket(true);
      await (instance as BucketMockInstance).mockRegisterElement(
        ACCOUNT_0_ADDRESS
      );
      const elem = await Element.new();
      await instance.addKeys(['key123'], [ACCOUNT_0_ADDRESS]);
      const receipt = await instance.notifyDelete(
        elem.address,
        ACCOUNT_0_ADDRESS
      );
      expectEvent(receipt, 'Delete', {
        _elem: elem.address,
        _sender: ACCOUNT_0_ADDRESS,
      });
    });
  });

  describe('Setting the element implementation', () => {
    it('only works for owner', async () => {
      const instance = await createNewBucket();
      const elem = await Element.new();
      await expectRevert(
        instance.setElementImplementation(elem.address, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'is missing role'
      );
    });

    it('works as expected', async () => {
      const instance = await createNewBucket();
      const elem = await Element.new();
      await instance.setElementImplementation(elem.address);
      const address = await instance.elementImpl();
      assert(address == elem.address, 'Wrong element implementation set.');
    });
  });

  describe('Updating the minimal redundancy', () => {
    it('only works for participants', async () => {
      const instance = await createNewBucket();
      const elem = await Element.new();
      await expectRevert(
        instance.setMinElementRedundancy(0, {
          from: ACCOUNT_1_ADDRESS,
        }),
        'is missing role'
      );
    });

    it('works as expected', async () => {
      const instance = await createNewBucket();
      const elem = await Element.new();
      await instance.setMinElementRedundancy(2);
      const redundancy = await instance.minElementRedundancy();
      assert(redundancy.eq(new BN(2)), 'Wrong redundancy level set.');
    });
  });
});

export {};
