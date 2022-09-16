const CreditChecker = artifacts.require("CreditChecker");
const PubKeyChecker = artifacts.require("PubKeyChecker");
const InvitationChecker = artifacts.require("InvitationChecker");
const ParticipantManager = artifacts.require("ParticipantManager");
const PaymentManager = artifacts.require("PaymentManager");
const Bucket = artifacts.require("Bucket");
const Space = artifacts.require("Space");
const MultiSpaces = artifacts.require("MultiSpaces");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(CreditChecker);
  await deployer.deploy(PubKeyChecker);
  await deployer.link(CreditChecker, PaymentManager);
  // await deployer.deploy(PaymentManager, 1000, 1000);
  // const pManager = await PaymentManager.deployed();
  await deployer.deploy(InvitationChecker);
  // await deployer.link(InvitationChecker, ParticipantManager);
  // await deployer.link(PaymentManager, ParticipantManager);
  await deployer.link(CreditChecker, MultiSpaces);
  await deployer.link(PubKeyChecker, MultiSpaces);
  await deployer.link(InvitationChecker, MultiSpaces);
  await deployer.deploy(MultiSpaces);
};