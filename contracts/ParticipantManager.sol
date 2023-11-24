// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./interfaces/IParticipantManager.sol";
import "./interfaces/IPaymentManager.sol";
import "./libraries/LibParticipant.sol";
import "./libraries/InvitationChecker.sol";
import "./libraries/PubKeyChecker.sol";
import "./adapters/PaymentAdapter.sol";
import "./SessionManager.sol";

contract ParticipantManager is
    IParticipantManager,
    SessionManager,
    AccessControl,
    PaymentAdapter,
    Initializable
{
    using LibParticipant for *;
    using PubKeyChecker for address;
    using InvitationChecker for bytes;

    mapping(address => LibParticipant.Participant) public allParticipants;

    address[] public allParticipantAddresses;

    mapping(bytes32 => bool) private allInvitationHashes;

    event AddParticipant(address indexed _participant);
    event AddRequestor(address indexed _requestor, address indexed _device);

    event RemoveParticipant(address indexed _participant);

    bytes32[4] public ALL_ROLES = [
        LibParticipant.PARTICIPANT_ROLE,
        LibParticipant.UPDATER_ROLE,
        LibParticipant.MANAGER_ROLE,
        LibParticipant.OWNER_ROLE
    ];

    mapping(address => LibParticipant.Request) public allRequests;
    address[] public allRequestorAddresses;

    function initialize(
        string memory name,
        address participant,
        bytes memory pubKey,
        address pManager
    ) external initializer {
        // Roles for ParticipantManagerFactory
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(LibParticipant.OWNER_ROLE, msg.sender);
        require(
            keccak256(abi.encodePacked(name)) !=
                keccak256(abi.encodePacked("")),
            "Missing name"
        );
        require(participant != address(0), "Missing address");

        // Roles for Participant
        bytes32[] memory roles = new bytes32[](4);
        // TODO: maybe new participant must again also be admin?
        // roles[0] = DEFAULT_ADMIN_ROLE;
        roles[0] = LibParticipant.OWNER_ROLE;
        roles[1] = LibParticipant.MANAGER_ROLE;
        roles[2] = LibParticipant.UPDATER_ROLE;
        roles[3] = LibParticipant.PARTICIPANT_ROLE;
        _addParticipant(participant, name, pubKey);

        // Further roles submitted in [roles]
        for (uint256 i = 0; i < roles.length; i++) {
            _grantRole(roles[i], participant);
        }

        paymentManager = IPaymentManager(pManager);
        _setPaymentManager(pManager);
        GENESIS = block.number;
    }

    function participantCount() external view override returns (uint256) {
        return allParticipantAddresses.length;
    }

    function hasRole(
        bytes32 role,
        address account
    ) public view override(IParticipantManager, AccessControl) returns (bool) {
        bool accountHasRole = AccessControl.hasRole(role, account);
        bool accountHasSession = _holdsActiveSession(account);
        if (accountHasSession) {
            address origin = _getAccountForSessionAccount(account);
            accountHasRole = AccessControl.hasRole(role, origin);
        }
        return accountHasRole;
    }

    function grantRole(
        bytes32 role,
        address account
    ) public override(IParticipantManager, AccessControl) {
        AccessControl.grantRole(role, account);
    }

    function _addParticipant(
        address adr,
        string memory name,
        bytes memory pubKey
    ) internal {
        adr.validatePubKey(pubKey);
        allParticipants[adr] = LibParticipant.Participant(
            adr,
            name,
            pubKey,
            true
        );
        allParticipantAddresses.push(adr);
    }

    /// @notice Users can remove their participation
    function removeParticipation(
        address participant
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        delete (allParticipants[participant]);

        int256 foundIndex = -1;
        for (uint256 i = 0; i < allParticipantAddresses.length; i++) {
            if (allParticipantAddresses[i] == participant) {
                foundIndex = int256(i);
            }
        }
        require(foundIndex >= 0, "Not found");
        allParticipantAddresses[uint256(foundIndex)] = allParticipantAddresses[
            allParticipantAddresses.length - 1
        ];
        allParticipantAddresses.pop();
        // Remove all roles for participant
        for (uint256 i = 0; i < ALL_ROLES.length; i++) {
            _revokeRole(ALL_ROLES[i], participant);
        }
        emit RemoveParticipant(participant);
    }

    function addParticipation(
        string memory newParticipantName,
        address newParticipantAdr,
        bytes memory newParticipantPubKey
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            allParticipants[newParticipantAdr].initialized == false,
            "User exists"
        );
        _addParticipant(
            newParticipantAdr,
            newParticipantName,
            newParticipantPubKey
        );
        _grantRole(LibParticipant.PARTICIPANT_ROLE, newParticipantAdr);
        emit AddParticipant(newParticipantAdr);
    }

    function requestParticipation(
        string memory name,
        address requestor,
        bytes memory pubKey,
        string memory deviceName,
        address device,
        bytes memory devicePubKey,
        bytes memory signature
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        require(allParticipants[device].initialized == false, "Device exists");

        (bool isValid, /* bytes32 hash */) = signature.isValidInvitation(
            requestor,
            name
        );
        require(isValid, "Invalid request");
        if (!allParticipants[requestor].initialized) {
            _addParticipant(requestor, name, pubKey);
            _grantRole(LibParticipant.REQUESTOR_ROLE, requestor);
            allRequests[requestor] = LibParticipant.Request(
                requestor,
                device,
                address(0),
                false
            );
            allRequestorAddresses.push(requestor);
            emit AddRequestor(requestor, device);
        }

        _addParticipant(device, deviceName, devicePubKey);
        _grantRole(LibParticipant.REQUESTOR_ROLE, device);

        allRequests[device] = LibParticipant.Request(
            device,
            device,
            address(0),
            false
        );
        allRequestorAddresses.push(device);
        emit AddRequestor(device, device);
    }

    function acceptParticipation(
        address requestor,
        address acceptor
    ) external override onlyRole(DEFAULT_ADMIN_ROLE) {
        address device = allRequests[requestor].device;
        require(
            allRequests[device].accepted == false,
            "Request (device) already accepted"
        );
        if (!allRequests[requestor].accepted) {
            _revokeRole(LibParticipant.REQUESTOR_ROLE, requestor);
            _grantRole(LibParticipant.PARTICIPANT_ROLE, requestor);
            allRequests[requestor].accepted = true;
            allRequests[requestor].acceptor = acceptor;
            emit AddParticipant(requestor);
        }
        _revokeRole(LibParticipant.REQUESTOR_ROLE, device);
        _grantRole(LibParticipant.PARTICIPANT_ROLE, device);
        allRequests[device].accepted = true;
        allRequests[device].acceptor = acceptor;
        emit AddParticipant(device);
    }

    function createSession(
        address account,
        address sessionAccount,
        uint256 validUntilEpoch,
        bytes memory uniqueSessionCode,
        bytes memory authSig
    ) external payable {
        _createSession(
            account,
            sessionAccount,
            validUntilEpoch,
            uniqueSessionCode,
            authSig
        );
        (bool sent, /* bytes memory data */) = sessionAccount.call{value: msg.value}(
            ""
        );
        require(sent, "Failed to send Ether");
    }

    function revokeSession(
        address account,
        address sessionAccount,
        bytes memory authSig
    ) external payable {
        _revokeSession(account, sessionAccount, authSig);
        (bool sent, /* bytes memory data */ ) = account.call{value: msg.value}("");
        require(sent, "Failed to send Ether");
    }
}
