// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Strings.sol";
import "../interfaces/IParticipantManager.sol";

abstract contract ParticipantManagerAdapter {
    IParticipantManager public participantManager;

    function _setParticipantManager(address partManager) internal {
        participantManager = IParticipantManager(partManager);
    }

    function _onlyRole(bytes32 role) internal view {
        if (!participantManager.hasRole(role, msg.sender)) {
            revert(
                string(
                    abi.encodePacked(
                        "AccessControl: account ",
                        Strings.toHexString(uint160(msg.sender), 20),
                        " is missing role ",
                        Strings.toHexString(uint256(role), 32)
                    )
                )
            );
        }
    }

    // function _onlyRoleDelegated(bytes32 role, address delegator) internal view {
    //     if (!participantManager.hasRoleDelegated(role, delegator, msg.sender)) {
    //         revert(
    //             string(
    //                 abi.encodePacked(
    //                     "AccessControl: account ",
    //                     Strings.toHexString(uint160(msg.sender), 20),
    //                     " is unauthorized"
    //                 )
    //             )
    //         );
    //     }
    // }

    modifier onlyRole(bytes32 role) {
        _onlyRole(role);
        _;
    }

    // modifier onlyRoleDelegated(bytes32 role, address issuer) {
    //     _onlyRoleDelegated(role, issuer);
    //     _;
    // }

    // function delegatedSender(address delegator)
    //     internal
    //     view
    //     returns (address)
    // {
    //     return participantManager.delegatedSender(delegator, msg.sender);
    // }

    function participantCount() internal view returns (uint256) {
        return participantManager.participantCount();
    }

    function _redeemParticipationCode(
        string memory name,
        address inviter,
        address invitee,
        bytes memory signature,
        string memory randomCode,
        bytes memory pubKey
    ) internal {
        participantManager.redeemParticipationCode(
            name,
            inviter,
            invitee,
            signature,
            randomCode,
            pubKey
        );
    }

    function _removeParticipation(address participant) internal {
        participantManager.removeParticipation(participant);
    }
}
