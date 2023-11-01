// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IParticipantManager {
    function hasRole(
        bytes32 role,
        address account
    ) external view returns (bool);

    function grantRole(bytes32 role, address account) external;

    function participantCount() external view returns (uint256);

    function removeParticipation(address participant) external;

    // function redeemParticipationCode(
    //     string memory name,
    //     address inviter,
    //     address invitee,
    //     bytes memory signature,
    //     string memory randomCode,
    //     bytes memory pubKey
    // ) external payable;
    function addParticipation(
        string memory newParticipantName,
        address newParticipantAdr,
        bytes memory newParticipantPubKey
    ) external;

    function requestParticipation(
        string memory name,
        address requestor,
        bytes memory pubKey,
        string memory deviceName,
        address device,
        bytes memory devicePubKey,
        bytes memory signature
    ) external;

    function acceptParticipation(address requestor, address acceptor) external;

    function createSession(
        address account,
        address sessionAccount,
        uint256 validUntilEpoch,
        bytes memory uniqueSessionCode,
        bytes memory authSig
    ) external payable;

    function revokeSession(
        address account,
        address sessionAccount,
        bytes memory authSig
    ) external payable;
}
