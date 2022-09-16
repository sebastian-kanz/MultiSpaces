import {
  ParticipantManagerInstance,
  PaymentManagerInstance,
} from '../types/truffle-contracts';

const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
  time,
} = require('@openzeppelin/test-helpers');

const Bucket = artifacts.require('Bucket');
const ParticipantManager = artifacts.require('ParticipantManager');
const PubKeyChecker = artifacts.require('PubKeyChecker');
const InvitationChecker = artifacts.require('InvitationChecker');
const PaymentManager = artifacts.require('PaymentManager');

contract('Bucket', (accounts) => {
  let participantManager: ParticipantManagerInstance;
  let paymentManager: PaymentManagerInstance;

  beforeEach(async () => {
    const invitationChecker = await InvitationChecker.new();
    const pubKeyChecker = await PubKeyChecker.new();
    ParticipantManager.link('InvitationChecker', invitationChecker.address);
    ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
    // public key of accounts[0]
    const pubKey =
      '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436';
    paymentManager = await PaymentManager.new(1000000000000000, 100);
    participantManager = await ParticipantManager.new(
      'Peter Parker',
      accounts[0],
      pubKey,
      paymentManager.address
    );
  });

  describe('Creating a bucket', () => {
    it('fails for insufficient fee', async () => {
      await expectRevert(
        Bucket.new(paymentManager.address, participantManager.address, {
          value: new BN(100),
        }),
        'Insufficient fee'
      );
    });

    it('works for sufficient fee', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
    });

    it('works for sufficient fee', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
    });
  });

  describe('Closing a bucket', () => {
    it('Works as expected', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.closeBucket();
    });

    it('Only works for owner', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await expectRevert(
        instance.closeBucket({ from: accounts[1] }),
        'is missing role'
      );
    });
  });

  describe('Keys', () => {
    it('can be read per participant', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      const result = await instance.addKeys(['hash123'], [accounts[0]]);
      const blockNumber = (new BN(result.receipt.blockNumber) as BN).toNumber();
      const epoch = await instance.EPOCH();
      const key = await instance.getKey(accounts[0], blockNumber);
      // minus 2 because of 0 index (0-99) and because the block in blockNumber is the one mined after the epoch is created
      const key2 = await instance.getKey(
        accounts[0],
        blockNumber + epoch.toNumber() - 2
      );

      assert(key === 'hash123', 'Key invalid.');
      assert(key === key2, 'Key2 invalid.');
    });

    it('can not be set before contract creation', async () => {
      const rootNumber = await web3.eth.getBlockNumber();
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await expectRevert(
        instance.setKeyForParticipant('keyHash', accounts[0], rootNumber),
        'Block number before genesis.'
      );
    });

    it('can be set per participant after contract creation', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      const blockNumber = await web3.eth.getBlockNumber();
      await instance.setKeyForParticipant('keyHash', accounts[0], blockNumber);
    });

    it('can not be set if already available', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      const blockNumber = await web3.eth.getBlockNumber();
      await instance.setKeyForParticipant('keyHash', accounts[0], blockNumber);
      await expectRevert(
        instance.setKeyForParticipant('keyHash', accounts[0], blockNumber),
        'Key already available'
      );
    });

    it('can not be set for future blocks', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      const blockNumber = 10000000;
      await expectRevert(
        instance.setKeyForParticipant('keyHash', accounts[0], blockNumber),
        'Block time in future.'
      );
    });
  });

  describe('Creating new elements', () => {
    it('only works for participants', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await expectRevert(
        instance.createElements([], [], [], [], 0, { from: accounts[1] }),
        'is missing role'
      );
    });

    it('only works if key is available', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await expectRevert(
        instance.createElements([], [], [], [], 0),
        'No key available!'
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
    });

    it('decreases limit of participant', async () => {
      const balance = await paymentManager.getLimit(accounts[0], 0);
      assert(balance.cmp(new BN(0)) === 0, 'Limit already initialized.');
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      const newBalance = await paymentManager.getLimit(accounts[0], 0);
      assert(balance.cmp(newBalance) === -1, 'Limit was not initialized.');
      const defaultBalance = await paymentManager.DEFAULT_LIMITS(0);
      assert(defaultBalance.cmp(newBalance) === 1, 'Limit was not decreased.');
    });

    it('checks workload', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
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
          [''],
          0
        ),
        'Workload to high!'
      );
    });

    it('checks element counts', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);

      await expectRevert(
        instance.createElements(
          ['meta1', 'meta2'],
          ['data1'],
          ['container1'],
          [''],
          0
        ),
        'Invalid data hashes length'
      );

      await expectRevert(
        instance.createElements(
          ['meta1', 'meta2'],
          ['data1', 'data2'],
          ['container1'],
          [''],
          0
        ),
        'Invalid container hashes length'
      );

      await expectRevert(
        instance.createElements(
          ['meta1', 'meta2'],
          ['data1', 'data2'],
          ['container1', 'container2'],
          [''],
          0
        ),
        'Invalid parent hashes length'
      );
    });

    it('does not override existing elements', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(
        ['metaParent'],
        ['dataParent'],
        ['containerParent'],
        [''],
        0
      );
      await instance.createElements(
        ['meta'],
        ['data'],
        ['container'],
        ['containerParent'],
        0
      );

      await expectRevert(
        instance.createElements(['meta'], ['data'], ['container'], [''], 0),
        'Element (meta) already exists!'
      );

      await expectRevert(
        instance.createElements(['meta2'], ['data'], ['container'], [''], 0),
        'Element (data) already exists!'
      );

      await expectRevert(
        instance.createElements(['meta2'], ['data2'], ['container'], [''], 0),
        'Element (container) already exists!'
      );

      await expectRevert(
        instance.createElements(
          ['meta2'],
          ['data2'],
          ['container2'],
          ['parent2'],
          0
        ),
        'Element (parent) not found!'
      );
    });

    it('adds all elements correctly', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);

      const metaExists = await instance.elementExists('meta');
      assert(metaExists, 'Meta does not exist!');
      const dataExists = await instance.elementExists('data');
      assert(dataExists, 'Data does not exist!');
      const containerExists = await instance.elementExists('container');
      assert(containerExists, 'Container does not exist!');

      const meta = await instance.allElements(0);
      assert(meta[0] === 'meta', 'Meta element incorrect (hash)!');
      assert(meta[1].eq(new BN(0)), 'Meta element incorrect (content)!');
      assert(meta[2].eq(new BN(0)), 'Meta element incorrect (element)!');
      assert(meta[3].eq(new BN(0)), 'Meta element incorrect (index)!');

      const data = await instance.allElements(1);
      assert(data[0] === 'data', 'Data element incorrect (hash)!');
      assert(data[1].eq(new BN(0)), 'Data element incorrect (content)!');
      assert(data[2].eq(new BN(1)), 'Data element incorrect (element)!');
      assert(data[3].eq(new BN(0)), 'Data element incorrect (index)!');

      const container = await instance.allElements(2);
      assert(
        container[0] === 'container',
        'Container element incorrect (hash)!'
      );
      assert(
        container[1].eq(new BN(0)),
        'Container element incorrect (content)!'
      );
      assert(
        container[2].eq(new BN(2)),
        'Container element incorrect (element)!'
      );
      assert(
        container[3].eq(new BN(0)),
        'Container element incorrect (index)!'
      );
    });

    it('adds data to history correctly', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);

      const history = await instance.getHistory();
      assert(history[0].prevMetaHash === '', 'prevMetaHash incorrect');
      assert(history[0].prevDataHash === '', 'prevDataHash incorrect');
      assert(
        history[0].prevContainerHash === '',
        'prevContainerHash incorrect'
      );
      assert(history[0].newMetaHash === 'meta', 'newMetaHash incorrect');
      assert(history[0].newDataHash === 'data', 'newDataHash incorrect');
      assert(
        history[0].newContainerHash === 'container',
        'newContainerHash incorrect'
      );
      assert(
        (history[0].operationType as unknown as string) === '0',
        'operationType incorrect'
      );
      assert(
        history[0].parentContainerHash === '',
        'parentContainerHash incorrect'
      );
    });

    it('adds parent to children relationships', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);

      const metaParent = await instance.parent('meta');
      assert(metaParent === 'container', 'metaParent incorrect');

      const dataParent = await instance.parent('data');
      assert(dataParent === 'container', 'dataParent incorrect');

      const containerChild0 = await instance.children('container', 0);
      assert(containerChild0 === 'meta', 'containerChild0 incorrect');
      const containerChild1 = await instance.children('container', 1);
      assert(containerChild1 === 'data', 'containerChild1 incorrect');
    });

    it('emits Create event', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      const response = await instance.createElements(
        ['meta'],
        ['data'],
        ['container'],
        [''],
        0
      );

      assert(response.logs.some((log) => log.event === 'Create'));
    });
  });

  describe('Updating elements', () => {
    it('only works for participants', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer'],
          [''],
          0,
          { from: accounts[1] }
        ),
        'is missing role'
      );
    });

    it('only works if key is available', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      const receipt = await instance.createElements(
        ['meta'],
        ['data'],
        ['container'],
        [''],
        0
      );
      const blockNumberNew = (
        new BN(receipt.receipt.blockNumber) as BN
      ).toNumber();
      await time.advanceBlockTo(blockNumberNew + 100);

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer'],
          [''],
          0
        ),
        'No key available'
      );
    });

    it('decreases limit of participant', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);

      const balance = await paymentManager.getLimit(accounts[0], 0);
      await instance.updateElements(
        ['meta'],
        ['newMeta'],
        ['data'],
        ['newData'],
        ['container'],
        ['newContainer'],
        [''],
        0
      );
      const newBalance = await paymentManager.getLimit(accounts[0], 0);

      assert(balance.cmp(newBalance) === 1, 'Limit was not decreased.');
    });

    it('checks workload', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await expectRevert(
        instance.updateElements(
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
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer'],
          [''],
          0
        ),
        'Workload to high!'
      );
    });

    it('checks element counts', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta1', 'newMeta2'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer'],
          [''],
          0
        ),
        'Invalid new meta hashes length!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data1', 'data2'],
          ['newData'],
          ['container'],
          ['newContainer'],
          [''],
          0
        ),
        'Invalid prev data hashes length!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData1', 'newData2'],
          ['container'],
          ['newContainer'],
          [''],
          0
        ),
        'Invalid new data hashes length!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container1', 'container2'],
          ['newContainer'],
          [''],
          0
        ),
        'Invalid prev container hashes length!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer1', 'newContainer2'],
          [''],
          0
        ),
        'Invalid new container hashes length!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer1'],
          ['parent1', 'parent2'],
          0
        ),
        'Invalid parent hashes length!'
      );
    });

    it('checks existance of elements to update', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);

      await expectRevert(
        instance.updateElements(
          ['previousMeta'],
          ['newMeta'],
          ['previousData'],
          ['newData'],
          ['previousContainer'],
          ['newContainer'],
          [''],
          0
        ),
        'Element (meta) not found!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['previousData'],
          ['newData'],
          ['previousContainer'],
          ['newContainer'],
          [''],
          0
        ),
        'Element (data) not found!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['previousContainer'],
          ['newContainer'],
          [''],
          0
        ),
        'Element (container) not found!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer'],
          ['parent'],
          0
        ),
        'Element (parent) not found!'
      );
    });

    it('checks versions of elements to update', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.createElements(
        ['meta2'],
        ['data2'],
        ['container2'],
        [''],
        0
      );
      await instance.updateElements(
        ['meta'],
        ['newMeta'],
        ['data'],
        ['newData'],
        ['container'],
        ['newContainer'],
        [''],
        0
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer'],
          [''],
          0
        ),
        'Old version already has an update!'
      );

      await expectRevert(
        instance.updateElements(
          ['newMeta'],
          ['newMeta2'],
          ['data'],
          ['newData'],
          ['container'],
          ['newContainer'],
          [''],
          0
        ),
        'Old version already has an update!'
      );

      await expectRevert(
        instance.updateElements(
          ['newMeta'],
          ['newMeta2'],
          ['newData'],
          ['newData2'],
          ['container'],
          ['newContainer'],
          [''],
          0
        ),
        'Old version already has an update!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta2'],
          ['newMeta'],
          ['data2'],
          ['newData'],
          ['container2'],
          ['newContainer'],
          [''],
          0
        ),
        'New version already has an older version!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta2'],
          ['newMeta2'],
          ['data2'],
          ['newData'],
          ['container2'],
          ['newContainer'],
          [''],
          0
        ),
        'New version already has an older version!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta2'],
          ['newMeta2'],
          ['data2'],
          ['newData2'],
          ['container2'],
          ['newContainer'],
          [''],
          0
        ),
        'New version already has an older version!'
      );
    });

    it('checks parent relationship of elements to update', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.createElements(
        ['meta1'],
        ['data1'],
        ['container1'],
        [''],
        0
      );

      await expectRevert(
        instance.updateElements(
          ['meta'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container1'],
          ['newContainer'],
          [''],
          0
        ),
        'Element (meta) is not child of container1!'
      );

      await expectRevert(
        instance.updateElements(
          ['meta1'],
          ['newMeta'],
          ['data'],
          ['newData'],
          ['container1'],
          ['newContainer'],
          [''],
          0
        ),
        'Element (data) is not child of container1!'
      );
    });

    it('only creates new elements for updates if they do not exist', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.updateElements(
        ['meta'],
        ['meta'],
        ['data'],
        ['data'],
        ['container'],
        ['container'],
        [''],
        0
      );
      let allElements = await instance.getAll();
      assert(allElements.length === 3, 'Wrong element count (3)!');
      assert(
        allElements.filter((elem) => elem.hash === 'meta').length === 1,
        'Too many meta elements!'
      );
      assert(
        allElements.filter((elem) => elem.hash === 'data').length === 1,
        'Too many data elements!'
      );
      assert(
        allElements.filter((elem) => elem.hash === 'container').length === 1,
        'Too many container elements!'
      );

      await instance.updateElements(
        ['meta'],
        ['newMeta2'],
        ['data'],
        ['newData2'],
        ['container'],
        ['newContainer2'],
        [''],
        0
      );
      allElements = await instance.getAll();
      assert(allElements.length === 6, 'Wrong element count (6)!');
    });

    it('adds all elements correctly', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.updateElements(
        ['meta'],
        ['meta2'],
        ['data'],
        ['data2'],
        ['container'],
        ['container2'],
        [''],
        0
      );

      const metaExists = await instance.elementExists('meta');
      assert(metaExists, 'Meta does not exist!');
      const dataExists = await instance.elementExists('data');
      assert(dataExists, 'Data does not exist!');
      const containerExists = await instance.elementExists('container');
      assert(containerExists, 'Container does not exist!');
      const meta2Exists = await instance.elementExists('meta2');
      assert(meta2Exists, 'Meta2 does not exist!');
      const data2Exists = await instance.elementExists('data2');
      assert(data2Exists, 'Data2 does not exist!');
      const container2Exists = await instance.elementExists('container2');
      assert(container2Exists, 'Container2 does not exist!');

      const meta = await instance.allElements(0);
      assert(meta[0] === 'meta', 'Meta element incorrect (hash)!');
      assert(meta[1].eq(new BN(0)), 'Meta element incorrect (content)!');
      assert(meta[2].eq(new BN(0)), 'Meta element incorrect (element)!');
      assert(meta[3].eq(new BN(0)), 'Meta element incorrect (index)!');

      const data = await instance.allElements(1);
      assert(data[0] === 'data', 'Data element incorrect (hash)!');
      assert(data[1].eq(new BN(0)), 'Data element incorrect (content)!');
      assert(data[2].eq(new BN(1)), 'Data element incorrect (element)!');
      assert(data[3].eq(new BN(0)), 'Data element incorrect (index)!');

      const container = await instance.allElements(2);
      assert(
        container[0] === 'container',
        'Container element incorrect (hash)!'
      );
      assert(
        container[1].eq(new BN(0)),
        'Container element incorrect (content)!'
      );
      assert(
        container[2].eq(new BN(2)),
        'Container element incorrect (element)!'
      );
      assert(
        container[3].eq(new BN(0)),
        'Container element incorrect (index)!'
      );

      const meta2 = await instance.allElements(0);
      assert(meta2[0] === 'meta', 'Meta element incorrect (hash)!');
      assert(meta2[1].eq(new BN(0)), 'Meta element incorrect (content)!');
      assert(meta2[2].eq(new BN(0)), 'Meta element incorrect (element)!');
      assert(meta2[3].eq(new BN(0)), 'Meta element incorrect (index)!');

      const data2 = await instance.allElements(1);
      assert(data2[0] === 'data', 'Data element incorrect (hash)!');
      assert(data2[1].eq(new BN(0)), 'Data element incorrect (content)!');
      assert(data2[2].eq(new BN(1)), 'Data element incorrect (element)!');
      assert(data2[3].eq(new BN(0)), 'Data element incorrect (index)!');

      const container2 = await instance.allElements(2);
      assert(
        container2[0] === 'container',
        'Container element incorrect (hash)!'
      );
      assert(
        container2[1].eq(new BN(0)),
        'Container element incorrect (content)!'
      );
      assert(
        container2[2].eq(new BN(2)),
        'Container element incorrect (element)!'
      );
      assert(
        container2[3].eq(new BN(0)),
        'Container element incorrect (index)!'
      );
    });

    it('adds data to history correctly', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.updateElements(
        ['meta'],
        ['meta2'],
        ['data'],
        ['data2'],
        ['container'],
        ['container2'],
        [''],
        0
      );

      const history = await instance.getHistory();
      assert(history.length === 2, 'history length incorrect');
      assert(history[1].prevMetaHash === 'meta', 'prevMetaHash incorrect');
      assert(history[1].prevDataHash === 'data', 'prevDataHash incorrect');
      assert(
        history[1].prevContainerHash === 'container',
        'prevContainerHash incorrect'
      );
      assert(history[1].newMetaHash === 'meta2', 'newMetaHash incorrect');
      assert(history[1].newDataHash === 'data2', 'newDataHash incorrect');
      assert(
        history[1].newContainerHash === 'container2',
        'newContainerHash incorrect'
      );
      assert(
        (history[1].operationType as unknown as string) === '1',
        'operationType incorrect'
      );
      assert(
        history[1].parentContainerHash === '',
        'parentContainerHash incorrect'
      );
    });

    it('adds parent to children relationships', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.updateElements(
        ['meta'],
        ['meta2'],
        ['data'],
        ['data2'],
        ['container'],
        ['container2'],
        [''],
        0
      );

      const metaParent = await instance.parent('meta2');
      assert(metaParent === 'container2', 'metaParent incorrect');

      const dataParent = await instance.parent('data2');
      assert(dataParent === 'container2', 'dataParent incorrect');

      const containerChild0 = await instance.children('container2', 0);
      assert(containerChild0 === 'meta2', 'containerChild0 incorrect');
      const containerChild1 = await instance.children('container2', 1);
      assert(containerChild1 === 'data2', 'containerChild1 incorrect');
    });

    it('adds versioning correctly', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.updateElements(
        ['meta'],
        ['meta2'],
        ['data'],
        ['data2'],
        ['container'],
        ['container2'],
        [''],
        0
      );

      const metaNewVersion = await instance.oldToNewVersions('meta');
      const dataNewVersion = await instance.oldToNewVersions('data');
      const containerNewVersion = await instance.oldToNewVersions('container');

      assert(metaNewVersion === 'meta2', 'New version of meta hash incorrect.');
      assert(dataNewVersion === 'data2', 'New version of data hash incorrect.');
      assert(
        containerNewVersion === 'container2',
        'New version of container hash incorrect.'
      );
    });

    it('emits Update event', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      const response = await instance.updateElements(
        ['meta'],
        ['meta2'],
        ['data'],
        ['data2'],
        ['container'],
        ['container2'],
        [''],
        0
      );

      assert(response.logs.some((log) => log.event === 'Update'));
    });
  });

  describe('Removing elements', () => {
    it('only works for participants', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await expectRevert(
        instance.removeElements(['meta'], ['data'], ['container'], {
          from: accounts[1],
        }),
        'is missing role'
      );
    });

    it('checks workload', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await expectRevert(
        instance.removeElements(
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
          ['container']
        ),
        'Workload to high!'
      );
    });

    it('checks existance of elements to delete', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);

      await expectRevert(
        instance.removeElements(['meta2'], ['data'], ['container']),
        'Element (meta) not found!'
      );

      await expectRevert(
        instance.removeElements(['meta'], ['data2'], ['container']),
        'Element (data) not found!'
      );

      await expectRevert(
        instance.removeElements(['meta'], ['data'], ['container2']),
        'Element (container) not found!'
      );
    });

    it('checks existance of elements to delete', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.updateElements(
        ['meta'],
        ['newMeta'],
        ['data'],
        ['newData'],
        ['container'],
        ['newContainer'],
        [''],
        0
      );

      await expectRevert(
        instance.removeElements(['meta'], ['newData'], ['newContainer']),
        'Newer (meta) version exists!'
      );

      await expectRevert(
        instance.removeElements(['newMeta'], ['data'], ['newContainer']),
        'Newer (data) version exists!'
      );

      await expectRevert(
        instance.removeElements(['newMeta'], ['newData'], ['container']),
        'Newer (container) version exists!'
      );
    });

    it('checks parent relationship of elements to update', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.createElements(
        ['meta1'],
        ['data1'],
        ['container1'],
        [''],
        0
      );

      await expectRevert(
        instance.removeElements(['meta'], ['data1'], ['container1']),
        'Element (meta) is not child of container1!'
      );

      await expectRevert(
        instance.removeElements(['meta'], ['data1'], ['container']),
        'Element (data) is not child of container!'
      );
    });

    it('updates versioning to ZERO_HASH for all elements to update', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.removeElements(['meta'], ['data'], ['container']);

      const zeroHash = await instance.ZERO_HASH();

      const metaNewVersion = await instance.oldToNewVersions('meta');
      const dataNewVersion = await instance.oldToNewVersions('data');
      const containerNewVersion = await instance.oldToNewVersions('container');

      assert(
        metaNewVersion === zeroHash,
        'New version of meta hash incorrect.'
      );
      assert(
        dataNewVersion === zeroHash,
        'New version of data hash incorrect.'
      );
      assert(
        containerNewVersion === zeroHash,
        'New version of container hash incorrect.'
      );
    });

    it('adds data to history correctly', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      await instance.removeElements(['meta'], ['data'], ['container']);
      const zeroHash = await instance.ZERO_HASH();

      const history = await instance.getHistory();
      assert(history.length === 2, 'history length incorrect');
      assert(history[1].prevMetaHash === 'meta', 'prevMetaHash incorrect');
      assert(history[1].prevDataHash === 'data', 'prevDataHash incorrect');
      assert(
        history[1].prevContainerHash === 'container',
        'prevContainerHash incorrect'
      );
      assert(history[1].newMetaHash === zeroHash, 'newMetaHash incorrect');
      assert(history[1].newDataHash === zeroHash, 'newDataHash incorrect');
      assert(
        history[1].newContainerHash === zeroHash,
        'newContainerHash incorrect'
      );
      assert(
        (history[1].operationType as unknown as string) === '2',
        'operationType incorrect'
      );
      assert(
        history[1].parentContainerHash === '',
        'parentContainerHash incorrect'
      );
    });

    it('emits Delete event', async () => {
      const instance = await Bucket.new(
        paymentManager.address,
        participantManager.address,
        { value: new BN(1000000000000000) }
      );
      await instance.addKeys(['hash123'], [accounts[0]]);
      await instance.createElements(['meta'], ['data'], ['container'], [''], 0);
      const response = await instance.removeElements(
        ['meta'],
        ['data'],
        ['container']
      );

      assert(response.logs.some((log) => log.event === 'Delete'));
    });
  });
});

export {};
