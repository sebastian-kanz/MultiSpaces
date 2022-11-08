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

contract Bucket is
  IBucket,
  KeyManager,
  PaymentAdapter,
  ParticipantManagerAdapter,
  Initializable
{
  using Clones for address;
  address public elementImpl;
  address[] public allElements;
  mapping(address => bool) public registeredElements;
  mapping(string => bool) public hashExists;
  LibElement.Operation[] public history;

  function initialize(
    address pManager,
    address partManager,
    address impl
  ) external initializer {
    _setPaymentManager(pManager);
    _setParticipantManager(partManager);
    elementImpl = impl;
  }

  function addKeys(string[] memory newHashes, address[] memory participants)
    external
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    require(newHashes.length == participantCount(), 'Invalid input');
    require(participants.length == participantCount(), 'Invalid input');
    _addKeys(newHashes, participants);
  }

  function setKeyForParticipant(
    string memory keyHash,
    address participant,
    uint256 blockNumber
  ) external onlyRole(LibParticipant.PARTICIPANT_ROLE) {
    _setKeyForParticipant(keyHash, participant, blockNumber);
  }

  // @notice Create multiple elements at once
  // @param elements List of elements to create
  function createElements(
    string[] memory newMetaHashes,
    string[] memory newDataHashes,
    string[] memory newContainerHashes,
    address[] memory parents,
    uint256 contentType
  )
    external
    override
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
    decreaseLimit(IPaymentManager.LimitedAction.ADD_DATA, newMetaHashes.length)
    keyAvailable(block.number, msg.sender)
  {
    uint256 elementsCount = newMetaHashes.length;
    require(elementsCount <= LibElement.MAX_WORKLOAD, 'Workload to high!');
    require(
      newDataHashes.length == elementsCount,
      'Invalid data hashes length!'
    );
    require(
      newContainerHashes.length == elementsCount,
      'Invalid container hashes length!'
    );
    require(parents.length == elementsCount, 'Invalid parents length!');
    for (uint256 i = 0; i < elementsCount; i++) {
      Element elem = Element(elementImpl.clone());
      _addElement(elem);
      LibElement.HashBundle memory hashes = LibElement.HashBundle(
        newMetaHashes[i],
        newDataHashes[i],
        newContainerHashes[i]
      );
      LibElement.AddressBundle memory addresses = LibElement.AddressBundle(
        msg.sender,
        address(participantManager),
        parents[i],
        address(0),
        address(this)
      );
      elem.initialize(addresses, hashes, contentType);
    }
  }

  /// @notice Close and delete this bucket
  function closeBucket() external override onlyRole(LibParticipant.OWNER_ROLE) {
    address payable owner = payable(msg.sender);
    selfdestruct(owner);
  }

  /// @notice Get all elements
  function getAll()
    external
    view
    override
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
    returns (address[] memory)
  {
    return allElements;
  }

  /// @notice Get the history
  function getHistory()
    external
    view
    override
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
    returns (LibElement.Operation[] memory)
  {
    return history;
  }

  function redeemParticipationCode(
    string memory name,
    address inviter,
    bytes memory signature,
    string memory randomCode,
    bytes memory pubKey
  )
    external
    payable
    charge(IPaymentManager.PayableAction.ADD_PARTICIPANT)
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    _redeemParticipationCode(
      name,
      inviter,
      msg.sender,
      signature,
      randomCode,
      pubKey
    );
  }

  function removeParticipation(address participant)
    external
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    _removeParticipation(participant);
  }

  function _addElement(Element elem) internal {
    allElements.push(address(elem));
    registeredElements[address(elem)] = true;
    hashExists[elem.metaHash()] = true;
    hashExists[elem.dataHash()] = true;
    hashExists[elem.containerHash()] = true;
  }

  function _requireRegisteredElement() internal view {
    require(
      registeredElements[msg.sender],
      'Only callable from registered element!'
    );
  }

  modifier onlyRegisteredElement() {
    _requireRegisteredElement();
    _;
  }

  function notifyCreation(Element elem, address sender)
    external
    onlyRegisteredElement
  {
    history.push(
      LibElement.Operation(
        address(elem),
        LibElement.OperationType.ADD,
        block.number
      )
    );
    emit LibElement.Create(address(elem), block.number, sender);
  }

  function notifyUpdate(Element elem, address sender)
    external
    onlyRegisteredElement
    keyAvailable(block.number, sender)
    decreaseLimit(IPaymentManager.LimitedAction.ADD_DATA, 1)
  {
    _addElement(elem);
    history.push(
      LibElement.Operation(
        address(elem),
        LibElement.OperationType.UPDATE,
        block.number
      )
    );
    emit LibElement.Update(
      address(elem),
      elem.nextElement(),
      block.number,
      sender
    );
  }

  function notifyUpdateParent(Element elem, address sender)
    external
    onlyRegisteredElement
  {
    history.push(
      LibElement.Operation(
        address(elem),
        LibElement.OperationType.UPDATE_PARENT,
        block.number
      )
    );
    emit LibElement.UpdateParent(
      address(elem),
      elem.parentElement(),
      block.number,
      sender
    );
  }

  function notifyDelete(Element elem, address sender)
    external
    onlyRegisteredElement
  {
    hashExists[elem.metaHash()] = false;
    hashExists[elem.dataHash()] = false;
    hashExists[elem.containerHash()] = false;
    history.push(
      LibElement.Operation(
        address(elem),
        LibElement.OperationType.DELETE,
        block.number
      )
    );
    emit LibElement.Delete(address(elem), block.number, sender);
  }
}
