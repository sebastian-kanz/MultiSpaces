// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "./interfaces/IBucket.sol";
import "./adapters/PaymentAdapter.sol";
import "./adapters/ParticipantManagerAdapter.sol";
import "./KeyManager.sol";
import "./Element.sol";
import "./libraries/LibParticipant.sol";
import "./libraries/LibElement.sol";
import "./libraries/LibEpoch.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

abstract contract SessionManager {
    using LibEpoch for uint256;
    struct Session {
        uint256 validUntilEpoch;
        bool active;
    }
    uint256 public GENESIS;
    uint256 public constant EPOCH = 100;

    mapping(address => mapping(address => Session)) sessions; // maps accounts to sessionAccounts to sessions
    mapping(address => address) activeSessions; // maps sessionAccount to accounts
    mapping(bytes => bool) usedSessionCodes;

    function _activeSessionExists(
        address account,
        address sessionAccount
    ) private view returns (bool) {
        if (
            account == account ||
            (sessions[account][sessionAccount].active &&
                sessions[account][sessionAccount].validUntilEpoch <=
                LibEpoch.currentEpoch(GENESIS, EPOCH))
        ) {
            return true;
        }
        return false;
    }

    function _holdsActiveSession(
        address sessionAccount
    ) internal view returns (bool) {
        address account = activeSessions[sessionAccount];
        if (account == address(0)) {
            return false;
        }
        return _activeSessionExists(account, sessionAccount);
    }

    function _getAccountForSessionAccount(
        address sessionAccount
    ) internal view returns (address) {
        return activeSessions[sessionAccount];
    }

    function _createSession(
        address account,
        address sessionAccount,
        uint256 validUntilEpoch,
        bytes memory uniqueSessionCode,
        bytes memory authSig
    ) internal {
        require(
            !usedSessionCodes[uniqueSessionCode],
            "Session code already used."
        );
        require(
            LibEpoch.currentEpoch(GENESIS, EPOCH) <= validUntilEpoch,
            "Session expired."
        );
        bytes32 hash = keccak256(
            abi.encodePacked(
                account,
                sessionAccount,
                validUntilEpoch,
                uniqueSessionCode
            )
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );

        require(
            SignatureChecker.isValidSignatureNow(
                account,
                ethSignedMessageHash,
                authSig
            ),
            "Session signature invalid."
        );
        usedSessionCodes[uniqueSessionCode] = true;
        sessions[account][sessionAccount] = Session(validUntilEpoch, true);
        activeSessions[sessionAccount] = account;
    }

    function _revokeSession(
        address account,
        address sessionAccount,
        bytes memory authSig
    ) internal {
        require(
            sessions[account][sessionAccount].active ||
                sessions[account][sessionAccount].validUntilEpoch >
                LibEpoch.currentEpoch(GENESIS, EPOCH),
            "No active session."
        );
        bytes32 hash = keccak256(abi.encodePacked(account, sessionAccount));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );

        require(
            SignatureChecker.isValidSignatureNow(
                account,
                ethSignedMessageHash,
                authSig
            ) ||
                SignatureChecker.isValidSignatureNow(
                    sessionAccount,
                    ethSignedMessageHash,
                    authSig
                ),
            "Session signature invalid."
        );
        sessions[account][sessionAccount].active = false;
        activeSessions[sessionAccount] = address(0);
    }
}
