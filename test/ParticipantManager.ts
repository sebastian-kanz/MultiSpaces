import Web3 from 'web3';
import { ParticipantManagerInstance } from '../types/truffle-contracts';
const { constants, expectRevert } = require('@openzeppelin/test-helpers');
import { getAccountKeys } from './keys.helper';

const ParticipantManager = artifacts.require('ParticipantManager');
const PubKeyChecker = artifacts.require('PubKeyChecker');
const CreditChecker = artifacts.require('CreditChecker');
const InvitationChecker = artifacts.require('InvitationChecker');
const PaymentManager = artifacts.require('PaymentManager');

const {
  ACCOUNT_0_PRIVATE_KEY,
  ACCOUNT_0_PUBLIC_KEY,
  ACCOUNT_0_ADDRESS,
  ACCOUNT_1_PUBLIC_KEY,
  ACCOUNT_1_ADDRESS,
  ACCOUNT_2_PUBLIC_KEY,
  ACCOUNT_2_ADDRESS,
} = getAccountKeys();

contract('ParticipantManager', () => {
  const adminRoleHash =
    '0x0000000000000000000000000000000000000000000000000000000000000000';
  const participantRoleHash = Web3.utils.keccak256('PARTICIPANT');
  const updaterRoleHash = Web3.utils.keccak256('UPDATER');
  const managerRoleHash = Web3.utils.keccak256('MANAGER');
  const ownerRoleHash = Web3.utils.keccak256('OWNER');

  describe('Roles', () => {
    let instance: ParticipantManagerInstance;

    before(async () => {
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      const creditChecker = await CreditChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      PaymentManager.link('CreditChecker', creditChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address
      );
    });

    it('PARTICIPANT_ROLE', async () => {
      const roleHash = await instance.ALL_ROLES(0);
      assert.equal(participantRoleHash, roleHash);
    });

    it('UPDATER_ROLE', async () => {
      const roleHash = await instance.ALL_ROLES(1);
      assert.equal(updaterRoleHash, roleHash);
    });

    it('MANAGER_ROLE', async () => {
      const roleHash = await instance.ALL_ROLES(2);
      assert.equal(managerRoleHash, roleHash);
    });

    it('OWNER_ROLE', async () => {
      const roleHash = await instance.ALL_ROLES(3);
      assert.equal(ownerRoleHash, roleHash);
    });

    it('ADMIN_ROLE', async () => {
      const roleHash = await instance.DEFAULT_ADMIN_ROLE();
      assert.equal(adminRoleHash, roleHash);
    });
  });

  describe('After deployment', () => {
    let instance: ParticipantManagerInstance;

    before(async () => {
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address
      );
    });

    it('deployer has DEFAULT_ADMIN_ROLE', async () => {
      const hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_0_ADDRESS);
      assert.equal(hasRole, true);
    });

    it('deployer has PARTICIPANT_ROLE', async () => {
      const hasRole = await instance.hasRole(
        participantRoleHash,
        ACCOUNT_0_ADDRESS
      );
      assert.equal(hasRole, true);
    });

    it('deployer has UPDATER_ROLE', async () => {
      const hasRole = await instance.hasRole(
        updaterRoleHash,
        ACCOUNT_0_ADDRESS
      );
      assert.equal(hasRole, true);
    });

    it('deployer has MANAGER_ROLE', async () => {
      const hasRole = await instance.hasRole(
        managerRoleHash,
        ACCOUNT_0_ADDRESS
      );
      assert.equal(hasRole, true);
    });

    it('deployer has OWNER_ROLE', async () => {
      const hasRole = await instance.hasRole(ownerRoleHash, ACCOUNT_0_ADDRESS);
      assert.equal(hasRole, true);
    });

    it("deployer's address is saved", async () => {
      const deployer = await instance.allParticipantAddresses(0);
      assert.equal(deployer, ACCOUNT_0_ADDRESS);
    });

    it("deployer's data is valid", async () => {
      const participant = await instance.allParticipants(ACCOUNT_0_ADDRESS);
      assert.equal(participant[0], ACCOUNT_0_ADDRESS);
      assert.equal(participant[1], 'Peter Parker');
      assert.equal(participant[2], ACCOUNT_0_PUBLIC_KEY);
      assert.equal(participant[3], true);
    });
  });

  describe('Removing participation', () => {
    let instance: ParticipantManagerInstance;

    beforeEach(async () => {
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address
      );
    });

    it('removes all roles for participant', async () => {
      await instance.removeParticipation(ACCOUNT_0_ADDRESS);
      let hasRole = await instance.hasRole(
        participantRoleHash,
        ACCOUNT_0_ADDRESS
      );
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(updaterRoleHash, ACCOUNT_0_ADDRESS);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(managerRoleHash, ACCOUNT_0_ADDRESS);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_0_ADDRESS);
      assert.equal(hasRole, true);
      hasRole = await instance.hasRole(ownerRoleHash, ACCOUNT_0_ADDRESS);
      assert.equal(hasRole, false);
    });

    it('removes participant from all participants', async () => {
      await instance.removeParticipation(ACCOUNT_0_ADDRESS);
      const result = await instance.allParticipants(ACCOUNT_0_ADDRESS);
      assert.equal(result[0], constants.ZERO_ADDRESS);
      assert.equal(result[1], '');
      assert.equal(result[2], null);
      assert.equal(result[3], false);
    });

    it('emits RemoveOwner event', async () => {
      const response = await instance.removeParticipation(ACCOUNT_0_ADDRESS);
      assert(response.logs.some((log) => log.event === 'RemoveParticipant'));
    });
  });

  describe('Redeeming participation code', () => {
    it('only works if inviter is manager', async () => {
      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const creditChecker = await CreditChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      const instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address,
        { from: ACCOUNT_0_ADDRESS }
      );

      await instance.renounceRole(managerRoleHash, ACCOUNT_0_ADDRESS);

      await expectRevert(
        instance.redeemParticipationCode(
          'Paul',
          ACCOUNT_0_ADDRESS,
          ACCOUNT_1_ADDRESS,
          signResult.signature,
          randomCode,
          ACCOUNT_1_PUBLIC_KEY,
          { from: ACCOUNT_0_ADDRESS }
        ),
        'Forbidden'
      );
    });

    it('only works if sender is admin', async () => {
      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const creditChecker = await CreditChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      const instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address,
        { from: ACCOUNT_0_ADDRESS }
      );

      await instance.renounceRole(adminRoleHash, ACCOUNT_0_ADDRESS);

      await expectRevert(
        instance.redeemParticipationCode(
          'Paul',
          ACCOUNT_0_ADDRESS,
          ACCOUNT_1_ADDRESS,
          signResult.signature,
          randomCode,
          ACCOUNT_1_PUBLIC_KEY,
          { from: ACCOUNT_0_ADDRESS }
        ),
        'missing role'
      );
    });

    it('works as expected', async () => {
      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const creditChecker = await CreditChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      const instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address,
        { from: ACCOUNT_0_ADDRESS }
      );

      await instance.redeemParticipationCode(
        'Paul',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        signResult.signature,
        randomCode,
        ACCOUNT_1_PUBLIC_KEY,
        { from: ACCOUNT_0_ADDRESS }
      );

      const result = await instance.allParticipants(ACCOUNT_1_ADDRESS);
      assert.equal(result[0], ACCOUNT_1_ADDRESS);
      assert.equal(result[1], 'Paul');
      assert.equal(result[2], ACCOUNT_1_PUBLIC_KEY);
      assert.equal(result[3], true);

      let hasRole = await instance.hasRole(ownerRoleHash, ACCOUNT_1_ADDRESS);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(participantRoleHash, ACCOUNT_1_ADDRESS);
      assert.equal(hasRole, true);
      hasRole = await instance.hasRole(updaterRoleHash, ACCOUNT_1_ADDRESS);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(managerRoleHash, ACCOUNT_1_ADDRESS);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_1_ADDRESS);
      assert.equal(hasRole, false);

      const deployer = await instance.allParticipantAddresses(1);
      assert.equal(deployer, ACCOUNT_1_ADDRESS);
    });

    it('emits event AddParticipant', async () => {
      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const creditChecker = await CreditChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      const instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address,
        { from: ACCOUNT_0_ADDRESS }
      );

      const response = await instance.redeemParticipationCode(
        'Paul',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        signResult.signature,
        randomCode,
        ACCOUNT_1_PUBLIC_KEY,
        { from: ACCOUNT_0_ADDRESS }
      );

      assert(response.logs.some((log) => log.event === 'AddParticipant'));
    });

    it('fails for already redeemed code', async () => {
      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const creditChecker = await CreditChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      const instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address,
        { from: ACCOUNT_0_ADDRESS }
      );

      await instance.redeemParticipationCode(
        'Paul',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_2_ADDRESS,
        signResult.signature,
        randomCode,
        ACCOUNT_2_PUBLIC_KEY,
        { from: ACCOUNT_0_ADDRESS }
      );

      await expectRevert(
        instance.redeemParticipationCode(
          'Paul',
          ACCOUNT_0_ADDRESS,
          ACCOUNT_1_ADDRESS,
          signResult.signature,
          randomCode,
          ACCOUNT_1_PUBLIC_KEY,
          { from: ACCOUNT_0_ADDRESS }
        ),
        'Already used'
      );
    });

    it('fails if user already exists', async () => {
      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const creditChecker = await CreditChecker.new();
      PaymentManager.link('CreditChecker', creditChecker.address);
      const paymentManager = await PaymentManager.new(
        1000000000000000,
        100,
        1000000000000
      );
      const instance = await ParticipantManager.new(
        'Peter Parker',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_0_PUBLIC_KEY,
        paymentManager.address,
        { from: ACCOUNT_0_ADDRESS }
      );

      await instance.redeemParticipationCode(
        'Paul',
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        signResult.signature,
        randomCode,
        ACCOUNT_1_PUBLIC_KEY,
        { from: ACCOUNT_0_ADDRESS }
      );

      await expectRevert(
        instance.redeemParticipationCode(
          'Paul',
          ACCOUNT_0_ADDRESS,
          ACCOUNT_1_ADDRESS,
          signResult.signature,
          randomCode,
          ACCOUNT_1_PUBLIC_KEY,
          { from: ACCOUNT_0_ADDRESS }
        ),
        'User exists'
      );
    });
  });
});

export {};
