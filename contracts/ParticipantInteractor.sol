// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

abstract contract ParticipantInteractor {
    struct Participant {
        address adr;
        string name;
        bytes publicKey;
        bool initialized;
    }

    bytes32 public constant PARTICIPANT_ROLE = keccak256("PARTICIPANT");
    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER");
    bytes32 public constant OWNER_ROLE = keccak256("OWNER");
    bytes32[4] public ALL_ROLES = [
        PARTICIPANT_ROLE,
        EDITOR_ROLE,
        MANAGER_ROLE,
        OWNER_ROLE
    ];
}
