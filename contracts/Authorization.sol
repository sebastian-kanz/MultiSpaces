// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import './interfaces/IBucket.sol';
import './adapters/PaymentAdapter.sol';
import './adapters/ParticipantManagerAdapter.sol';
import './KeyManager.sol';
import './Element.sol';
import './libraries/LibParticipant.sol';
import './libraries/LibElement.sol';
import '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol';

abstract contract Authorization {
  mapping(address => mapping(address => uint256)) authorizations;
  uint256 public GENESIS;
  uint256 public constant EPOCH = 100;
  mapping(bytes => bool) usedRandoms;

  function _currentEpoch() private view returns (uint256) {
    return (block.number - GENESIS) / EPOCH;
  }

  function _isAuthorized(address issuer, address holder)
    internal
    view
    returns (bool)
  {
    if (authorizations[issuer][holder] == _currentEpoch()) {
      return true;
    }
    return false;
  }

  function _authorizedSender(address issuer, address holder)
    internal
    view
    virtual
    returns (address)
  {
    require(issuer == holder || _isAuthorized(issuer, holder), 'Unauthorized!');
    return issuer;
  }

  function addAuthorization(
    address signer,
    bytes memory authSig,
    uint256 epoch,
    bytes memory random
  ) external {
    require(!usedRandoms[random], 'Authorization code already used.');
    bytes32 hash = keccak256(
      abi.encodePacked(signer, msg.sender, epoch, random)
    );
    bytes32 ethSignedMessageHash = keccak256(
      abi.encodePacked('\x19Ethereum Signed Message:\n32', hash)
    );

    require(
      SignatureChecker.isValidSignatureNow(
        signer,
        ethSignedMessageHash,
        authSig
      ),
      'Not allowed.'
    );
    usedRandoms[random] = true;
    authorizations[signer][msg.sender] = epoch;
  }

  function removeAuthorization(address holder) external {
    authorizations[msg.sender][holder] = 0;
  }
}
