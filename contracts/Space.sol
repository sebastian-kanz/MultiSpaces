// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import './libraries/PubKeyChecker.sol';
import './interfaces/IBucket.sol';
import './interfaces/IBucketFactory.sol';
import './interfaces/IPaymentManager.sol';
import './libraries/LibParticipant.sol';
import './ParticipantManager.sol';
import './adapters/PaymentAdapter.sol';
import '@openzeppelin/contracts/proxy/utils/Initializable.sol';

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
  }

  modifier onlySpaceOwner() {
    require(msg.sender == spaceOwner.adr, 'Forbidden');
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
    require(allBuckets[name].active, 'Bucket is not active or does not exist!');
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
    charge(IPaymentManager.PayableAction.ADD_BUCKET)
    returns (address)
  {
    require(!allBuckets[name].active, 'Bucket already exists!');
    ParticipantManager partManager = new ParticipantManager(
      spaceOwner.name,
      spaceOwner.adr,
      spaceOwner.publicKey,
      address(paymentManager)
    );
    IBucket bucket = bucketFactory.createBucket(
      address(paymentManager),
      address(partManager)
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
    require(foundIndex >= 0, 'Bucket does not exist!');
    allBucketNames[uint256(foundIndex)] = allBucketNames[
      allBucketNames.length - 1
    ];
    allBucketNames.pop();
  }
}
