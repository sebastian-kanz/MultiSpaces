// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;
import './interfaces/IPaymentManager.sol';
import './libraries/CreditChecker.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';

// PayableActions are payed by a space / bucket (vouchers, credits, freeOfCharge) or by its user via msg.value
// LimitedActions are never "payed" by a user but by the bucket (limit will decrease)
contract PaymentManager is IPaymentManager, Ownable {
  using CreditChecker for bytes;

  mapping(PayableAction => uint256) public DEFAULT_PAYMENTS;
  mapping(LimitedAction => uint256) public DEFAULT_LIMITS;
  mapping(address => mapping(PayableAction => uint256)) private vouchers;
  mapping(address => mapping(PayableAction => bool))
    private freeOfChargePayableActions;

  mapping(address => mapping(LimitedAction => uint256)) private limits;
  mapping(address => bool) private limitsInitialized;
  mapping(address => mapping(LimitedAction => bool))
    private unlimitedLimitedActions;

  mapping(address => uint256) private credits;
  mapping(bytes32 => bool) private allCredits;

  uint256 public limitPrice; // how many wei for one limit

  constructor(
    uint256 baseFee,
    uint256 baseLimit,
    uint256 price
  ) {
    _updateDefaultPayments(baseFee);
    _updateDefaultLimits(baseLimit);
    limitPrice = price;
  }

  // Anyone can decrease his own limit
  function decreaseLimit(LimitedAction action, uint256 amount)
    external
    override
  {
    initLimits();
    if (!unlimitedLimitedActions[msg.sender][action]) {
      require(limits[msg.sender][action] >= amount, 'Limit depleted');
      limits[msg.sender][action] -= amount;
      emit LimitedActionEvent(
        action,
        msg.sender,
        msg.sender,
        limits[msg.sender][action],
        false
      );
    } else {
      emit LimitedActionEvent(
        action,
        msg.sender,
        msg.sender,
        limits[msg.sender][action],
        true
      );
    }
  }

  // Only owner can increase someone's limit without paying. Everyone else has to pay.
  // Attention: Use bucket address here!
  function increaseLimit(
    LimitedAction action,
    uint256 amount,
    address bucket
  ) external payable override {
    require(
      !unlimitedLimitedActions[msg.sender][action],
      'Account is unlimited. Can not increase limit.'
    );
    initLimits();
    if (msg.sender != owner()) {
      require(amount == msg.value, 'Amount and sent value mismatch.');
    }
    // Note: rest of value will be retained
    limits[bucket][action] += amount / limitPrice;
    emit LimitedActionEvent(
      action,
      msg.sender,
      bucket,
      limits[bucket][action],
      false
    );
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

  function redeemCredit(
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
    override
    returns (uint256)
  {
    initLimits(account);
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

  function isUnlimited(address account, LimitedAction action)
    external
    view
    override
    returns (bool)
  {
    return unlimitedLimitedActions[account][action];
  }

  function increaseCredits(address receiver) external payable override {
    credits[receiver] = credits[receiver] + msg.value;
  }

  receive() external payable {
    credits[msg.sender] = credits[msg.sender] + msg.value;
  }

  fallback() external payable {
    credits[msg.sender] = credits[msg.sender] + msg.value;
  }

  function transferCredits(uint256 amount, address receiver)
    external
    payable
    override
  {
    require(credits[msg.sender] >= amount, 'Insufficient credits');
    credits[msg.sender] -= amount;
    credits[receiver] += amount;
  }

  // ### OWNER FUNCTIONS ###

  function setAccountFreeOfCharge(
    address account,
    PayableAction action,
    bool enable
  ) external override onlyOwner {
    freeOfChargePayableActions[account][action] = enable;
  }

  function setAccountUnlimited(
    address account,
    LimitedAction action,
    bool enable
  ) external override onlyOwner {
    initLimits(account);
    unlimitedLimitedActions[account][action] = enable;
  }

  function addVoucher(
    address adr,
    PayableAction action,
    uint256 amount
  ) external override onlyOwner {
    vouchers[adr][action] += amount;
  }

  function addLimit(
    address adr,
    LimitedAction action,
    uint256 amount
  ) external override onlyOwner {
    initLimits(adr);
    limits[adr][action] += amount;
  }

  function setDefaultFee(uint256 newBaseFee) external override onlyOwner {
    _updateDefaultPayments(newBaseFee);
  }

  function setDefaultLimit(uint256 newBaseLimit) external override onlyOwner {
    _updateDefaultLimits(newBaseLimit);
  }

  function manufacturerWithdraw() external override onlyOwner {
    address manufacturer = owner();
    address payable self = payable(address(this));
    uint256 balance = self.balance;
    (bool sent, ) = manufacturer.call{ value: balance }('');
    require(sent, 'Sending failed');
  }

  function setLimitPrice(uint256 price) external override onlyOwner {
    limitPrice = price;
  }

  // ### INTERNAL ###

  function _updateDefaultPayments(uint256 baseFee) internal {
    DEFAULT_PAYMENTS[PayableAction.CREATE_SPACE] = baseFee;
    DEFAULT_PAYMENTS[PayableAction.ADD_BUCKET] = baseFee;
    DEFAULT_PAYMENTS[PayableAction.ADD_PARTICIPANT] = baseFee;
  }

  function _updateDefaultLimits(uint256 limit) internal {
    DEFAULT_LIMITS[LimitedAction.ADD_DATA] = limit;
  }

  function initLimits() private {
    initLimits(msg.sender);
  }

  function initLimits(address account) private {
    if (!limitsInitialized[account]) {
      limits[account][LimitedAction.ADD_DATA] = DEFAULT_LIMITS[
        LimitedAction.ADD_DATA
      ];
      limitsInitialized[account] = true;
    }
  }
}
