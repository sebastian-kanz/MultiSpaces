// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import '../Bucket.sol';

contract BucketMock is Bucket {
  function mockRegisterElement(address elemMock) external {
    registeredElements[elemMock] = true;
  }

  function _addElement(Element elem) internal override {
    allElements.push(address(elem));
    registeredElements[address(elem)] = true;
  }
}

contract BucketMockForElem is Bucket {
  function mockRegisterElement(address elemMock) external {
    registeredElements[elemMock] = true;
  }
}
