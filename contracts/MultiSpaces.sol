// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import './Space.sol';
import './PaymentManager.sol';
import './factories/BucketFactory.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';

contract MultiSpaces is Ownable {
  using Clones for address;
  // TODO: Use minimal proxy here instead of real instance. Makes deployment while cloning much cheaper
  address spaceImplementation;
  address[] public spaces;
  mapping(bytes => address) public ownedSpaces;
  uint256 public baseFee = 1000000000000000;
  uint256 public baseLimit = 100;
  PaymentManager public paymentManager;
  BucketFactory public bucketFactory;

  constructor(BucketFactory bfactory, address impl) {
    paymentManager = new PaymentManager(baseFee, baseLimit);
    paymentManager.transferOwnership(owner());
    bucketFactory = bfactory;
    spaceImplementation = impl;
  }

  function createSpace(string memory participantName, bytes memory pubKey)
    public
    payable
    returns (address)
  {
    if (ownedSpaces[pubKey] == address(0)) {
      Space space = Space(spaceImplementation.clone());
      space.initialize{ value: msg.value }(
        msg.sender,
        participantName,
        pubKey,
        address(bucketFactory),
        address(paymentManager)
      );
      spaces.push(address(space));
      ownedSpaces[pubKey] = address(space);

      bucketFactory.registerSpace(address(space));
      return address(space);
    }
    return ownedSpaces[pubKey];
  }

  fallback() external payable {
    _sendToPaymentManager();
  }

  receive() external payable {
    _sendToPaymentManager();
  }

  function _sendToPaymentManager() private {
    paymentManager.increaseCredits{ value: msg.value }(msg.sender);
  }
}
