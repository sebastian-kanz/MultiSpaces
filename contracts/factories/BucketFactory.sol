// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import '../Bucket.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';
import '../ParticipantManager.sol';
import '../interfaces/IBucketFactory.sol';

contract BucketFactory is Ownable, IBucketFactory {
  using Clones for address;
  address bucketImplementation;
  address elementImplementation;
  mapping(address => bool) registeredSpaces;

  constructor(address bucket, address element) {
    bucketImplementation = bucket;
    elementImplementation = element;
  }

  function setBucketImplementation(address impl) public onlyOwner {
    bucketImplementation = impl;
  }

  function setElementImplementation(address impl) public onlyOwner {
    elementImplementation = impl;
  }

  function createBucket(
    address pManager,
    string memory name,
    address adr,
    bytes memory publicKey
  ) external override returns (IBucket) {
    require(registeredSpaces[msg.sender], 'Only registered spaces allowed!');
    ParticipantManager partManager = new ParticipantManager(
      name,
      adr,
      publicKey,
      address(pManager)
    );
    partManager.grantRole(LibParticipant.OWNER_ROLE, msg.sender);
    partManager.grantRole(0x00, msg.sender);
    IBucket newBucket = IBucket(bucketImplementation.clone());
    newBucket.initialize(pManager, address(partManager), elementImplementation);
    return newBucket;
  }

  function registerSpace(address space) external onlyOwner {
    registeredSpaces[space] = true;
  }

  function unregisterSpace(address space) external onlyOwner {
    registeredSpaces[space] = false;
  }
}
