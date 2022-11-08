// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IParticipantManager {
  function hasRole(bytes32 role, address account) external view returns (bool);

  function participantCount() external view returns (uint256);

  function removeParticipation(address participant) external;

  function redeemParticipationCode(
    string memory name,
    address inviter,
    address invitee,
    bytes memory signature,
    string memory randomCode,
    bytes memory pubKey
  ) external payable;
}
