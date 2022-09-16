const { expectRevert } = require('@openzeppelin/test-helpers');

const PubKeyChecker = artifacts.require('PubKeyChecker');

contract('PubKeyChecker', (accounts) => {
  describe('Validating public keys', () => {
    it('checks key length', async () => {
      const address = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4';
      const pubKey =
        '0x0468cb0cffc92a03959e6fdc99a24f8c94143050099ca104863528c25e3c024f61a7049e09e669397f43d0fd63432b5b358f3d0caaf03b34acbcdc7f2cbe227db9';
      const instance = await PubKeyChecker.new();
      await expectRevert(
        instance.validatePubKey(address, pubKey),
        'Invalid key length. Remove leading 0'
      );
    });

    it('succeeds for matching account and key', async () => {
      const address = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4';
      const pubKey =
        '0x68cb0cffc92a03959e6fdc99a24f8c94143050099ca104863528c25e3c024f61a7049e09e669397f43d0fd63432b5b358f3d0caaf03b34acbcdc7f2cbe227db9';
      const instance = await PubKeyChecker.new();
      await instance.validatePubKey(address, pubKey);
    });

    it('fails for non-matching account and key', async () => {
      const address = '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4';
      const pubKey =
        '0x11111111112a03959e6fdc99a24f8c94143050099ca104863528c25e3c024f61a7049e09e669397f43d0fd63432b5b358f3d0caaf03b34acbcdc7f2cbe227db9';
      const instance = await PubKeyChecker.new();
      await expectRevert(
        instance.validatePubKey(address, pubKey),
        'PubKeyChecker: account 0x5b38da6a701c568545dcfcb03fcb875f56beddc4 does not match pubKey'
      );
    });
  });
});
