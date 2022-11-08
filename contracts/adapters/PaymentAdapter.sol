// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import '@openzeppelin/contracts/access/AccessControl.sol';
import '../interfaces/IPaymentManager.sol';

abstract contract PaymentAdapter {
  IPaymentManager paymentManager;

  function _charge(IPaymentManager.PayableAction action) private {
    (paymentManager.chargeFee){ value: msg.value }(action);
  }

  modifier charge(IPaymentManager.PayableAction action) {
    _;
    _charge(action);
  }

  function _decreaseLimit(IPaymentManager.LimitedAction action, uint256 amount)
    private
  {
    paymentManager.decreaseLimit(action, amount);
  }

  modifier decreaseLimit(IPaymentManager.LimitedAction action, uint256 amount) {
    _decreaseLimit(action, amount);
    _;
  }

  function _setPaymentManager(address pManager) internal {
    paymentManager = IPaymentManager(pManager);
  }
}
