// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import '@openzeppelin/contracts/proxy/utils/Initializable.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';
import './Bucket.sol';
import './adapters/ParticipantManagerAdapter.sol';
import './libraries/LibParticipant.sol';
import './libraries/LibElement.sol';

contract Element is Initializable, ParticipantManagerAdapter {
  using Clones for address;

  string public metaHash;
  string public dataHash;
  string public containerHash;

  uint256 public contentType;
  uint256 public creationTime;

  address public creator;

  address public parentElement;
  address public previousElement;
  address public nextElement;

  Bucket private parentBucket;

  function initialize(
    LibElement.AddressBundle memory addresses,
    LibElement.HashBundle memory hashes,
    uint256 cType
  ) external initializer {
    _setParticipantManager(addresses.participantManager);
    parentBucket = Bucket(addresses.bucket);

    require(!parentBucket.hashExists(hashes.meta), 'Meta already exists');
    require(!parentBucket.hashExists(hashes.data), 'Data already exists');
    require(
      !parentBucket.hashExists(hashes.container),
      'Container already exists'
    );
    metaHash = hashes.meta;
    dataHash = hashes.data;
    containerHash = hashes.container;
    creationTime = block.number;
    previousElement = addresses.previous;
    nextElement = address(this);
    parentElement = addresses.parent;
    contentType = cType;

    creator = addresses.creator;
    Bucket bucket = Bucket(parentBucket);
    bucket.notifyCreation(this, creator);
  }

  function update(LibElement.HashBundle memory hashes, address parent)
    external
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    require(
      address(nextElement) == address(this),
      'Newer version already exists'
    );

    require(!parentBucket.hashExists(hashes.meta), 'New meta already exists');
    require(!parentBucket.hashExists(hashes.data), 'New data already exists');
    require(
      !parentBucket.hashExists(hashes.container),
      'New container already exists'
    );

    LibElement.AddressBundle memory addresses = LibElement.AddressBundle(
      creator,
      address(participantManager),
      parent,
      address(this),
      address(parentBucket)
    );
    Element updatedElement = Element(address(this).clone());
    updatedElement.initialize(addresses, hashes, contentType);

    nextElement = address(updatedElement);

    creator = addresses.creator;
    Bucket(parentBucket).notifyUpdate(this, msg.sender);
  }

  function remove() external onlyRole(LibParticipant.PARTICIPANT_ROLE) {
    nextElement = address(0);
    Bucket(parentBucket).notifyDelete(this, msg.sender);
  }

  function setParent(address parent)
    external
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    parentElement = parent;
    Bucket(parentBucket).notifyUpdateParent(this, msg.sender);
  }

  function requestData() external {
    emit LibElement.Request(address(this), msg.sender, block.number);
  }
}
