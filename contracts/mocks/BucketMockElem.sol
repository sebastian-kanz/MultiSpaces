// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import '../Bucket.sol';

contract BucketMockElem is Bucket {
  function mockRegisterElement(address elemMock) external {
    registeredElements[elemMock] = true;
  }
}
