import { getAccountKeys } from "../helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import {
  BucketFactory,
  ParticipantManagerFactory,
} from "../../typechain-types";

const { ACCOUNT_0_PUBLIC_KEY, ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS } =
  getAccountKeys();

describe("ParticipantManagerFactory", () => {});
