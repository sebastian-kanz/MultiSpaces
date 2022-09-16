// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "@openzeppelin/contracts/utils/Strings.sol";

library PubKeyChecker {
    /// @notice Validates that a provided public keys belongs to an address
    /// @param adr address of the account
    /// @param pubKey public key of the account
    function validatePubKey(address adr, bytes memory pubKey) external pure {
        require(pubKey.length == 64, "Invalid key length. Remove leading 04");
        address sender = address(uint160(uint256(keccak256(pubKey))));
        require(
            sender == adr,
            string(
                abi.encodePacked(
                    "PubKeyChecker: account ",
                    Strings.toHexString(uint160(adr), 20),
                    " does not match pubKey"
                )
            )
        );
    }
}
