// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "./libraries/PubKeyChecker.sol";
import "./interfaces/IBucket.sol";
import "./interfaces/IBucketFactory.sol";
import "./interfaces/IPaymentManager.sol";
import "./libraries/LibParticipant.sol";
import "./adapters/PaymentAdapter.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract Space is PaymentAdapter, Initializable {
    using LibParticipant for *;
    using PubKeyChecker for address;

    LibParticipant.Participant public spaceOwner;
    IBucketFactory public bucketFactory;

    string[] public allBucketNames;
    mapping(string => BucketContainer) public allBuckets;

    struct BucketContainer {
        IBucket bucket;
        bool active;
        bool isExternal;
    }

    modifier onlySpaceOwner() {
        require(msg.sender == spaceOwner.adr, "Forbidden");
        _;
    }

    function initialize(
        address owner,
        string memory name,
        bytes memory pubKey,
        address bFactory,
        address pManager
    )
        public
        payable
        charge(IPaymentManager.PayableAction.CREATE_SPACE)
        initializer
    {
        _setPaymentManager(pManager);
        bucketFactory = IBucketFactory(bFactory);
        owner.validatePubKey(pubKey);
        spaceOwner = LibParticipant.Participant(owner, name, pubKey, true);
    }

    function _bucketActive(string memory name) private view {
        require(allBuckets[name].active, "Bucket inactive / unknown!");
    }

    modifier bucketActive(string memory name) {
        _bucketActive(name);
        _;
    }

    event Create(address indexed _addr, address _sender);

    event Remove(address indexed _addr, address _sender);

    event Rename(address indexed _addr, address _sender);

    function addBucket(
        string memory name
    )
        external
        payable
        onlySpaceOwner
        charge(IPaymentManager.PayableAction.ADD_BUCKET)
        returns (address)
    {
        require(!allBuckets[name].active, "Bucket already exists!");
        IBucket bucket = bucketFactory.createBucket(
            address(paymentManager),
            spaceOwner.name,
            spaceOwner.adr,
            spaceOwner.publicKey
        );
        allBuckets[name] = BucketContainer(bucket, true, false);
        allBucketNames.push(name);
        emit Create(address(bucket), msg.sender);
        return address(bucket);
    }

    // TODO: Test
    function addExternalBucket(
        string memory name,
        address adr
    ) external payable onlySpaceOwner returns (address) {
        require(!allBuckets[name].active, "Bucket already exists!");
        IBucket bucket = IBucket(adr);
        allBuckets[name] = BucketContainer(bucket, true, true);
        allBucketNames.push(name);
        emit Create(address(bucket), msg.sender);
        return address(bucket);
    }

    function removeBucket(
        string memory name
    ) external onlySpaceOwner bucketActive(name) {
        // TODO: Test
        if (!allBuckets[name].isExternal) {
            allBuckets[name].bucket.closeBucket();
        }
        _removeBucketNameFromList(name);
        address bucket = address(allBuckets[name].bucket);
        delete (allBuckets[name]);
        emit Remove(bucket, msg.sender);
    }

    function renameBucket(
        string memory name,
        string memory newBucketName
    ) external onlySpaceOwner bucketActive(name) {
        allBuckets[newBucketName] = BucketContainer(
            allBuckets[name].bucket,
            allBuckets[name].active,
            allBuckets[name].isExternal
        );
        allBucketNames.push(newBucketName);
        _removeBucketNameFromList(name);
        address bucket = address(allBuckets[name].bucket);
        delete (allBuckets[name]);
        emit Rename(bucket, msg.sender);
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

    function _removeBucketNameFromList(
        string memory name
    ) private bucketActive(name) {
        int256 foundIndex = -1;
        for (uint256 i = 0; i < allBucketNames.length; i++) {
            if (keccak256(bytes(allBucketNames[i])) == keccak256(bytes(name))) {
                foundIndex = int256(i);
            }
        }
        require(foundIndex >= 0, "Bucket unknown!");
        allBucketNames[uint256(foundIndex)] = allBucketNames[
            allBucketNames.length - 1
        ];
        allBucketNames.pop();
    }
}
