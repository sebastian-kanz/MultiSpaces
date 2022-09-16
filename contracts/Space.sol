// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "./libraries/PubKeyChecker.sol";
import "./interfaces/IBucket.sol";
import "./interfaces/IBucketFactory.sol";
import "./interfaces/IPaymentManager.sol";
import "./ParticipantInteractor.sol";
import "./ParticipantManager.sol";
import "./adapters/PaymentAdapter.sol";

contract Space is PaymentAdapter, ParticipantInteractor {
    using PubKeyChecker for address;

    Participant public spaceOwner;
    IBucketFactory public bucketFactory;

    string[] public allBucketNames;
    mapping(string => BucketContainer) public allBuckets;

    struct BucketContainer {
        IBucket bucket;
        bool active;
    }

    modifier onlySpaceOwner() {
        require(msg.sender == spaceOwner.adr, "Forbidden");
        _;
    }

    constructor(
        string memory name,
        bytes memory pubKey,
        address bFactory,
        address pManager
    )
        payable
        PaymentAdapter(pManager)
        charge(IPaymentManager.PayableAction.CREATE_SPACE)
    {
        bucketFactory = IBucketFactory(bFactory);
        tx.origin.validatePubKey(pubKey);
        spaceOwner = Participant(tx.origin, name, pubKey, true);
    }

    function _bucketActive(string memory name) private view {
        require(
            allBuckets[name].active,
            "Bucket is not active or does not exist!"
        );
    }

    modifier bucketActive(string memory name) {
        _bucketActive(name);
        _;
    }

    event Create(
        string indexed _name,
        address indexed _addr,
        address indexed _sender
    );

    event Remove(string indexed _name, address indexed _sender);

    event Rename(
        string indexed _name,
        string indexed _newName,
        address indexed _sender
    );

    function addBucket(string memory name)
        external
        payable
        onlySpaceOwner
        returns (address)
    {
        require(!allBuckets[name].active, "Bucket already exists!");
        IBucket bucket = bucketFactory.createBucket{value: msg.value}(
            address(paymentManager),
            address(
                new ParticipantManager(
                    spaceOwner.name,
                    spaceOwner.adr,
                    spaceOwner.publicKey,
                    address(paymentManager)
                )
            )
        );
        allBuckets[name] = BucketContainer(bucket, true);
        allBucketNames.push(name);
        emit Create(name, address(bucket), msg.sender);
        return address(bucket);
    }

    function removeBucket(string memory name)
        external
        onlySpaceOwner
        bucketActive(name)
    {
        allBuckets[name].bucket.closeBucket();
        _removeBucketNameFromList(name);
        delete (allBuckets[name]);
        emit Remove(name, msg.sender);
    }

    function renameBucket(string memory name, string memory newBucketName)
        external
        onlySpaceOwner
        bucketActive(name)
    {
        allBuckets[newBucketName] = BucketContainer(
            allBuckets[name].bucket,
            allBuckets[name].active
        );
        allBucketNames.push(newBucketName);
        _removeBucketNameFromList(name);
        delete (allBuckets[name]);
        emit Rename(name, newBucketName, msg.sender);
    }

    function addElementsToBucket(
        string memory name,
        string[] memory newMetaHashes,
        string[] memory newDataHashes,
        string[] memory newContainerHashes,
        string[] memory parentContainerHashes,
        IBucket.ContentType contentType
    ) external payable bucketActive(name) {
        allBuckets[name].bucket.createElements(
            newMetaHashes,
            newDataHashes,
            newContainerHashes,
            parentContainerHashes,
            contentType
        );
    }

    function updateElementsInBucket(
        string memory name,
        string[] memory prevMetaHashes,
        string[] memory newMetaHashes,
        string[] memory prevDataHashes,
        string[] memory newDataHashes,
        string[] memory prevContainerHashes,
        string[] memory newContainerHashes,
        string[] memory parentContainerHashes,
        IBucket.ContentType contentType
    ) external payable bucketActive(name) {
        allBuckets[name].bucket.updateElements(
            prevMetaHashes,
            newMetaHashes,
            prevDataHashes,
            newDataHashes,
            prevContainerHashes,
            newContainerHashes,
            parentContainerHashes,
            contentType
        );
    }

    function removeElementsFromBucket(
        string memory name,
        string[] memory metaHashes,
        string[] memory dataHashes,
        string[] memory containerHashes
    ) external bucketActive(name) {
        allBuckets[name].bucket.removeElements(
            metaHashes,
            dataHashes,
            containerHashes
        );
    }

    function getAllElementsFromBucket(string memory name)
        external
        view
        bucketActive(name)
        returns (IBucket.Element[] memory)
    {
        return allBuckets[name].bucket.getAll();
    }

    function getAllBuckets() external view returns (BucketContainer[] memory) {
        BucketContainer[] memory result = new BucketContainer[](
            allBucketNames.length
        );
        for (uint256 i = 0; i < allBucketNames.length; i++) {
            result[i] = allBuckets[allBucketNames[i]];
        }
        return result;
    }

    function _removeBucketNameFromList(string memory name)
        private
        bucketActive(name)
    {
        int256 foundIndex = -1;
        for (uint256 i = 0; i < allBucketNames.length; i++) {
            if (keccak256(bytes(allBucketNames[i])) == keccak256(bytes(name))) {
                foundIndex = int256(i);
            }
        }
        require(foundIndex >= 0, "Bucket does not exist!");
        allBucketNames[uint256(foundIndex)] = allBucketNames[
            allBucketNames.length - 1
        ];
        allBucketNames.pop();
    }
}
