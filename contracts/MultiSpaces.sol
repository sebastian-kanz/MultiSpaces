// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "./Space.sol";
import "./PaymentManager.sol";
import "./factories/BucketFactory.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MultiSpaces is Ownable {
    address[] public spaces;
    mapping(bytes => address) public ownedSpaces;
    uint256 public baseFee = 1000000000000000;
    uint256 public baseLimit = 100;
    PaymentManager public paymentManager;
    BucketFactory public bucketFactory;

    constructor() {
        paymentManager = new PaymentManager(baseFee, baseLimit);
        paymentManager.transferOwnership(owner());
        bucketFactory = new BucketFactory();
    }

    function createSpace(string memory participantName, bytes memory pubKey)
        public
        payable
        returns (address)
    {
        if (ownedSpaces[pubKey] == address(0)) {
            Space space = (new Space){value: msg.value}(
                participantName,
                pubKey,
                address(bucketFactory),
                address(paymentManager)
            );
            spaces.push(address(space));
            ownedSpaces[pubKey] = address(space);
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
        address payable adr = payable(paymentManager);
        (bool sent, ) = adr.call{value: msg.value}("");
        require(sent, "Failed to send to payment manager!");
    }
}
