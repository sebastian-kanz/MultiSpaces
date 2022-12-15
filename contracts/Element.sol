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

  Bucket public parentBucket;
  Element public elemImpl;

  mapping(address => bool) public holders;
  uint256 public holdersCount;
  LibElement.RedundancyLevel public minRedundancy;
  LibElement.RedundancyLevel public redundancy;

  event Request(
    address indexed _elem,
    address indexed requestor,
    uint256 indexed time
  );

  function initialize(
    LibElement.AddressBundle memory addresses,
    LibElement.HashBundle memory hashes,
    uint256 cType,
    LibElement.RedundancyLevel mRedundandy
  ) external initializer {
    _setParticipantManager(addresses.participantManager);
    parentBucket = Bucket(addresses.bucket);
    elemImpl = Element(addresses.elemImpl);

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
    bucket.notifyCreation(creator);

    holders[addresses.creator] = true;
    holdersCount++;

    minRedundancy = mRedundandy;
    redundancy = LibElement.RedundancyLevel.SINGLE;
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
      address(parentBucket),
      address(elemImpl)
    );
    Element updatedElement = Element(address(elemImpl).clone());
    Bucket(parentBucket).preRegisterElement(updatedElement);
    updatedElement.initialize(addresses, hashes, contentType, minRedundancy);
    Bucket(parentBucket).notifyUpdate(updatedElement, msg.sender);
    nextElement = address(updatedElement);
  }

  function remove() external onlyRole(LibParticipant.PARTICIPANT_ROLE) {
    require(
      redundancy == LibElement.RedundancyLevel.NONE,
      'Wrong redundancy level. Can not remove.'
    );
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
    emit Request(address(this), msg.sender, block.number);
  }

  function announceHolding()
    external
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    if (!holders[msg.sender]) {
      holdersCount++;
    }
    holders[msg.sender] = true;
  }

  function announceRemoval()
    external
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    if (holders[msg.sender]) {
      holdersCount--;
    }
    holders[msg.sender] = false;
  }

  function setRedundancyLevel(LibElement.RedundancyLevel level)
    external
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    emit LibElement.RedundancyLevelChanged(
      address(this),
      uint256(redundancy),
      uint256(level)
    );
    redundancy = level;
  }
}
