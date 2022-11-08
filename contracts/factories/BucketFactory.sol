// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import '../Bucket.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';

contract BucketFactory is Ownable {
  using Clones for address;
  // TODO: Use minimal proxy here instead of real instance. Makes deployment while cloning much cheaper
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

  function createBucket(address pManager, address partManager)
    external
    returns (IBucket)
  {
    require(registeredSpaces[msg.sender], 'Only registered spaces allowed!');
    IBucket newBucket = IBucket(bucketImplementation.clone());
    newBucket.initialize(pManager, partManager, elementImplementation);
    return newBucket;
  }

  function registerSpace(address space) external onlyOwner {
    registeredSpaces[space] = true;
  }

  function unregisterSpace(address space) external onlyOwner {
    registeredSpaces[space] = false;
  }
}
