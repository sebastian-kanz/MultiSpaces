import { getAccountKeys } from '../keys.helper';

const { expectRevert } = require('@openzeppelin/test-helpers');

const PubKeyChecker = artifacts.require('PubKeyChecker');

const { ACCOUNT_0_PUBLIC_KEY, ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

contract('PubKeyChecker', () => {
  describe('Validating public keys', () => {
    it('checks key length', async () => {
      const instance = await PubKeyChecker.new();
      await expectRevert(
        instance.validatePubKey(
          ACCOUNT_0_ADDRESS,
          ACCOUNT_0_PUBLIC_KEY.replace('0x', '0x04')
        ),
        'Invalid key length. Remove leading 0'
      );
    });

    it('succeeds for matching account and key', async () => {
      const instance = await PubKeyChecker.new();
      await instance.validatePubKey(ACCOUNT_0_ADDRESS, ACCOUNT_0_PUBLIC_KEY);
    });

    it('fails for non-matching account and key', async () => {
      const instance = await PubKeyChecker.new();
      await expectRevert(
        instance.validatePubKey(ACCOUNT_1_ADDRESS, ACCOUNT_0_PUBLIC_KEY),
        `PubKeyChecker: account ${ACCOUNT_1_ADDRESS.toLowerCase()} does not match pubKey`
      );
    });
  });
});
