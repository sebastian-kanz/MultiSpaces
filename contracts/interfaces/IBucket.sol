// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import '../libraries/LibElement.sol';

interface IBucket {
  function initialize(
    address pManager,
    address partManager,
    address impl
  ) external;

  function createElements(
    string[] memory newMetaHashes,
    string[] memory newDataHashes,
    string[] memory newContainerHashes,
    address[] memory parentContainerHashes,
    uint256 contentType
  ) external;

  function closeBucket() external;

  function getAll() external view returns (address[] memory);

  function getHistory() external view returns (LibElement.Operation[] memory);
}
