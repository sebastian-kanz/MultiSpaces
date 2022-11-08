// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import '@openzeppelin/contracts/access/AccessControl.sol';
import './interfaces/IParticipantManager.sol';
import './interfaces/IPaymentManager.sol';
import './libraries/LibParticipant.sol';
import './libraries/InvitationChecker.sol';
import './libraries/PubKeyChecker.sol';
import './adapters/PaymentAdapter.sol';

contract ParticipantManager is
  IParticipantManager,
  AccessControl,
  PaymentAdapter
{
  using LibParticipant for *;
  using PubKeyChecker for address;
  using InvitationChecker for bytes;

  mapping(address => LibParticipant.Participant) public allParticipants;

  address[] public allParticipantAddresses;

  mapping(bytes32 => bool) private allInvitationHashes;

  event AddParticipant(address indexed _participant);

  event RemoveParticipant(address indexed _participant);

  bytes32[4] public ALL_ROLES = [
    LibParticipant.PARTICIPANT_ROLE,
    LibParticipant.UPDATEOR_ROLE,
    LibParticipant.MANAGER_ROLE,
    LibParticipant.OWNER_ROLE
  ];

  constructor(
    string memory name,
    address participant,
    bytes memory pubKey,
    address pManager
  ) {
    // TODO: Add more roles to msg.sender (space) to ensure space can interact with bucket
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    require(
      keccak256(abi.encodePacked(name)) != keccak256(abi.encodePacked('')),
      'Missing name'
    );
    require(participant != address(0), 'Missing address');

    bytes32[] memory roles = new bytes32[](5);
    roles[0] = DEFAULT_ADMIN_ROLE;
    roles[1] = LibParticipant.OWNER_ROLE;
    roles[2] = LibParticipant.MANAGER_ROLE;
    roles[3] = LibParticipant.UPDATEOR_ROLE;
    roles[4] = LibParticipant.PARTICIPANT_ROLE;
    _addParticipant(participant, name, pubKey);

    // Further roles submitted in [roles]
    for (uint256 i = 0; i < roles.length; i++) {
      _grantRole(roles[i], participant);
    }

    paymentManager = IPaymentManager(pManager);
    _setPaymentManager(pManager);
  }

  function participantCount() external view returns (uint256) {
    return allParticipantAddresses.length;
  }

  function hasRole(bytes32 role, address account)
    public
    view
    override(IParticipantManager, AccessControl)
    returns (bool)
  {
    return AccessControl.hasRole(role, account);
  }

  function _addParticipant(
    address adr,
    string memory name,
    bytes memory pubKey
  ) internal {
    adr.validatePubKey(pubKey);
    allParticipants[adr] = LibParticipant.Participant(adr, name, pubKey, true);
    allParticipantAddresses.push(adr);
  }

  /// @notice Users can remove their participation
  function removeParticipation(address participant)
    external
    onlyRole(DEFAULT_ADMIN_ROLE)
  {
    delete (allParticipants[participant]);

    int256 foundIndex = -1;
    for (uint256 i = 0; i < allParticipantAddresses.length; i++) {
      if (allParticipantAddresses[i] == participant) {
        foundIndex = int256(i);
      }
    }
    require(foundIndex >= 0, 'Not found');
    allParticipantAddresses[uint256(foundIndex)] = allParticipantAddresses[
      allParticipantAddresses.length - 1
    ];
    allParticipantAddresses.pop();
    // Remove all roles for participant
    for (uint256 i = 0; i < ALL_ROLES.length; i++) {
      renounceRole(ALL_ROLES[i], participant);
    }
    emit RemoveParticipant(participant);
  }

  /// @notice Users can redeem their participation code from existing member to join the BucktManager
  /// @param name The name of the new participant
  /// @param inviter The member (requires MANAGER_ROLE) that send the 'invitation code' to the new participant
  /// @param signature Acts as invitation code, needs to be verified
  /// @param randomCode Unique identifier to prevent multi use of single code
  function redeemParticipationCode(
    string memory name,
    address inviter,
    address invitee,
    bytes memory signature,
    string memory randomCode,
    bytes memory pubKey
  ) external payable onlyRole(DEFAULT_ADMIN_ROLE) {
    require(hasRole(LibParticipant.MANAGER_ROLE, inviter), 'Forbidden');

    (bool isValid, bytes32 hash) = signature.isValidInvitation(
      inviter,
      randomCode
    );
    require(isValid, 'Invalid invitation');

    require(allParticipants[invitee].initialized == false, 'User exists');
    require(allInvitationHashes[hash] == false, 'Already used');
    allInvitationHashes[hash] = true;

    _addParticipant(invitee, name, pubKey);
    _grantRole(LibParticipant.PARTICIPANT_ROLE, invitee);

    emit AddParticipant(invitee);
  }
}
