// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "../Bucket.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "../ParticipantManager.sol";
import "./ParticipantManagerFactory.sol";
import "../interfaces/IBucketFactory.sol";

contract BucketFactory is Ownable, IBucketFactory {
    using Clones for address;
    address bucketImplementation;
    address elementImplementation;
    IParticipantManagerFactory participantManagerFactory;
    mapping(address => bool) registeredSpaces;

    constructor(address bucket, address element, address partManagerFactory) {
        bucketImplementation = bucket;
        elementImplementation = element;
        participantManagerFactory = IParticipantManagerFactory(
            partManagerFactory
        );
    }

    function setBucketImplementation(address impl) public onlyOwner {
        bucketImplementation = impl;
    }

    function setElementImplementation(address impl) public onlyOwner {
        elementImplementation = impl;
    }

    function setParticipantManagerFactory(address impl) public onlyOwner {
        participantManagerFactory = IParticipantManagerFactory(impl);
    }

    function createBucket(
        address pManager,
        string memory name,
        address adr,
        bytes memory publicKey
    ) external override returns (IBucket) {
        require(
            registeredSpaces[msg.sender],
            "Only registered spaces allowed!"
        );
        IParticipantManager partManager = participantManagerFactory
            .createParticipantManager(
                address(pManager),
                name,
                adr,
                publicKey,
                address(this),
                msg.sender
            );
        IBucket newBucket = IBucket(bucketImplementation.clone());
        newBucket.initialize(
            pManager,
            address(partManager),
            elementImplementation
        );
        partManager.grantRole(0x00, address(newBucket));
        return newBucket;
    }

    function registerSpace(address space) external onlyOwner {
        registeredSpaces[space] = true;
    }

    function unregisterSpace(address space) external onlyOwner {
        registeredSpaces[space] = false;
    }
}
