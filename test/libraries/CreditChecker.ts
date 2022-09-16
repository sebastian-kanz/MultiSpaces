const CreditChecker = artifacts.require('CreditChecker');

contract('CreditChecker', (accounts) => {
  describe('Validating credits', () => {
    it('identifies correct signature', async () => {
      await web3.eth.accounts.wallet.create(2);
      const newAccount = web3.eth.accounts.wallet[0];

      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        newAccount.privateKey
      );
      const instance = await CreditChecker.new();

      const result = await instance.isValidCredit(
        signResult.signature,
        newAccount.address,
        credit,
        random
      );
      assert.equal(result[0], true);
      assert.equal(result[1], hash, 'Hash comparison failed');
    });

    it('fails for invalid invitation code', async () => {
      await web3.eth.accounts.wallet.create(2);
      const newAccount = web3.eth.accounts.wallet[0];

      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        newAccount.privateKey
      );
      const instance = await CreditChecker.new();

      const result = await instance.isValidCredit(
        signResult.signature,
        newAccount.address,
        credit,
        'invalid'
      );
      assert.equal(result[0], false);
      assert.notEqual(result[1], hash, 'Hash comparison failed');
    });

    it('identifies invalid signer', async () => {
      await web3.eth.accounts.wallet.create(2);
      const newAccount = web3.eth.accounts.wallet[0];

      const credit = 1;
      const random = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(credit, random) ?? '';
      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        newAccount.privateKey
      );
      const instance = await CreditChecker.new();

      const result = await instance.isValidCredit(
        signResult.signature,
        accounts[0],
        credit,
        random
      );
      assert(result[0] === false, 'Signature validation failed');
    });
  });
});
