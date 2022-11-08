const CreditChecker = artifacts.require("CreditChecker");
const PubKeyChecker = artifacts.require("PubKeyChecker");
const InvitationChecker = artifacts.require("InvitationChecker");
const Bucket = artifacts.require("Bucket");
const Element = artifacts.require("Element");
const BucketFactory = artifacts.require("BucketFactory");
const Space = artifacts.require("Space");
const MultiSpaces = artifacts.require("MultiSpaces");

module.exports = async function (deployer, network, accounts) {
  // Deploy libraries
  await deployer.deploy(CreditChecker);
  await deployer.deploy(PubKeyChecker);
  await deployer.deploy(InvitationChecker);

  const bucket = await deployer.deploy(Bucket);
  const element = await deployer.deploy(Element);

  const bucketFactory = await deployer.deploy(BucketFactory, bucket.address, element.address);

  // Deploy space
  await deployer.link(PubKeyChecker, Space);
  await deployer.link(InvitationChecker, Space);
  const space = await deployer.deploy(Space);

  // Deploy multi spaces
  await deployer.link(CreditChecker, MultiSpaces);
  const multiSpaces = await deployer.deploy(MultiSpaces, bucketFactory.address, space.address);

  await bucketFactory.transferOwnership(MultiSpaces.address);

  console.log(`Bucket address: ${bucket.address}`);
  console.log(`Element address: ${element.address}`);
  console.log(`BucketFactory address: ${bucketFactory.address}`);
  console.log(`Space address: ${space.address}`);
  console.log(`MultiSpaces address: ${multiSpaces.address}`);
};