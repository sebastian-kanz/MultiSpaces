const CreditChecker = artifacts.require("CreditChecker");
const PubKeyChecker = artifacts.require("PubKeyChecker");
const InvitationChecker = artifacts.require("InvitationChecker");
const Bucket = artifacts.require("Bucket");
const Element = artifacts.require("Element");
const BucketFactory = artifacts.require("BucketFactory");
const Space = artifacts.require("Space");
const MultiSpaces = artifacts.require("MultiSpaces");

module.exports = async function (deployer, network, accounts) {

  async function deployLibraries(timeout) {
    await deployer.deploy(CreditChecker);
    await deployer.deploy(PubKeyChecker);
    await deployer.deploy(InvitationChecker);
  }

  async function deploy(contract, timeout, ...args) {
    console.log("Waiting for timeout " + timeout);
    await new Promise(r => setTimeout(r, timeout));
    return deployer.deploy(contract, ...args);
  }


  await deployer.deploy(CreditChecker);
  await deployer.deploy(PubKeyChecker);
  await deployer.deploy(InvitationChecker);

  const bucket = await deployer.deploy(Bucket);
  const element = await deployer.deploy(Element);
  await deployer.link(PubKeyChecker, BucketFactory);
  await deployer.link(InvitationChecker, BucketFactory);
  const bucketFactory = await deployer.deploy(BucketFactory, bucket.address, element.address);

  await deployer.link(PubKeyChecker, Space);
  const space = await deployer.deploy(Space);

  await deployer.link(CreditChecker, MultiSpaces);
  const multiSpaces = await deployer.deploy(MultiSpaces, bucketFactory.address, space.address);

  await bucketFactory.transferOwnership(MultiSpaces.address);

  console.log(`Bucket address: ${bucket.address}`);
  console.log(`Element address: ${element.address}`);
  console.log(`BucketFactory address: ${bucketFactory.address}`);
  console.log(`Space address: ${space.address}`);
  console.log(`MultiSpaces address: ${multiSpaces.address}`);
};