import { getAccountKeys } from '../keys.helper';

const CreditChecker = artifacts.require('CreditChecker');

const { ACCOUNT_0_PRIVATE_KEY, ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

contract('CreditChecker', () => {
  describe('Validating credits', () => {
    it('identifies correct signature', async () => {
      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );
      const instance = await CreditChecker.new();

      const result = await instance.isValidCredit(
        signResult.signature,
        ACCOUNT_0_ADDRESS,
        credit,
        random
      );
      assert.equal(result[0], true);
      assert.equal(result[1], hash, 'Hash comparison failed');
    });

    it('fails for invalid invitation code', async () => {
      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );
      const instance = await CreditChecker.new();

      const result = await instance.isValidCredit(
        signResult.signature,
        ACCOUNT_0_ADDRESS,
        credit,
        'invalid'
      );
      assert.equal(result[0], false);
      assert.notEqual(result[1], hash, 'Hash comparison failed');
    });

    it('identifies invalid signer', async () => {
      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        ACCOUNT_0_PRIVATE_KEY
      );
      const instance = await CreditChecker.new();

      const result = await instance.isValidCredit(
        signResult.signature,
        ACCOUNT_1_ADDRESS,
        credit,
        random
      );
      assert(result[0] === false, 'Signature validation failed');
    });
  });
});
