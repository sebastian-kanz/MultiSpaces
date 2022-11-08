// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import './interfaces/IPaymentManager.sol';
import './libraries/CreditChecker.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';

contract PaymentManager is IPaymentManager, Ownable {
  using CreditChecker for bytes;

  mapping(PayableAction => uint256) public DEFAULT_PAYMENTS;
  mapping(LimitedAction => uint256) public DEFAULT_LIMITS;
  mapping(address => mapping(PayableAction => uint256)) private vouchers;
  mapping(address => mapping(PayableAction => bool))
    private freeOfChargePayableActions;

  mapping(address => mapping(LimitedAction => uint256)) private limits;
  mapping(address => bool) private limitsInitialized;

  mapping(address => uint256) private credits;
  mapping(bytes32 => bool) private allCredits;

  constructor(uint256 baseFee, uint256 baseLimit) {
    _updateDefaultPayments(baseFee);
    _updateDefaultLimits(baseLimit);
  }

  function _updateDefaultPayments(uint256 baseFee) internal {
    DEFAULT_PAYMENTS[PayableAction.CREATE_SPACE] = baseFee;
    DEFAULT_PAYMENTS[PayableAction.ADD_BUCKET] = baseFee;
    DEFAULT_PAYMENTS[PayableAction.ADD_PARTICIPANT] = baseFee;
  }

  function _updateDefaultLimits(uint256 limit) internal {
    DEFAULT_LIMITS[LimitedAction.ADD_DATA] = limit;
  }

  // Anyone can decrease his own limit
  function decreaseLimit(LimitedAction action, uint256 amount)
    external
    override
  {
    initLimts();
    require(limits[msg.sender][action] >= amount, 'Limit depleted');
    limits[msg.sender][action] -= amount;
    emit LimitedActionEvent(action, msg.sender, limits[msg.sender][action]);
  }

  // Only owner can increase someone's limit
  function increaseLimit(
    LimitedAction action,
    uint256 amount,
    address account
  ) external override onlyOwner {
    initLimts();
    limits[account][action] += amount;
    emit LimitedActionEvent(action, account, limits[account][action]);
  }

  function initLimts() private {
    if (!limitsInitialized[msg.sender]) {
      limits[msg.sender][LimitedAction.ADD_DATA] = DEFAULT_LIMITS[
        LimitedAction.ADD_DATA
      ];
      limitsInitialized[msg.sender] = true;
    }
  }

  /// Vouchers are bound to a specific payable action and credited by the manufacturer
  /// Credits are bought by the participant and can be used for every payable action
  function chargeFee(PayableAction action) external payable override {
    if (!freeOfChargePayableActions[msg.sender][action]) {
      if (vouchers[msg.sender][action] > 0) {
        vouchers[msg.sender][action] -= 1;
        emit PayableActionEvent(action, msg.sender, 1, true, false);
      } else {
        if (credits[msg.sender] >= DEFAULT_PAYMENTS[action]) {
          credits[msg.sender] -= DEFAULT_PAYMENTS[action];
        } else {
          require(
            msg.value >= DEFAULT_PAYMENTS[action],
            string.concat(
              'Insufficient fee for account ',
              Strings.toHexString(uint160(msg.sender), 20),
              ' (',
              Strings.toString(msg.value),
              '/',
              Strings.toString(DEFAULT_PAYMENTS[action]),
              ')!'
            )
          );
        }
        emit PayableActionEvent(action, msg.sender, msg.value, false, false);
      }
    } else {
      credits[msg.sender] += msg.value;
      emit PayableActionEvent(action, msg.sender, msg.value, false, true);
    }
  }

  function addCredits(
    address receiver,
    uint256 credit,
    string memory random,
    bytes memory signature
  ) external payable override {
    require(credit == msg.value, 'Invalid credit amount');
    (bool isValid, bytes32 hash) = signature.isValidCredit(
      owner(),
      credit,
      random
    );
    require(isValid, 'Invalid credit');
    require(allCredits[hash] == false, 'Already used');

    allCredits[hash] = true;
    credits[receiver] = credits[receiver] + credit;
  }

  function getBalance(address account)
    external
    view
    override
    returns (uint256)
  {
    return credits[account];
  }

  function getLimit(address account, LimitedAction action)
    external
    view
    override
    returns (uint256)
  {
    return limits[account][action];
  }

  function getVoucherCount(address account, PayableAction action)
    external
    view
    override
    returns (uint256)
  {
    return vouchers[account][action];
  }

  function isFreeOfCharge(address account, PayableAction action)
    external
    view
    override
    returns (bool)
  {
    return freeOfChargePayableActions[account][action];
  }

  function unleashPayableActionForAccount(address user, PayableAction action)
    external
    override
    onlyOwner
  {
    freeOfChargePayableActions[user][action] = true;
  }

  function addVoucher(
    address user,
    PayableAction action,
    uint256 amount
  ) external override onlyOwner {
    vouchers[user][action] += amount;
  }

  function addLimit(
    address user,
    LimitedAction action,
    uint256 amount
  ) external override onlyOwner {
    limits[user][action] += amount;
  }

  function manufacturerWithdraw() external override onlyOwner {
    address manufacturer = owner();
    address payable self = payable(address(this));
    uint256 balance = self.balance;
    (bool sent, ) = manufacturer.call{ value: balance }('');
    require(sent, 'Sending failed');
  }

  function setDefaultFee(uint256 newBaseFee) external override onlyOwner {
    _updateDefaultPayments(newBaseFee);
  }

  function setDefaultLimit(uint256 newBaseLimit) external override onlyOwner {
    _updateDefaultLimits(newBaseLimit);
  }

  function increaseCredits(address receiver) external payable {
    credits[receiver] = credits[receiver] + msg.value;
  }

  receive() external payable {
    credits[msg.sender] = credits[msg.sender] + msg.value;
  }

  fallback() external payable {
    credits[msg.sender] = credits[msg.sender] + msg.value;
  }
}
