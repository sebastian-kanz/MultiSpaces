// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

library CreditChecker {
    /// @notice Validates if the invitation signature is valid
    /// @param signature Signature to validate
    /// @param creditor Address of the creditor
    /// @param credit Amount to credit
    /// @param random A random value to ensure uniqueness for this credit
    function isValidCredit(
        bytes memory signature,
        address creditor,
        uint256 credit,
        string memory random
    ) external view returns (bool, bytes32) {
        bytes32 hash = keccak256(abi.encodePacked(credit, random));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );

        return (
            SignatureChecker.isValidSignatureNow(
                creditor,
                ethSignedMessageHash,
                signature
            ),
            hash
        );
    }
}
