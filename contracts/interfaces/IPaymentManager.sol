// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IPaymentManager {
  enum PayableAction {
    CREATE_SPACE, // Payed by space
    ADD_BUCKET, // Payed by space
    ADD_PARTICIPANT // Payed by bucket
  }

  enum LimitedAction {
    ADD_DATA // Payed by bucket
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
    address indexed _owner,
    uint256 limitLeftOver,
    bool unlimited
  );

  function decreaseLimit(LimitedAction action, uint256 amount) external;

  function increaseLimit(
    LimitedAction action,
    uint256 amount,
    address bucket
  ) external payable;

  function chargeFee(PayableAction action) external payable;

  function redeemCredit(
    address receiver,
    uint256 credit,
    string memory random,
    bytes memory signature
  ) external payable;

  function getBalance(address account) external view returns (uint256);

  function getLimit(address account, LimitedAction action)
    external
    returns (uint256);

  function getVoucherCount(address account, PayableAction action)
    external
    view
    returns (uint256);

  function isFreeOfCharge(address account, PayableAction action)
    external
    view
    returns (bool);

  function isUnlimited(address account, LimitedAction action)
    external
    view
    returns (bool);

  function increaseCredits(address receiver) external payable;

  function transferCredits(uint256 amount, address receiver) external payable;

  // ### OWNER FUNCTIONS ###

  function setAccountFreeOfCharge(
    address account,
    PayableAction action,
    bool enable
  ) external;

  function setAccountUnlimited(
    address account,
    LimitedAction action,
    bool enable
  ) external;

  function addVoucher(
    address adr,
    PayableAction action,
    uint256 amount
  ) external;

  function addLimit(
    address adr,
    LimitedAction action,
    uint256 amount
  ) external;

  function setDefaultFee(uint256 newBaseFee) external;

  function setDefaultLimit(uint256 newBaseLimit) external;

  function manufacturerWithdraw() external;

  function setLimitPrice(uint256) external;
}
