// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IBucket.sol";
import "./adapters/PaymentAdapter.sol";
import "./adapters/ParticipantManagerAdapter.sol";
import "./KeyManager.sol";
import "./ParticipantInteractor.sol";

contract Bucket is
    IBucket,
    KeyManager,
    PaymentAdapter,
    ParticipantManagerAdapter,
    ParticipantInteractor
{
    string public constant ZERO_HASH =
        "QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH";
    string public constant EMPTY_HASH = "";

    Element[] public allElements; // Contains all hashes ever saved to this bucket
    mapping(string => string) public oldToNewVersions; // old version points to new version (hashes) -> possibility to go forwards in history
    mapping(string => string) public newToOldVersions; // new version points to old version (hashes) -> possibility to go backwards in history
    mapping(string => string) public parent; // child points to parent (hashes) -> possibility to reproduce hierarchy
    mapping(string => string[]) public children; // parent points to children (hashes) -> possibility to reproduce hierarchy

    Operation[] public history; // Contains all changes ever made to any existing hash in this bucket. (Must be read-only)
    mapping(string => bool) public elementExists; // quick index search if an Element (hash) already exists

    uint256 private maxWorkload = 50;

    constructor(address pManager, address partManager)
        payable
        KeyManager()
        PaymentAdapter(pManager)
        ParticipantManagerAdapter(partManager)
        charge(IPaymentManager.PayableAction.ADD_BUCKET)
    {}

    function addKeys(string[] memory newHashes, address[] memory participants)
        external
        onlyRole(ParticipantInteractor.PARTICIPANT_ROLE)
    {
        require(newHashes.length == participantCount(), "Invalid input");
        require(participants.length == participantCount(), "Invalid input");
        _addKeys(newHashes, participants);
    }

    function setKeyForParticipant(
        string memory keyHash,
        address participant,
        uint256 blockNumber
    ) external onlyRole(ParticipantInteractor.PARTICIPANT_ROLE) {
        _setKeyForParticipant(keyHash, participant, blockNumber);
    }

    // @notice Create multiple elements at once
    // @param elements List of elements to create
    function createElements(
        string[] memory newMetaHashes,
        string[] memory newDataHashes,
        string[] memory newContainerHashes,
        string[] memory parentContainerHashes,
        ContentType contentType
    )
        external
        payable
        override
        onlyRole(ParticipantInteractor.PARTICIPANT_ROLE)
        decreaseLimit(
            IPaymentManager.LimitedAction.ADD_DATA,
            newMetaHashes.length
        )
        keyAvailable(block.number, msg.sender)
    {
        uint256 elementsCount = newMetaHashes.length;
        require(elementsCount <= maxWorkload, "Workload to high!");
        require(
            newDataHashes.length == elementsCount,
            "Invalid data hashes length!"
        );
        require(
            newContainerHashes.length == elementsCount,
            "Invalid container hashes length!"
        );
        require(
            parentContainerHashes.length == elementsCount,
            "Invalid parent hashes length!"
        );
        for (uint256 i = 0; i < elementsCount; i++) {
            _createElement(
                newMetaHashes[i],
                newDataHashes[i],
                newContainerHashes[i],
                parentContainerHashes[i],
                contentType
            );
        }
    }

    /// @notice Update multiple elements at once
    function updateElements(
        string[] memory prevMetaHashes,
        string[] memory newMetaHashes,
        string[] memory prevDataHashes,
        string[] memory newDataHashes,
        string[] memory prevContainerHashes,
        string[] memory newContainerHashes,
        string[] memory parentContainerHashes,
        ContentType contentType
    )
        external
        payable
        override
        onlyRole(ParticipantInteractor.PARTICIPANT_ROLE)
        decreaseLimit(
            IPaymentManager.LimitedAction.ADD_DATA,
            newMetaHashes.length
        )
        keyAvailable(block.number, msg.sender)
    {
        uint256 elementsCount = prevMetaHashes.length;
        require(elementsCount <= maxWorkload, "Workload to high!");
        require(
            newMetaHashes.length == elementsCount,
            "Invalid new meta hashes length!"
        );
        require(
            prevDataHashes.length == elementsCount,
            "Invalid prev data hashes length!"
        );
        require(
            newDataHashes.length == elementsCount,
            "Invalid new data hashes length!"
        );
        require(
            prevContainerHashes.length == elementsCount,
            "Invalid prev container hashes length!"
        );
        require(
            newContainerHashes.length == elementsCount,
            "Invalid new container hashes length!"
        );
        require(
            parentContainerHashes.length == elementsCount,
            "Invalid parent hashes length!"
        );
        for (uint256 i = 0; i < elementsCount; i++) {
            _updateElement(
                prevMetaHashes[i],
                newMetaHashes[i],
                prevDataHashes[i],
                newDataHashes[i],
                prevContainerHashes[i],
                newContainerHashes[i],
                parentContainerHashes[i],
                contentType
            );
        }
    }

    function removeElements(
        string[] memory metaHashes,
        string[] memory dataHashes,
        string[] memory containerHashes
    ) external override onlyRole(ParticipantInteractor.EDITOR_ROLE) {
        uint256 elementsCount = metaHashes.length;
        require(elementsCount <= maxWorkload, "Workload to high!");
        for (uint256 i = 0; i < elementsCount; i++) {
            _removeElement(metaHashes[i], dataHashes[i], containerHashes[i]);
        }
    }

    /// @notice Creates single element
    /// @param newMetaHash IPFS hash of the newly added meta element
    /// @param newDataHash IPFS hash of the newly added data element
    /// @param newContainerHash IPFS hash of the newly added container element
    /// @param parentContainerHash IPFS hash of the newly added parent element. Might be empty
    /// @param contentType Type of the content behind the hashes
    function _createElement(
        string memory newMetaHash,
        string memory newDataHash,
        string memory newContainerHash,
        string memory parentContainerHash,
        ContentType contentType
    ) internal {
        _checkExistance(newMetaHash, "meta", false);
        _checkExistance(newDataHash, "data", false);
        _checkExistance(newContainerHash, "container", false);
        if (keccak256(bytes(parentContainerHash)) != keccak256(bytes(""))) {
            _checkExistance(parentContainerHash, "parent", true);
        }

        uint256 index = history.length;
        _addElement(newMetaHash, contentType, ElementType.META, index);
        _addElement(newDataHash, contentType, ElementType.DATA, index);
        _addElement(
            newContainerHash,
            contentType,
            ElementType.CONTAINER,
            index
        );

        history.push(
            Operation(
                EMPTY_HASH,
                newMetaHash,
                EMPTY_HASH,
                newDataHash,
                EMPTY_HASH,
                newContainerHash,
                parentContainerHash,
                OperationType.ADD,
                block.number
            )
        );

        parent[newMetaHash] = newContainerHash;
        parent[newDataHash] = newContainerHash;
        parent[newContainerHash] = parentContainerHash;
        children[newContainerHash].push(newMetaHash);
        children[newContainerHash].push(newDataHash);
        if (keccak256(bytes(parentContainerHash)) != keccak256(bytes(""))) {
            children[parentContainerHash].push(newContainerHash);
        }
        emit Create(newDataHash, block.number, msg.sender);
    }

    /// @notice Updates single element
    /// @param prevMetaHash IPFS hash of the previous meta element
    /// @param newMetaHash IPFS hash of the newly added meta element
    /// @param prevDataHash IPFS hash of the previous data element
    /// @param newDataHash IPFS hash of the newly added data element
    /// @param prevContainerHash IPFS hash of the previous container element
    /// @param newContainerHash IPFS hash of the newly added container element
    /// @param parentContainerHash IPFS hash of the newly added parent element. Might be empty
    /// @param contentType Type of the content behind the hashes
    function _updateElement(
        string memory prevMetaHash,
        string memory newMetaHash,
        string memory prevDataHash,
        string memory newDataHash,
        string memory prevContainerHash,
        string memory newContainerHash,
        string memory parentContainerHash,
        ContentType contentType
    ) internal {
        _checkExistance(prevMetaHash, "meta", true);
        _checkExistance(prevDataHash, "data", true);
        _checkExistance(prevContainerHash, "container", true);

        if (keccak256(bytes(parentContainerHash)) != keccak256(bytes(""))) {
            _checkExistance(parentContainerHash, "parent", true);
        }

        _checkVersioning(prevMetaHash, newMetaHash);
        _checkVersioning(prevDataHash, newDataHash);
        _checkVersioning(prevContainerHash, newContainerHash);

        _checkParent(prevMetaHash, prevContainerHash, "meta");
        _checkParent(prevDataHash, prevContainerHash, "data");
        _checkEqualParent(prevMetaHash, prevDataHash);

        uint256 index = history.length + 1;
        if (keccak256(bytes(newMetaHash)) != keccak256(bytes(prevMetaHash))) {
            _addElement(newMetaHash, contentType, ElementType.META, index);
            _updateVersioning(prevMetaHash, newMetaHash);
            parent[newMetaHash] = newContainerHash;
        }

        if (keccak256(bytes(newDataHash)) != keccak256(bytes(prevDataHash))) {
            _addElement(newDataHash, contentType, ElementType.DATA, index);
            _updateVersioning(prevDataHash, newDataHash);
            parent[newDataHash] = newContainerHash;
        }

        if (
            keccak256(bytes(newContainerHash)) !=
            keccak256(bytes(prevContainerHash))
        ) {
            _addElement(
                newContainerHash,
                contentType,
                ElementType.CONTAINER,
                index
            );
            _updateVersioning(prevContainerHash, newContainerHash);
        }

        history.push(
            Operation(
                prevMetaHash,
                newMetaHash,
                prevDataHash,
                newDataHash,
                prevContainerHash,
                newContainerHash,
                parentContainerHash,
                OperationType.EDIT,
                block.number
            )
        );

        parent[newContainerHash] = parentContainerHash;
        children[newContainerHash].push(newMetaHash);
        children[newContainerHash].push(newDataHash);
        if (keccak256(bytes(parentContainerHash)) != keccak256(bytes(""))) {
            children[parentContainerHash].push(newContainerHash);
        }
        emit Update(prevDataHash, newDataHash, block.number, msg.sender);
    }

    /// @notice Removes a single element
    /// @param metaHash IPFS hash of the meta element to delete
    /// @param dataHash IPFS hash of the data element to delete
    /// @param containerHash IPFS hash of the container element to delete
    function _removeElement(
        string memory metaHash,
        string memory dataHash,
        string memory containerHash
    ) internal {
        require(elementExists[metaHash], "Element (meta) not found!");
        require(elementExists[dataHash], "Element (data) not found!");
        require(elementExists[containerHash], "Element (container) not found!");

        require(
            keccak256(bytes(oldToNewVersions[metaHash])) ==
                keccak256(bytes("")),
            "Newer (meta) version exists!"
        );
        require(
            keccak256(bytes(oldToNewVersions[dataHash])) ==
                keccak256(bytes("")),
            "Newer (data) version exists!"
        );
        require(
            keccak256(bytes(oldToNewVersions[containerHash])) ==
                keccak256(bytes("")),
            "Newer (container) version exists!"
        );

        _checkParent(metaHash, containerHash, "meta");
        _checkParent(dataHash, containerHash, "data");
        _checkEqualParent(metaHash, dataHash);

        _updateVersioning(metaHash, ZERO_HASH);
        _updateVersioning(dataHash, ZERO_HASH);
        _updateVersioning(containerHash, ZERO_HASH);

        history.push(
            Operation(
                metaHash,
                ZERO_HASH,
                dataHash,
                ZERO_HASH,
                containerHash,
                ZERO_HASH,
                EMPTY_HASH,
                OperationType.DELETE,
                block.number
            )
        );
        emit Delete(dataHash, msg.sender);
    }

    function _checkVersioning(
        string memory oldVersion,
        string memory newVersion
    ) private view {
        require(
            keccak256(bytes(oldToNewVersions[oldVersion])) ==
                keccak256(bytes("")),
            "Old version already has an update!"
        );
        require(
            keccak256(bytes(newToOldVersions[newVersion])) ==
                keccak256(bytes("")),
            "New version already has an older version!"
        );
    }

    function _checkParent(
        string memory childHash,
        string memory parentHash,
        string memory name
    ) private view {
        require(
            keccak256(bytes(parent[childHash])) == keccak256(bytes(parentHash)),
            string.concat(
                "Element (",
                name,
                ") is not child of ",
                parentHash,
                "!"
            )
        );
    }

    function _checkEqualParent(
        string memory firstChildHash,
        string memory secondChildHash
    ) private view {
        require(
            keccak256(bytes(parent[firstChildHash])) ==
                keccak256(bytes(parent[secondChildHash])),
            "Elements parent mismatches"
        );
    }

    function _updateVersioning(
        string memory oldVersion,
        string memory newVersion
    ) private {
        oldToNewVersions[oldVersion] = newVersion;
        newToOldVersions[newVersion] = oldVersion;
    }

    function _checkExistance(
        string memory hash,
        string memory name,
        bool shouldExist
    ) private view {
        if (shouldExist) {
            require(
                elementExists[hash],
                string.concat("Element (", name, ") not found!")
            );
        } else {
            require(
                !elementExists[hash],
                string.concat("Element (", name, ") already exists!")
            );
        }
    }

    function _addElement(
        string memory newHash,
        ContentType cType,
        ElementType eType,
        uint256 index
    ) private {
        allElements.push(Element(newHash, cType, eType, index));
        elementExists[newHash] = true;
    }

    /// @notice Close and delete this bucket
    function closeBucket()
        external
        override
        onlyRole(ParticipantInteractor.OWNER_ROLE)
    {
        address payable owner = payable(msg.sender);
        selfdestruct(owner);
    }

    /// @notice Get all elements
    function getAll()
        external
        view
        override
        onlyRole(ParticipantInteractor.PARTICIPANT_ROLE)
        returns (Element[] memory)
    {
        return allElements;
    }

    /// @notice Get the history
    function getHistory()
        external
        view
        override
        onlyRole(ParticipantInteractor.PARTICIPANT_ROLE)
        returns (Operation[] memory)
    {
        return history;
    }
}
