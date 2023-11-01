// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "../Bucket.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../interfaces/IParticipantManager.sol";
import "../ParticipantManager.sol";
import "../interfaces/IParticipantManagerFactory.sol";

contract ParticipantManagerFactory is Ownable, IParticipantManagerFactory {
    using Clones for address;
    address participantManagerImplementation;
    mapping(address => bool) registeredBucketFactories;

    constructor(address participantManager) {
        participantManagerImplementation = participantManager;
    }

    function setParticipantManagerImplementation(
        address impl
    ) public onlyOwner {
        participantManagerImplementation = impl;
    }

    function createParticipantManager(
        address pManager,
        string memory name,
        address adr,
        bytes memory publicKey,
        address bucketFactory,
        address space
    ) external override returns (IParticipantManager) {
        require(
            registeredBucketFactories[msg.sender],
            "Only registered bucket factories allowed!"
        );
        ParticipantManager newPartManager = ParticipantManager(
            participantManagerImplementation.clone()
        );
        newPartManager.initialize(name, adr, publicKey, address(pManager));
        newPartManager.grantRole(0x00, bucketFactory);
        newPartManager.grantRole(0x00, space);
        newPartManager.grantRole(LibParticipant.OWNER_ROLE, space);
        return newPartManager;
    }

    function registerBucketFactory(address space) external onlyOwner {
        registeredBucketFactories[space] = true;
    }

    function unregisterBucketFactory(address space) external onlyOwner {
        registeredBucketFactories[space] = false;
    }
}
