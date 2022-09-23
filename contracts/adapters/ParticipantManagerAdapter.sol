// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import '@openzeppelin/contracts/utils/Strings.sol';
import '../interfaces/IParticipantManager.sol';

abstract contract ParticipantManagerAdapter {
  IParticipantManager public participantManager;

  constructor(address partManager) {
    participantManager = IParticipantManager(partManager);
  }

  modifier onlyRole(bytes32 role) {
    if (!participantManager.hasRole(role, tx.origin)) {
      revert(
        string(
          abi.encodePacked(
            'AccessControl: account ',
            Strings.toHexString(uint160(tx.origin), 20),
            ' is missing role ',
            Strings.toHexString(uint256(role), 32)
          )
        )
      );
    }
    _;
  }

  function participantCount() internal view returns (uint256) {
    return participantManager.participantCount();
  }
}
