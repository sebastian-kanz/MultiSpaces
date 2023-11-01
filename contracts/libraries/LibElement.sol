// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

library LibElement {
    uint256 public constant MAX_WORKLOAD = 50;

    enum OperationType {
        ADD,
        UPDATE,
        UPDATE_PARENT,
        DELETE
    }

    enum RedundancyLevel {
        NONE,
        SINGLE,
        MULTI,
        CRITICAL
    }

    event RedundancyLevelChanged(
        address indexed _elem,
        uint256 indexed _oldLevel,
        uint256 indexed _newLevel
    );

    event HoldersCountChanged(
        address indexed _elem,
        uint256 indexed _holdersCount
    );

    struct HashBundle {
        string meta;
        string data;
        string container;
    }

    struct AddressBundle {
        address creator;
        address participantManager;
        address parent;
        address previous;
        address bucket;
        address elemImpl;
    }

    struct Operation {
        address elem;
        OperationType operationType;
        uint256 blockNumber;
    }
}
