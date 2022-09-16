// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "../interfaces/IBucket.sol";

interface IBucketFactory {
    function createBucket(address pManager, address partManager)
        external
        payable
        returns (IBucket);
}
