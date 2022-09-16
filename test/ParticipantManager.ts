import Web3 from 'Web3';
import {
  ParticipantManagerContract,
  ParticipantManagerInstance,
} from '../types/truffle-contracts';
const {
  BN, // Big Number support
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const ParticipantManager = artifacts.require('ParticipantManager');
const PubKeyChecker = artifacts.require('PubKeyChecker');
const InvitationChecker = artifacts.require('InvitationChecker');
const PaymentManager = artifacts.require('PaymentManager');

contract('ParticipantManager', (accounts) => {
  const adminRoleHash =
    '0x0000000000000000000000000000000000000000000000000000000000000000';
  const participantRoleHash = Web3.utils.keccak256('PARTICIPANT');
  const editorRoleHash = Web3.utils.keccak256('EDITOR');
  const managerRoleHash = Web3.utils.keccak256('MANAGER');
  const ownerRoleHash = Web3.utils.keccak256('OWNER');

  describe('Roles', () => {
    let instance: ParticipantManagerInstance;

    before(async () => {
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const adr = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4';
      const pubKey =
        '0x68cb0cffc92a03959e6fdc99a24f8c94143050099ca104863528c25e3c024f61a7049e09e669397f43d0fd63432b5b358f3d0caaf03b34acbcdc7f2cbe227db9';
      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      instance = await ParticipantManager.new(
        'Peter Parker',
        adr,
        pubKey,
        paymentManager.address
      );
    });

    it('PARTICIPANT_ROLE', async () => {
      const roleHash = await instance.PARTICIPANT_ROLE();
      assert.equal(participantRoleHash, roleHash);
    });

    it('EDITOR_ROLE', async () => {
      const roleHash = await instance.EDITOR_ROLE();
      assert.equal(editorRoleHash, roleHash);
    });

    it('MANAGER_ROLE', async () => {
      const roleHash = await instance.MANAGER_ROLE();
      assert.equal(managerRoleHash, roleHash);
    });

    it('OWNER_ROLE', async () => {
      const roleHash = await instance.OWNER_ROLE();
      assert.equal(ownerRoleHash, roleHash);
    });

    it('ADMIN_ROLE', async () => {
      const roleHash = await instance.DEFAULT_ADMIN_ROLE();
      assert.equal(adminRoleHash, roleHash);
    });
  });

  describe('After deployment', () => {
    let instance: ParticipantManagerInstance;
    const adr = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4';
    const pubKey =
      '0x68cb0cffc92a03959e6fdc99a24f8c94143050099ca104863528c25e3c024f61a7049e09e669397f43d0fd63432b5b358f3d0caaf03b34acbcdc7f2cbe227db9';

    before(async () => {
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      instance = await ParticipantManager.new(
        'Peter Parker',
        adr,
        pubKey,
        paymentManager.address
      );
    });

    it('deployer has DEFAULT_ADMIN_ROLE', async () => {
      const hasRole = await instance.hasRole(adminRoleHash, adr);
      assert.equal(hasRole, true);
    });

    it('deployer has PARTICIPANT_ROLE', async () => {
      const hasRole = await instance.hasRole(participantRoleHash, adr);
      assert.equal(hasRole, true);
    });

    it('deployer has EDITOR_ROLE', async () => {
      const hasRole = await instance.hasRole(editorRoleHash, adr);
      assert.equal(hasRole, true);
    });

    it('deployer has MANAGER_ROLE', async () => {
      const hasRole = await instance.hasRole(managerRoleHash, adr);
      assert.equal(hasRole, true);
    });

    it('deployer has OWNER_ROLE', async () => {
      const hasRole = await instance.hasRole(ownerRoleHash, adr);
      assert.equal(hasRole, true);
    });

    it("deployer's address is saved", async () => {
      const deployer = await instance.allParticipantAddresses(0);
      assert.equal(deployer, adr);
    });

    it("deployer's data is valid", async () => {
      const participant = await instance.allParticipants(adr);
      assert.equal(participant[0], adr);
      assert.equal(participant[1], 'Peter Parker');
      assert.equal(participant[2], pubKey);
      assert.equal(participant[3], true);
    });
  });

  describe('Removing participation', () => {
    let instance: ParticipantManagerInstance;
    const pubKey =
      '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436';

    beforeEach(async () => {
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      instance = await ParticipantManager.new(
        'Peter Parker',
        accounts[0],
        pubKey,
        paymentManager.address
      );
    });

    it('removes all roles for participant', async () => {
      await instance.removeParticipation();
      let hasRole = await instance.hasRole(participantRoleHash, accounts[0]);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(editorRoleHash, accounts[0]);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(managerRoleHash, accounts[0]);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(adminRoleHash, accounts[0]);
      assert.equal(hasRole, true);
      hasRole = await instance.hasRole(ownerRoleHash, accounts[0]);
      assert.equal(hasRole, false);
    });

    it('removes participant from all participants', async () => {
      await instance.removeParticipation();
      const result = await instance.allParticipants(accounts[0]);
      assert.equal(result[0], constants.ZERO_ADDRESS);
      assert.equal(result[1], '');
      assert.equal(result[2], null);
      assert.equal(result[3], false);
    });

    it('emits RemoveOwner event', async () => {
      const response = await instance.removeParticipation();
      assert(response.logs.some((log) => log.event === 'RemoveParticipant'));
    });
  });

  describe('Redeeming participation code', () => {
    it('fails for insufficient fee', async () => {
      const pManager = await PaymentManager.new(1000, 1000);
      await web3.eth.accounts.wallet.create(1);
      const newAccount = web3.eth.accounts.wallet[0];
      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        newAccount.privateKey
      );

      const pubKey =
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436';
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      const instance = await ParticipantManager.new(
        'Peter Parker',
        accounts[0],
        pubKey,
        paymentManager.address
      );

      await expectRevert(
        instance.redeemParticipationCode(
          'Paul',
          newAccount.address,
          signResult.signature,
          randomCode,
          pubKey,
          { from: accounts[1], value: new BN('1000') }
        ),
        'Insufficient fee'
      );
    });

    it('only works if inviter is manager', async () => {
      await web3.eth.accounts.wallet.create(1);
      const newAccount = web3.eth.accounts.wallet[0];
      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        newAccount.privateKey
      );

      const pubKey =
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436';
      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      const instance = await ParticipantManager.new(
        'Peter Parker',
        accounts[0],
        pubKey,
        paymentManager.address
      );

      await expectRevert(
        instance.redeemParticipationCode(
          'Paul',
          newAccount.address,
          signResult.signature,
          randomCode,
          pubKey,
          { from: accounts[1], value: new BN('1000000000000000') }
        ),
        'Forbidden'
      );
    });

    it('works as expected', async () => {
      const privateKey =
        '0x6f8074f4d89c4adc637b1afe3f11a14e38953b2df56527a6958ad4bc2a0e411d';
      const publicKey =
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436';
      const address = '0x2BdfC992E37C821BB383613eb5C8134340619C91';

      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(hash, privateKey);

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      const instance = await ParticipantManager.new(
        'Peter Parker',
        address,
        publicKey,
        paymentManager.address
      );

      const account1PubKey =
        '0x8772cef469cc91f80ff85df297b02eee52fe66d3b40e0a3959cf406f77d6277f20e9dec05e12fd36dc5622bfaca5dfa6331452eddcd78a6c01fdce5053c29f13';
      await instance.redeemParticipationCode(
        'Paul',
        address,
        signResult.signature,
        randomCode,
        account1PubKey,
        { from: accounts[1], value: new BN('1000000000000000') }
      );

      const result = await instance.allParticipants(accounts[1]);
      assert.equal(result[0], accounts[1]);
      assert.equal(result[1], 'Paul');
      assert.equal(result[2], account1PubKey);
      assert.equal(result[3], true);

      let hasRole = await instance.hasRole(ownerRoleHash, accounts[1]);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(participantRoleHash, accounts[1]);
      assert.equal(hasRole, true);
      hasRole = await instance.hasRole(editorRoleHash, accounts[1]);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(managerRoleHash, accounts[1]);
      assert.equal(hasRole, false);
      hasRole = await instance.hasRole(adminRoleHash, accounts[1]);
      assert.equal(hasRole, false);

      const deployer = await instance.allParticipantAddresses(1);
      assert.equal(deployer, accounts[1]);
    });

    it('emits event AddOwner', async () => {
      const privateKey =
        '0x6f8074f4d89c4adc637b1afe3f11a14e38953b2df56527a6958ad4bc2a0e411d';
      const publicKey =
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436';
      const address = '0x2BdfC992E37C821BB383613eb5C8134340619C91';

      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(hash, privateKey);

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      const instance = await ParticipantManager.new(
        'Peter Parker',
        address,
        publicKey,
        paymentManager.address
      );

      const account1PubKey =
        '0x8772cef469cc91f80ff85df297b02eee52fe66d3b40e0a3959cf406f77d6277f20e9dec05e12fd36dc5622bfaca5dfa6331452eddcd78a6c01fdce5053c29f13';
      const response = await instance.redeemParticipationCode(
        'Paul',
        address,
        signResult.signature,
        randomCode,
        account1PubKey,
        { from: accounts[1], value: new BN('1000000000000000') }
      );

      assert(response.logs.some((log) => log.event === 'AddParticipant'));
    });

    it('fails for already redeemed code', async () => {
      const privateKey =
        '0x6f8074f4d89c4adc637b1afe3f11a14e38953b2df56527a6958ad4bc2a0e411d';
      const publicKey =
        '0x358e51fc0fba247f2c9dab106dd7847396a12bb74a86a88fe5bf26ec6d24ff5631679979da407c8122d5cf93aadde5be23cfcf23fa6d73c62c4e0cd9d5e02436';
      const address = '0x2BdfC992E37C821BB383613eb5C8134340619C91';

      const randomCode = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(randomCode) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(hash, privateKey);

      const invitationChecker = await InvitationChecker.new();
      const pubKeyChecker = await PubKeyChecker.new();
      ParticipantManager.link('InvitationChecker', invitationChecker.address);
      ParticipantManager.link('PubKeyChecker', pubKeyChecker.address);
      const paymentManager = await PaymentManager.new(1000000000000000, 100);
      const instance = await ParticipantManager.new(
        'Peter Parker',
        address,
        publicKey,
        paymentManager.address
      );

      const account1PubKey =
        '0x8772cef469cc91f80ff85df297b02eee52fe66d3b40e0a3959cf406f77d6277f20e9dec05e12fd36dc5622bfaca5dfa6331452eddcd78a6c01fdce5053c29f13';
      const account2PubKey =
        '0x04030c209dfe7436f45a660fa690738c4d3e35af418135decf72a575b0d4d2f67b90a0801b96b44bd7466eb4a4a49f4fe16f2ab865d78dfff7c0d3fb051b8d6491';
      await instance.redeemParticipationCode(
        'Paul',
        address,
        signResult.signature,
        randomCode,
        account1PubKey,
        { from: accounts[1], value: new BN('1000000000000000') }
      );

      await expectRevert(
        instance.redeemParticipationCode(
          'Mallory',
          address,
          signResult.signature,
          randomCode,
          account2PubKey,
          { from: accounts[2], value: new BN('1000000000000000') }
        ),
        'Already used'
      );
    });
  });
});

export {};
