// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

library InvitationChecker {
    /// @notice Validates if the invitation signature is valid
    /// @param signature Signature to validate
    /// @param inviter Address of the inviter
    /// @param randomCode Code in clear text to verify signature for
    function isValidInvitation(
        bytes memory signature,
        address inviter,
        string memory randomCode
    ) external view returns (bool, bytes32) {
        bytes32 hash = keccak256(abi.encodePacked(randomCode));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );

        return (
            SignatureChecker.isValidSignatureNow(
                inviter,
                ethSignedMessageHash,
                signature
            ),
            hash
        );
    }
}
