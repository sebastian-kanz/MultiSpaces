import { ethers } from "hardhat";
import * as fs from "fs";
import { getAccountKeys } from "../test/helpers/keys.helper";
const { ACCOUNT_3_ADDRESS } = getAccountKeys();

async function main() {
  const deployer = await ethers.getSigner(ACCOUNT_3_ADDRESS ?? "");
  const balance = await ethers.provider.getBalance(ACCOUNT_3_ADDRESS);

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance (before): ", ethers.formatEther(balance));

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

  const ParticipantManager = await ethers.getContractFactory(
    "ParticipantManager",
    {
      libraries: {
        InvitationChecker: await invitationChecker.getAddress(),
        PubKeyChecker: await pubKeyChecker.getAddress(),
      },
    }
  );
  const participantManager = await ParticipantManager.deploy();

  const ParticipantManagerFactory = await ethers.getContractFactory(
    "ParticipantManagerFactory"
  );
  const participantManagerFactory = await ParticipantManagerFactory.deploy(
    await participantManager.getAddress()
  );

  const BucketFactory = await ethers.getContractFactory("BucketFactory", {});
  const bucketFactory = await BucketFactory.deploy(
    await bucket.getAddress(),
    await element.getAddress(),
    await participantManagerFactory.getAddress()
  );

  const CreditChecker = await ethers.getContractFactory("CreditChecker");
  const creditChecker = await CreditChecker.deploy();

  const Space = await ethers.getContractFactory("Space", {
    libraries: {
      PubKeyChecker: await pubKeyChecker.getAddress(),
    },
  });

  const space = await Space.deploy();

  const MultiSpaces = await ethers.getContractFactory("MultiSpaces", {
    libraries: {
      CreditChecker: await creditChecker.getAddress(),
    },
  });

  const multiSpaces = await MultiSpaces.deploy(
    await bucketFactory.getAddress(),
    await participantManagerFactory.getAddress(),
    await space.getAddress()
  );

  await bucketFactory.transferOwnership(await multiSpaces.getAddress());
  await participantManagerFactory.transferOwnership(
    await multiSpaces.getAddress()
  );

  console.log(`Bucket address: ${await bucket.getAddress()}`);
  console.log(`BucketFactory address: ${await bucketFactory.getAddress()}`);
  console.log(`Element address: ${await element.getAddress()}`);
  console.log(
    `ParticipantManager address: ${await participantManager.getAddress()}`
  );
  console.log(
    `ParticipantManagerFactory address: ${await participantManagerFactory.getAddress()}`
  );
  console.log(`CreditChecker address: ${await creditChecker.getAddress()}`);
  console.log(`PubKeyChecker address: ${await pubKeyChecker.getAddress()}`);
  console.log(
    `InvitationChecker address: ${await invitationChecker.getAddress()}`
  );
  console.log(`Space address: ${await space.getAddress()}`);
  console.log(`MultiSpaces address: ${await multiSpaces.getAddress()}`);

  const balanceAfter = await ethers.provider.getBalance(deployer);
  const balanceDiff = balance - balanceAfter; //.sub(balanceAfter);
  console.log(
    "Account balance (after): " + balanceAfter.toString()
    // ethers.utils.formatEther(balanceAfter)
  );
  console.log(
    "Total deployment costs: " + balanceDiff.toString()
    // ethers.utils.formatEther(balanceDiff)
  );

  fs.writeFileSync(
    ".DEPLOYED_ADR",
    `DEPLOYED_CONTRACT_ADR=${await multiSpaces.getAddress()}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
