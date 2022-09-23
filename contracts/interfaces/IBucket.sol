// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IBucket {
  enum OperationType {
    ADD,
    EDIT,
    DELETE
  }

  enum ContentType {
    FILE
  }

  enum ElementType {
    META,
    DATA,
    CONTAINER
  }

  struct Operation {
    string prevMetaHash;
    string newMetaHash;
    string prevDataHash;
    string newDataHash;
    string prevContainerHash;
    string newContainerHash;
    string parentContainerHash;
    OperationType operationType;
    uint256 blockNumber;
  }

  // All hashes are encapsulated in Elements
  struct Element {
    string hash;
    ContentType contentType; // What kind of content belongs this hash to?
    ElementType elementType; // What kind of element represents the hash?
    uint256 operationIndex; // Where to find more information about the element?
  }

  event Create(
    string indexed _newDataHash,
    uint256 indexed _blockNumber,
    address indexed _sender
  );

  event Update(
    string indexed _previousDataHash,
    string indexed _newDataHash,
    uint256 _blockNumber,
    address indexed _sender
  );

  event Delete(string indexed _dataHash, address indexed _sender);

  function createElements(
    string[] memory newMetaHashes,
    string[] memory newDataHashes,
    string[] memory newContainerHashes,
    string[] memory parentContainerHashes,
    ContentType contentType
  ) external payable;

  function updateElements(
    string[] memory prevMetaHashes,
    string[] memory newMetaHashes,
    string[] memory prevDataHashes,
    string[] memory newDataHashes,
    string[] memory prevContainerHashes,
    string[] memory newContainerHashes,
    string[] memory parentContainerHashes,
    ContentType contentType
  ) external payable;

  function removeElements(
    string[] memory metaHashes,
    string[] memory dataHashes,
    string[] memory containerHashes
  ) external;

  function closeBucket() external;

  function getAll() external view returns (Element[] memory);

  function getHistory() external view returns (Operation[] memory);
}
