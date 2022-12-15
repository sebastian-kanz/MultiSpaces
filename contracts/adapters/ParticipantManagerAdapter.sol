// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import '@openzeppelin/contracts/utils/Strings.sol';
import '../interfaces/IParticipantManager.sol';

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
            'AccessControl: account ',
            Strings.toHexString(uint160(msg.sender), 20),
            ' is missing role ',
            Strings.toHexString(uint256(role), 32)
          )
        )
      );
    }
  }

  // function _onlyRoleAuthorized(bytes32 role, address issuer) internal view {
  //   if (!participantManager.hasRoleAuthorized(role, issuer, msg.sender)) {
  //     revert(
  //       string(
  //         abi.encodePacked(
  //           'AccessControl: account ',
  //           Strings.toHexString(uint160(msg.sender), 20),
  //           ' is unauthorized'
  //         )
  //       )
  //     );
  //   }
  // }

  modifier onlyRole(bytes32 role) {
    _onlyRole(role);
    _;
  }

  // modifier onlyRoleAuthorized(bytes32 role, address issuer) {
  //   _onlyRoleAuthorized(role, issuer);
  //   _;
  // }

  // function authorizedSender(address issuer) internal view returns (address) {
  //   return participantManager.authorizedSender(issuer, msg.sender);
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
