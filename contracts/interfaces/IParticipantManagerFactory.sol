// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "../interfaces/IParticipantManager.sol";

interface IParticipantManagerFactory {
    function createParticipantManager(
        address pManager,
        string memory name,
        address adr,
        bytes memory publicKey,
        address bucketFactory,
        address space
    ) external returns (IParticipantManager);
}
