// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

library LibParticipant {
    struct Participant {
        address adr;
        string name;
        bytes publicKey;
        bool initialized;
    }

    struct Request {
        address requestor;
        address device;
        address acceptor;
        bool accepted;
    }

    bytes32 public constant REQUESTOR_ROLE = keccak256("REQUESTOR");
    bytes32 public constant PARTICIPANT_ROLE = keccak256("PARTICIPANT");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER");
}
