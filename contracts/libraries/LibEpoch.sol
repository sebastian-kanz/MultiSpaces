// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

library LibEpoch {
    function currentEpoch(
        uint256 genesis,
        uint256 epochLength
    ) internal view returns (uint256) {
        return (block.number - genesis) / epochLength;
    }

    function epochAt(
        uint256 blockNumber,
        uint256 genesis,
        uint256 epochLength
    ) internal pure returns (uint256) {
        require(blockNumber >= genesis, "Block number before genesis.");
        return (blockNumber - genesis) / epochLength;
    }
}
