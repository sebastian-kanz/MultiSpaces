const InvitationChecker = artifacts.require('InvitationChecker');

contract('InvitationChecker', (accounts) => {
  describe('Validating invitation', () => {
    it('identifies correct signature', async () => {
      await web3.eth.accounts.wallet.create(2);
      const newAccount = web3.eth.accounts.wallet[0];

      const text = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(text) ?? '';

      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        newAccount.privateKey
      );
      const instance = await InvitationChecker.new();

      const result = await instance.isValidInvitation(
        signResult.signature,
        newAccount.address,
        text
      );
      assert.equal(result[0], true);
      assert.equal(result[1], hash, 'Hash comparison failed');
    });

    it('fails for invalid invitation code', async () => {
      await web3.eth.accounts.wallet.create(2);
      const newAccount = web3.eth.accounts.wallet[0];

      const text = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(text) ?? '';

      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        newAccount.privateKey
      );
      const instance = await InvitationChecker.new();

      const result = await instance.isValidInvitation(
        signResult.signature,
        newAccount.address,
        'invalid code'
      );
      assert.equal(result[0], false);
      assert.notEqual(result[1], hash, 'Hash comparison failed');
    });

    it('identifies invalid signer', async () => {
      await web3.eth.accounts.wallet.create(2);
      const newAccount = web3.eth.accounts.wallet[0];

      const text = 'This is a random invitation code';
      const hash = web3.utils.soliditySha3(text) ?? '';

      // web3.eth.accounts.sign adds 'Ethereum signed message', so we dont need to manually add it here
      const signResult = await web3.eth.accounts.sign(
        hash,
        newAccount.privateKey
      );
      const instance = await InvitationChecker.new();

      const result = await instance.isValidInvitation(
        signResult.signature,
        accounts[0],
        text
      );
      assert(result[0] === false, 'Signature validation failed');
    });
  });
});
