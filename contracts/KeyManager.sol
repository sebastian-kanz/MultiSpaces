// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

//TODO: Instead of using key hashes, use encyrypted keys! So keys will be securely stored onchain!
// As long as one participant in the same epoch can read its key, all other can be re-constructed
abstract contract KeyManager {
  mapping(uint256 => mapping(address => string)) epochToParticipantToKeyMapping;
  uint256 public GENESIS;
  uint256 public constant EPOCH = 100;

  constructor() {
    GENESIS = block.number;
  }

  modifier keyAvailable(uint256 blockNumber, address participant) {
    _keyHashAvailable(blockNumber, participant);
    _;
  }

  modifier keyMissing(uint256 blockNumber, address participant) {
    _keyHashMissing(blockNumber, participant);
    _;
  }

  function _currentEpoch() private view returns (uint256) {
    return (block.number - GENESIS) / EPOCH;
  }

  function _epochAt(uint256 blockNumber) private view returns (uint256) {
    require(blockNumber >= GENESIS, 'Block number before genesis.');
    return (blockNumber - GENESIS) / EPOCH;
  }

  function _keyHashAvailable(uint256 blockNumber, address participant)
    private
    view
  {
    require(
      keccak256(
        bytes(
          epochToParticipantToKeyMapping[_epochAt(blockNumber)][participant]
        )
      ) != keccak256(bytes('')),
      'No key available!'
    );
  }

  function _keyHashMissing(uint256 blockNumber, address participant)
    private
    view
  {
    require(
      keccak256(
        bytes(
          epochToParticipantToKeyMapping[_epochAt(blockNumber)][participant]
        )
      ) == keccak256(bytes('')),
      'Key already available!'
    );
  }

  /// @notice Gets a key hash for a specific block number and participant
  function getKey(address participant, uint256 blockNumber)
    external
    view
    returns (string memory)
  {
    return epochToParticipantToKeyMapping[_epochAt(blockNumber)][participant];
  }

  /// @notice Sets the hash for a specific participant
  /// @param keyHash hash of the key
  /// @param participant address of the participant that can use (and decrypt) the key
  function _addKey(string memory keyHash, address participant)
    private
    keyMissing(block.number, participant)
  {
    epochToParticipantToKeyMapping[_currentEpoch()][participant] = keyHash;
  }

  function _addKeys(string[] memory keyHashes, address[] memory participants)
    internal
  {
    require(keyHashes.length == participants.length, 'Invalid keys.');
    for (uint256 index = 0; index < keyHashes.length; index++) {
      _addKey(keyHashes[index], participants[index]);
    }
  }

  /// @notice Sets the hash for a specific participant
  /// @param keyHash hash of the key
  /// @param participant address of the participant that can use (and decrypt) the key
  /// @param blockNumber specific block in the past
  function _setKeyForParticipant(
    string memory keyHash,
    address participant,
    uint256 blockNumber
  ) internal keyMissing(blockNumber, participant) {
    require(block.number > blockNumber, 'Block time in future.');
    _epochAt(blockNumber);
    epochToParticipantToKeyMapping[_epochAt(blockNumber)][
      participant
    ] = keyHash;
  }
}
