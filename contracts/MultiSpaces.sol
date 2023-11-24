// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "./Space.sol";
import "./PaymentManager.sol";
import "./factories/BucketFactory.sol";
import "./factories/ParticipantManagerFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

contract MultiSpaces is Ownable {
    using Clones for address;
    address private spaceImplementation;
    address[] public spaces;
    mapping(bytes => address) public ownedSpaces;
    uint256 public constant BASE_FEE = 1000000000000000;
    uint256 public constant BASE_LIMIT = 100;
    uint256 public constant LIMIT_PRICE = 1000000000000;
    PaymentManager public paymentManager;
    BucketFactory public bucketFactory;
    ParticipantManagerFactory public participantManagerFactory;

    constructor(
        BucketFactory bfactory,
        ParticipantManagerFactory pFactory,
        address impl
    ) {
        paymentManager = new PaymentManager(BASE_FEE, BASE_LIMIT, LIMIT_PRICE);
        paymentManager.transferOwnership(owner());
        bucketFactory = bfactory;
        participantManagerFactory = pFactory;
        spaceImplementation = impl;
    }

    function createSpace(
        string memory participantName,
        bytes memory pubKey
    ) public payable returns (address) {
        if (ownedSpaces[pubKey] == address(0)) {
            Space space = Space(spaceImplementation.clone());
            space.initialize{value: msg.value}(
                msg.sender,
                participantName,
                pubKey,
                address(bucketFactory),
                address(paymentManager)
            );
            spaces.push(address(space));
            ownedSpaces[pubKey] = address(space);

            bucketFactory.registerSpace(address(space));
            participantManagerFactory.registerBucketFactory(
                address(bucketFactory)
            );
            return address(space);
        }
        return ownedSpaces[pubKey];
    }

    fallback() external payable {
        _sendToPaymentManager();
    }

    receive() external payable {
        _sendToPaymentManager();
    }

    function _sendToPaymentManager() private {
        paymentManager.increaseCredits{value: msg.value}(msg.sender);
    }

    function setBucketImplementation(address impl) public onlyOwner {
        bucketFactory.setBucketImplementation(impl);
    }

    function setElementImplementation(address impl) public onlyOwner {
        bucketFactory.setElementImplementation(impl);
    }

    function setParticipantManagerImplementation(
        address impl
    ) public onlyOwner {
        participantManagerFactory.setParticipantManagerImplementation(impl);
    }

    function setPaymentManager(address payable impl) public onlyOwner {
        paymentManager = PaymentManager(impl);
    }
}
