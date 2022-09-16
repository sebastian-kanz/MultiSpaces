// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IParticipantManager.sol";
import "./interfaces/IPaymentManager.sol";
import "./ParticipantInteractor.sol";
import "./libraries/InvitationChecker.sol";
import "./libraries/PubKeyChecker.sol";
import "./adapters/PaymentAdapter.sol";

contract ParticipantManager is
    IParticipantManager,
    ParticipantInteractor,
    AccessControl,
    PaymentAdapter
{
    using PubKeyChecker for address;
    using InvitationChecker for bytes;

    mapping(address => Participant) public allParticipants;

    address[] public allParticipantAddresses;

    mapping(bytes32 => bool) private allInvitationHashes;

    event AddParticipant(address indexed _participant);

    event RemoveParticipant(address indexed _participant);

    constructor(
        string memory name,
        address participant,
        bytes memory pubKey,
        address pManager
    ) PaymentAdapter(pManager) {
        require(
            keccak256(abi.encodePacked(name)) !=
                keccak256(abi.encodePacked("")),
            "Missing name"
        );
        require(participant != address(0), "Missing address");

        bytes32[] memory roles = new bytes32[](5);
        roles[0] = DEFAULT_ADMIN_ROLE;
        roles[1] = OWNER_ROLE;
        roles[2] = MANAGER_ROLE;
        roles[3] = EDITOR_ROLE;
        roles[4] = PARTICIPANT_ROLE;
        _addParticipant(participant, name, pubKey);

        // Further roles submitted in [roles]
        for (uint256 i = 0; i < roles.length; i++) {
            _grantRole(roles[i], participant);
        }

        paymentManager = IPaymentManager(pManager);
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
        allParticipants[adr] = Participant(adr, name, pubKey, true);
        allParticipantAddresses.push(adr);
    }

    /// @notice Users can remove their participation
    function removeParticipation() external onlyRole(PARTICIPANT_ROLE) {
        delete (allParticipants[msg.sender]);

        int256 foundIndex = -1;
        for (uint256 i = 0; i < allParticipantAddresses.length; i++) {
            if (allParticipantAddresses[i] == msg.sender) {
                foundIndex = int256(i);
            }
        }
        require(foundIndex >= 0, "Not found");
        allParticipantAddresses[uint256(foundIndex)] = allParticipantAddresses[
            allParticipantAddresses.length - 1
        ];
        allParticipantAddresses.pop();
        // Remove all roles for participant
        for (uint256 i = 0; i < ParticipantInteractor.ALL_ROLES.length; i++) {
            renounceRole(ParticipantInteractor.ALL_ROLES[i], msg.sender);
        }
        emit RemoveParticipant(msg.sender);
    }

    /// @notice Users can redeem their participation code from existing member to join the BucktManager
    /// @param name The name of the new participant
    /// @param inviter The member (requires MANAGER_ROLE) that send the 'invitation code' to the new participant
    /// @param signature Acts as invitation code, needs to be verified
    /// @param randomCode Unique identifier to prevent multi use of single code
    function redeemParticipationCode(
        string memory name,
        address inviter,
        bytes memory signature,
        string memory randomCode,
        bytes memory pubKey
    ) external payable charge(IPaymentManager.PayableAction.ADD_PARTICIPANT) {
        require(hasRole(MANAGER_ROLE, inviter), "Forbidden");

        (bool isValid, bytes32 hash) = signature.isValidInvitation(
            inviter,
            randomCode
        );
        require(isValid, "Invalid invitation");

        require(
            allParticipants[msg.sender].initialized == false,
            "User exists"
        );
        require(allInvitationHashes[hash] == false, "Already used");
        allInvitationHashes[hash] = true;

        _addParticipant(msg.sender, name, pubKey);
        _grantRole(PARTICIPANT_ROLE, msg.sender);

        emit AddParticipant(msg.sender);
    }
}
