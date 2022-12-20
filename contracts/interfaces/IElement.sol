// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "../libraries/LibElement.sol";

interface IElement {
    event Request(
        address indexed _elem,
        address indexed requestor,
        uint256 indexed time
    );

    function update(LibElement.HashBundle memory hashes, address parent)
        external;

    function remove() external;

    function setParent(address parent) external;

    function requestData() external;

    function announceHolding() external;

    function announceRemoval() external;

    function setRedundancyLevel(LibElement.RedundancyLevel level) external;
}
