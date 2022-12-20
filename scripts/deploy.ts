import { ethers } from "hardhat";
import { getAccountKeys } from "../test/helpers/keys.helper";
const { ACCOUNT_3_ADDRESS } = getAccountKeys();

async function main() {
  const deployer = await ethers.getSigner(ACCOUNT_3_ADDRESS ?? "");
  const balance = await deployer.getBalance();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance (before): ", ethers.utils.formatEther(balance));

  const Element = await ethers.getContractFactory("Element");
  const element = await Element.deploy();
  const Bucket = await ethers.getContractFactory("Bucket");
  const bucket = await Bucket.deploy();

  const InvitationChecker = await ethers.getContractFactory(
    "InvitationChecker"
  );
  const invitationChecker = await InvitationChecker.deploy();
  const PubKeyChecker = await ethers.getContractFactory("PubKeyChecker");
  const pubKeyChecker = await PubKeyChecker.deploy();

  const BucketFactory = await ethers.getContractFactory("BucketFactory", {
    libraries: {
      InvitationChecker: invitationChecker.address,
      PubKeyChecker: pubKeyChecker.address,
    },
  });
  const bucketFactory = await BucketFactory.deploy(
    bucket.address,
    element.address
  );

  const CreditChecker = await ethers.getContractFactory("CreditChecker");
  const creditChecker = await CreditChecker.deploy();

  const Space = await ethers.getContractFactory("Space", {
    libraries: {
      PubKeyChecker: pubKeyChecker.address,
    },
  });

  const space = await Space.deploy();

  const MultiSpaces = await ethers.getContractFactory("MultiSpaces", {
    libraries: {
      CreditChecker: creditChecker.address,
    },
  });

  const multiSpaces = await MultiSpaces.deploy(
    bucketFactory.address,
    space.address
  );

  await bucketFactory.transferOwnership(multiSpaces.address);

  console.log(`Bucket address: ${bucket.address}`);
  console.log(`Element address: ${element.address}`);
  console.log(`BucketFactory address: ${bucketFactory.address}`);
  console.log(`Space address: ${space.address}`);
  console.log(`MultiSpaces address: ${multiSpaces.address}`);

  const balanceAfter = await deployer.getBalance();
  const balanceDiff = balance.sub(balanceAfter);
  console.log(
    "Account balance (after): ",
    ethers.utils.formatEther(balanceAfter)
  );
  console.log(
    "Total deployment costs: ",
    ethers.utils.formatEther(balanceDiff)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
