// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

library LibElement {
  string public constant ZERO_HASH =
    'QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH';
  string public constant EMPTY_HASH = '';
  uint256 public constant MAX_WORKLOAD = 50;

  enum OperationType {
    ADD,
    UPDATE,
    UPDATE_PARENT,
    DELETE
  }

  struct HashBundle {
    string meta;
    string data;
    string container;
  }

  struct AddressBundle {
    address creator;
    address participantManager;
    address parent;
    address previous;
    address bucket;
  }

  struct Operation {
    address elem;
    OperationType operationType;
    uint256 blockNumber;
  }

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

  event Request(
    address indexed _elem,
    address indexed requestor,
    uint256 indexed time
  );
}
