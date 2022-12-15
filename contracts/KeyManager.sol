// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

// As long as one participant in the same epoch can read its key, all other can be re-constructed
abstract contract KeyManager {
  mapping(uint256 => mapping(address => string)) epochToParticipantToKeyMapping;
  uint256 public GENESIS;
  uint256 public constant EPOCH = 100;

  modifier keyAvailable(uint256 blockNumber, address participant) {
    _keyAvailable(blockNumber, participant);
    _;
  }

  modifier keyMissing(uint256 blockNumber, address participant) {
    _keyMissing(blockNumber, participant);
    _;
  }

  function _currentEpoch() private view returns (uint256) {
    return (block.number - GENESIS) / EPOCH;
  }

  function _epochAt(uint256 blockNumber) private view returns (uint256) {
    require(blockNumber >= GENESIS, 'Block number before genesis.');
    return (blockNumber - GENESIS) / EPOCH;
  }

  function _keyAvailable(uint256 blockNumber, address participant)
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

  function _keyMissing(uint256 blockNumber, address participant) private view {
    require(
      keccak256(
        bytes(
          epochToParticipantToKeyMapping[_epochAt(blockNumber)][participant]
        )
      ) == keccak256(bytes('')),
      'Key already available!'
    );
  }

  /// @notice Gets a key for a specific block number and participant
  function getKey(address participant, uint256 blockNumber)
    external
    view
    returns (string memory)
  {
    return epochToParticipantToKeyMapping[_epochAt(blockNumber)][participant];
  }

  /// @notice Sets the key for a specific participant
  /// @param key the key
  /// @param participant address of the participant that can use (and decrypt) the key
  function _addKey(string memory key, address participant)
    private
    keyMissing(block.number, participant)
  {
    epochToParticipantToKeyMapping[_currentEpoch()][participant] = key;
  }

  function _addKeys(string[] memory keys, address[] memory participants)
    internal
  {
    for (uint256 index = 0; index < keys.length; index++) {
      _addKey(keys[index], participants[index]);
    }
  }

  /// @notice Sets the key for a specific participant
  /// @param key the key
  /// @param participant address of the participant that can use (and decrypt) the key
  /// @param blockNumber specific block in the past
  function _setKeyForParticipant(
    string memory key,
    address participant,
    uint256 blockNumber
  ) internal keyMissing(blockNumber, participant) {
    require(block.number > blockNumber, 'Block time in future.');
    _epochAt(blockNumber);
    epochToParticipantToKeyMapping[_epochAt(blockNumber)][participant] = key;
  }
}
