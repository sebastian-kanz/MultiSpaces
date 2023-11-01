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

    modifier onlyRole(bytes32 role) {
        _onlyRole(role);
        _;
    }

    function participantCount() internal view returns (uint256) {
        return participantManager.participantCount();
    }

    // function _redeemParticipationCode(
    //     string memory name,
    //     address inviter,
    //     address invitee,
    //     bytes memory signature,
    //     string memory randomCode,
    //     bytes memory pubKey
    // ) internal {
    //     participantManager.redeemParticipationCode(
    //         name,
    //         inviter,
    //         invitee,
    //         signature,
    //         randomCode,
    //         pubKey
    //     );
    // }

    function _addParticipation(
        string memory newParticipantName,
        address newParticipantAdr,
        bytes memory newParticipantPubKey
    ) internal {
        participantManager.addParticipation(
            newParticipantName,
            newParticipantAdr,
            newParticipantPubKey
        );
    }

    function _requestParticipation(
        string memory name,
        address requestor,
        bytes memory pubKey,
        string memory deviceName,
        address device,
        bytes memory devicePubKey,
        bytes memory signature
    ) internal {
        participantManager.requestParticipation(
            name,
            requestor,
            pubKey,
            deviceName,
            device,
            devicePubKey,
            signature
        );
    }

    function _acceptParticipation(
        address requestor,
        address acceptor
    ) internal {
        participantManager.acceptParticipation(requestor, acceptor);
    }

    function _removeParticipation(address participant) internal {
        participantManager.removeParticipation(participant);
    }
}
