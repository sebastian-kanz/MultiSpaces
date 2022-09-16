// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "../Bucket.sol";

contract BucketFactory {
    function createBucket(address pManager, address partManager)
        external
        payable
        returns (IBucket)
    {
        Bucket child = (new Bucket){value: msg.value}(pManager, partManager);
        return child;
    }
}
