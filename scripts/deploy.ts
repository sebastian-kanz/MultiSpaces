import { ethers } from "hardhat";
import * as fs from "fs";
import { getAccountKeys } from "../test/helpers/keys.helper";
const hre = require("hardhat");
const { ACCOUNT_0_ADDRESS } = getAccountKeys();

async function main() {
  await hre.storageLayout.export();
  let receipt;
  let fee = 0;
  let gasUsed = 0;
  const network = await ethers.provider.getNetwork();
  console.log(
    `Starting deployment for network: ${network.name}(${network.chainId})`
  );
  const deployer = await ethers.getSigner(ACCOUNT_0_ADDRESS ?? "");
  const balance = await ethers.provider.getBalance(ACCOUNT_0_ADDRESS);
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance (before): ", ethers.formatEther(balance));

  console.log(`Deploying Element...`);
  const Element = await ethers.getContractFactory("Element");
  const element = await Element.deploy();
  await element.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    element.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await element.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying Bucket...`);
  const Bucket = await ethers.getContractFactory("Bucket");
  const bucket = await Bucket.deploy();
  await bucket.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    bucket.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await bucket.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying InvitationChecker ...`);
  const InvitationChecker = await ethers.getContractFactory(
    "InvitationChecker"
  );
  const invitationChecker = await InvitationChecker.deploy();
  await invitationChecker.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    invitationChecker.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await invitationChecker.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying PubKeyChecker ...`);
  const PubKeyChecker = await ethers.getContractFactory("PubKeyChecker");
  const pubKeyChecker = await PubKeyChecker.deploy();
  await pubKeyChecker.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    pubKeyChecker.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await pubKeyChecker.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying ParticipantManager ...`);
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
  await participantManager.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    participantManager.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await participantManager.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying ParticipantManagerFactory ...`);
  const ParticipantManagerFactory = await ethers.getContractFactory(
    "ParticipantManagerFactory"
  );
  const participantManagerFactory = await ParticipantManagerFactory.deploy(
    await participantManager.getAddress()
  );
  await participantManagerFactory.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    participantManagerFactory.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await participantManagerFactory.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying BucketFactory ...`);
  const BucketFactory = await ethers.getContractFactory("BucketFactory", {});
  const bucketFactory = await BucketFactory.deploy(
    await bucket.getAddress(),
    await element.getAddress(),
    await participantManagerFactory.getAddress()
  );
  await bucketFactory.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    bucketFactory.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await bucketFactory.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying CreditChecker ...`);
  const CreditChecker = await ethers.getContractFactory("CreditChecker");
  const creditChecker = await CreditChecker.deploy();
  await creditChecker.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    creditChecker.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await creditChecker.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying Space ...`);
  const Space = await ethers.getContractFactory("Space", {
    libraries: {
      PubKeyChecker: await pubKeyChecker.getAddress(),
    },
  });
  const space = await Space.deploy();
  await space.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    space.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await space.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Deploying MultiSpaces ...`);
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
  await multiSpaces.waitForDeployment();
  receipt = await ethers.provider.getTransactionReceipt(
    multiSpaces.deploymentTransaction()?.hash ?? ""
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Deployed: ${await multiSpaces.getAddress()}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  console.log(`Managing ownership ...`);
  const bucketFactoryOwnershipTx = await bucketFactory.transferOwnership(
    await multiSpaces.getAddress()
  );
  await bucketFactoryOwnershipTx.wait();
  console.log(`> Tx: ${bucketFactoryOwnershipTx.hash}`);
  receipt = await ethers.provider.getTransactionReceipt(
    bucketFactoryOwnershipTx.hash
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  const participantManagerFactoryOwnershipTx =
    await participantManagerFactory.transferOwnership(
      await multiSpaces.getAddress()
    );
  await participantManagerFactoryOwnershipTx.wait();
  console.log(`> Tx: ${participantManagerFactoryOwnershipTx.hash}`);
  receipt = await ethers.provider.getTransactionReceipt(
    participantManagerFactoryOwnershipTx.hash
  );
  gasUsed += Number(receipt?.gasUsed ?? 0);
  fee += Number(receipt?.gasUsed ?? 0) * Number(receipt?.gasPrice ?? 0);
  console.log(`> Receipt: ${receipt?.hash}`);
  console.log(`> Gas used: ${Number(receipt?.gasUsed ?? 0)}`);
  console.log(`> Gas price: ${Number(receipt?.gasPrice ?? 0)}`);
  console.log(
    `-------------------------------------------------------------------`
  );

  const balanceAfter = await ethers.provider.getBalance(deployer);
  const balanceDiff = balance - balanceAfter;
  console.log(
    "Account balance (after): " + ethers.formatEther(balance).toString()
  );

  console.log(
    "Total deployment costs: " + ethers.formatEther(balanceDiff).toString()
  );
  console.log("Total gas: " + gasUsed);
  console.log("Total fee: " + fee);

  fs.writeFileSync(
    ".DEPLOYED_ADR",
    `DEPLOYED_CONTRACT_ADR=${await multiSpaces.getAddress()}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
