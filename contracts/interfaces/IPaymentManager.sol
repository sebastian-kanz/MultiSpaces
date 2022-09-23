// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IPaymentManager {
  enum PayableAction {
    CREATE_SPACE,
    ADD_BUCKET,
    ADD_PARTICIPANT
  }

  enum LimitedAction {
    ADD_DATA
  }

  event PayableActionEvent(
    PayableAction indexed _action,
    address indexed _sender,
    uint256 fee,
    bool voucher,
    bool unlimited
  );

  event LimitedActionEvent(
    LimitedAction indexed _action,
    address indexed _sender,
    uint256 limitLeftOver
  );

  function decreaseLimit(LimitedAction action, uint256 amount) external;

  function increaseLimit(
    LimitedAction action,
    uint256 amount,
    address account
  ) external;

  function chargeFee(PayableAction action) external payable;

  function addCredits(
    address receiver,
    uint256 credit,
    string memory random,
    bytes memory signature
  ) external payable;

  function getBalance(address account) external view returns (uint256);

  function getLimit(address account, LimitedAction action)
    external
    view
    returns (uint256);

  function getVoucherCount(address account, PayableAction action)
    external
    view
    returns (uint256);

  function isFreeOfCharge(address account, PayableAction action)
    external
    view
    returns (bool);

  function unleashPayableActionForAccount(address user, PayableAction action)
    external;

  function addVoucher(
    address user,
    PayableAction action,
    uint256 amount
  ) external;

  function addLimit(
    address user,
    LimitedAction action,
    uint256 amount
  ) external;

  function setDefaultFee(uint256 newBaseFee) external;

  function setDefaultLimit(uint256 newBaseLimit) external;

  function manufacturerWithdraw() external;
}
