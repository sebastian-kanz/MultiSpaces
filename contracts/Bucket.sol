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
  LibElement.RedundancyLevel public minElementRedundancy;

  event Create(
    address indexed _elem,
    uint256 indexed _blockNumber,
    address indexed _sender
  );

  event Update(
    address indexed _prevElem,
    address indexed _newElemt,
    uint256 _blockNumber,
    address indexed _sender
  );

  event UpdateParent(
    address indexed _elem,
    address indexed _parent,
    uint256 _blockNumber,
    address indexed _sender
  );

  event Delete(
    address indexed _elem,
    uint256 _blockNumber,
    address indexed _sender
  );

  function initialize(
    address pManager,
    address partManager,
    address impl
  ) external initializer {
    _setPaymentManager(pManager);
    _setParticipantManager(partManager);
    elementImpl = impl;
    GENESIS = block.number;
    minElementRedundancy = LibElement.RedundancyLevel.SINGLE;
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
        address(this),
        elementImpl
      );
      registeredElements[address(elem)] = true;
      elem.initialize(addresses, hashes, contentType, minElementRedundancy);
      _addElement(elem);
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
  ) external payable charge(IPaymentManager.PayableAction.ADD_PARTICIPANT) {
    _redeemParticipationCode(
      name,
      inviter,
      msg.sender,
      signature,
      randomCode,
      pubKey
    );
  }

  function removeParticipation()
    external
    onlyRole(LibParticipant.PARTICIPANT_ROLE)
  {
    require(participantCount() > 1, 'Last participant. Use close instead.');
    _removeParticipation(msg.sender);
  }

  function _addElement(Element elem) internal virtual {
    allElements.push(address(elem));
    registeredElements[address(elem)] = true;
    hashExists[elem.metaHash()] = true;
    hashExists[elem.dataHash()] = true;
    hashExists[elem.containerHash()] = true;
  }

  function _requireRegisteredElement() internal view {
    require(
      registeredElements[msg.sender],
      // 'Only callable from registered element!'
      string(
        abi.encodePacked(
          'Only callable from registered element! Invalid sender: ',
          Strings.toHexString(uint160(msg.sender), 20)
        )
      )
    );
  }

  modifier onlyRegisteredElement() {
    _requireRegisteredElement();
    _;
  }

  function notifyCreation(address sender) external onlyRegisteredElement {
    history.push(
      LibElement.Operation(
        msg.sender,
        LibElement.OperationType.ADD,
        block.number
      )
    );
    emit Create(msg.sender, block.number, sender);
  }

  function preRegisterElement(Element elem) external onlyRegisteredElement {
    registeredElements[address(elem)] = true;
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
    emit Update(msg.sender, address(elem), block.number, sender);
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
    emit UpdateParent(
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
    emit Delete(address(elem), block.number, sender);
  }

  function setElementImplementation(address impl)
    external
    onlyRole(LibParticipant.OWNER_ROLE)
  {
    elementImpl = impl;
  }

  function setMinElementRedundancy(LibElement.RedundancyLevel level)
    external
    onlyRole(LibParticipant.OWNER_ROLE)
  {
    minElementRedundancy = level;
  }
}
