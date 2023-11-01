import { getAccountKeys } from "./helpers/keys.helper";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { ParticipantManager } from "../typechain-types";

const {
  ACCOUNT_0_PUBLIC_KEY,
  ACCOUNT_0_ADDRESS,
  ACCOUNT_1_ADDRESS,
  ACCOUNT_1_PUBLIC_KEY,
  ACCOUNT_2_ADDRESS,
} = getAccountKeys();

describe("ParticipantManager", () => {
  const adminRoleHash = ethers.ZeroHash;
  const requestorRoleHash = ethers.id("REQUESTOR");
  const participantRoleHash = ethers.id("PARTICIPANT");
  const updaterRoleHash = ethers.id("UPDATER");
  const managerRoleHash = ethers.id("MANAGER");
  const ownerRoleHash = ethers.id("OWNER");
  let instance: ParticipantManager;

  beforeEach(async () => {
    const CreditChecker = await hre.ethers.getContractFactory("CreditChecker");
    const creditChecker = await CreditChecker.deploy();

    const PaymentManager = await hre.ethers.getContractFactory(
      "PaymentManager",
      {
        libraries: {
          CreditChecker: await creditChecker.getAddress(),
        },
      }
    );

    const paymentManager = await PaymentManager.deploy(
      1000000000000000,
      100,
      1000000000000
    );

    const InvitationChecker = await hre.ethers.getContractFactory(
      "InvitationChecker"
    );
    const invitationChecker = await InvitationChecker.deploy();

    const PubKeyChecker = await hre.ethers.getContractFactory("PubKeyChecker");
    const pubKeyChecker = await PubKeyChecker.deploy();

    const ParticipantManager = await hre.ethers.getContractFactory(
      "ParticipantManager",
      {
        libraries: {
          InvitationChecker: await invitationChecker.getAddress(),
          PubKeyChecker: await pubKeyChecker.getAddress(),
        },
      }
    );
    instance = await ParticipantManager.deploy();
    await instance.initialize(
      "Peter Parker",
      ACCOUNT_0_ADDRESS,
      ACCOUNT_0_PUBLIC_KEY,
      await paymentManager.getAddress()
    );
  });

  describe("Roles", () => {
    it("PARTICIPANT_ROLE", async () => {
      const roleHash = await instance.ALL_ROLES(0);
      expect(participantRoleHash).to.be.eq(roleHash);
    });

    it("UPDATER_ROLE", async () => {
      const roleHash = await instance.ALL_ROLES(1);
      expect(updaterRoleHash).to.be.eq(roleHash);
    });

    it("MANAGER_ROLE", async () => {
      const roleHash = await instance.ALL_ROLES(2);
      expect(managerRoleHash).to.be.eq(roleHash);
    });

    it("OWNER_ROLE", async () => {
      const roleHash = await instance.ALL_ROLES(3);
      expect(ownerRoleHash).to.be.eq(roleHash);
    });

    it("ADMIN_ROLE", async () => {
      const roleHash = await instance.DEFAULT_ADMIN_ROLE();
      expect(adminRoleHash).to.be.eq(roleHash);
    });
  });

  describe("After deployment", () => {
    it("deployer has DEFAULT_ADMIN_ROLE", async () => {
      const hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_0_ADDRESS);
      expect(hasRole).to.be.true;
    });

    it("deployer has PARTICIPANT_ROLE", async () => {
      const hasRole = await instance.hasRole(
        participantRoleHash,
        ACCOUNT_0_ADDRESS
      );
      expect(hasRole).to.be.true;
    });

    it("deployer has UPDATER_ROLE", async () => {
      const hasRole = await instance.hasRole(
        updaterRoleHash,
        ACCOUNT_0_ADDRESS
      );
      expect(hasRole).to.be.true;
    });

    it("deployer has MANAGER_ROLE", async () => {
      const hasRole = await instance.hasRole(
        managerRoleHash,
        ACCOUNT_0_ADDRESS
      );
      expect(hasRole).to.be.true;
    });

    it("deployer has OWNER_ROLE", async () => {
      const hasRole = await instance.hasRole(ownerRoleHash, ACCOUNT_0_ADDRESS);
      expect(hasRole).to.be.true;
    });

    it("deployer's address is saved", async () => {
      const deployer = await instance.allParticipantAddresses(0);
      expect(deployer).to.eq(ACCOUNT_0_ADDRESS);
    });

    it("deployer's data is valid", async () => {
      const participant = await instance.allParticipants(ACCOUNT_0_ADDRESS);
      expect(participant[0]).to.eq(ACCOUNT_0_ADDRESS);
      expect(participant[1]).to.eq("Peter Parker");
      expect(participant[2]).to.eq(ACCOUNT_0_PUBLIC_KEY);
      expect(participant[3]).to.eq(true);
    });
  });

  describe("Removing participation", () => {
    it("removes all roles for participant", async () => {
      await instance.removeParticipation(ACCOUNT_0_ADDRESS);
      let hasRole = await instance.hasRole(
        participantRoleHash,
        ACCOUNT_0_ADDRESS
      );
      expect(hasRole).to.be.false;
      hasRole = await instance.hasRole(updaterRoleHash, ACCOUNT_0_ADDRESS);
      expect(hasRole).to.be.false;
      hasRole = await instance.hasRole(managerRoleHash, ACCOUNT_0_ADDRESS);
      expect(hasRole).to.be.false;
      hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_0_ADDRESS);
      expect(hasRole).to.be.true;
      hasRole = await instance.hasRole(ownerRoleHash, ACCOUNT_0_ADDRESS);
      expect(hasRole).to.be.false;
    });

    it("removes participant from all participants", async () => {
      await instance.removeParticipation(ACCOUNT_0_ADDRESS);
      const result = await instance.allParticipants(ACCOUNT_0_ADDRESS);
      expect(result[0]).to.eq(ethers.ZeroAddress);
      expect(result[1]).to.eq("");
      expect(result[2]).to.eq("0x");
      expect(result[3]).to.be.false;
    });

    it("emits RemoveOwner event", async () => {
      const response = await instance.removeParticipation(ACCOUNT_0_ADDRESS);
      expect(response).to.emit(instance, "RemoveParticipant");
    });
  });

  describe("Requesting participation", () => {
    it("works as expected", async () => {
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );
      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_1_ADDRESS)
      ).signMessage(hash);
      await instance.requestParticipation(
        name,
        ACCOUNT_1_ADDRESS,
        signResult,
        ACCOUNT_1_PUBLIC_KEY
      );

      const address = await instance.allRequestorAddresses(0);
      const request = await instance.allRequests(ACCOUNT_1_ADDRESS);
      const participant = await instance.allParticipants(ACCOUNT_1_ADDRESS);
      expect(address).to.eq(ACCOUNT_1_ADDRESS);
      expect(request[2]).to.eq(false);
      expect(participant[0]).to.eq(ACCOUNT_1_ADDRESS);
      expect(participant[1]).to.eq(name);
      expect(participant[2]).to.eq(ACCOUNT_1_PUBLIC_KEY);
      expect(participant[3]).to.eq(true);
      const hasRole = await instance.hasRole(
        requestorRoleHash,
        ACCOUNT_1_ADDRESS
      );
      expect(hasRole).to.eq(true);
    });

    it("fails for existing participant", async () => {
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      await expect(
        instance.requestParticipation(
          name,
          ACCOUNT_0_ADDRESS,
          signResult,
          ACCOUNT_0_PUBLIC_KEY
        )
      ).to.be.revertedWith(new RegExp(/User exists/));
    });

    it("fails for invalid signature", async () => {
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      await expect(
        instance.requestParticipation(
          name,
          ACCOUNT_1_ADDRESS,
          signResult,
          ACCOUNT_1_PUBLIC_KEY
        )
      ).to.be.revertedWith(new RegExp(/Invalid request/));
    });

    it("emits AddRequestor event", async () => {
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_1_ADDRESS)
      ).signMessage(hash);
      const response = await instance.requestParticipation(
        name,
        ACCOUNT_1_ADDRESS,
        signResult,
        ACCOUNT_1_PUBLIC_KEY
      );

      expect(response).to.emit(instance, "AddRequestor");
    });
  });

  describe("Accepting participation", () => {
    it("works as expected", async () => {
      const name = "requestor";
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(["string"], [name])
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_1_ADDRESS)
      ).signMessage(hash);
      await instance.requestParticipation(
        name,
        ACCOUNT_1_ADDRESS,
        signResult,
        ACCOUNT_1_PUBLIC_KEY
      );

      await instance.acceptParticipation(ACCOUNT_1_ADDRESS, ACCOUNT_0_ADDRESS);

      const request = await instance.allRequests(ACCOUNT_1_ADDRESS);
      const participant = await instance.allParticipants(ACCOUNT_1_ADDRESS);
      expect(request[1]).to.eq(ACCOUNT_0_ADDRESS);
      expect(request[2]).to.eq(true);
      expect(participant[0]).to.eq(ACCOUNT_1_ADDRESS);
      expect(participant[1]).to.eq(name);
      expect(participant[2]).to.eq(ACCOUNT_1_PUBLIC_KEY);
      expect(participant[3]).to.eq(true);
      let hasRole = await instance.hasRole(
        requestorRoleHash,
        ACCOUNT_1_ADDRESS
      );
      expect(hasRole).to.eq(false);
      hasRole = await instance.hasRole(participantRoleHash, ACCOUNT_1_ADDRESS);
      expect(hasRole).to.eq(true);
    });
  });

  // describe("Redeeming participation code", () => {
  //   it("only works if inviter is manager", async () => {
  //     await instance.renounceRole(managerRoleHash, ACCOUNT_0_ADDRESS);
  //     await expect(
  //       instance.redeemParticipationCode(
  //         "Paul",
  //         ACCOUNT_0_ADDRESS,
  //         ACCOUNT_1_ADDRESS,
  //         "0x00",
  //         "randomCode",
  //         ACCOUNT_1_PUBLIC_KEY
  //       )
  //     ).to.be.revertedWith(new RegExp(/Forbidden/));
  //   });

  //   it("only works if sender is admin", async () => {
  //     await expect(
  //       instance
  //         .connect(await hre.ethers.getSigner(ACCOUNT_1_ADDRESS))
  //         .redeemParticipationCode(
  //           "Paul",
  //           ACCOUNT_0_ADDRESS,
  //           ACCOUNT_1_ADDRESS,
  //           "0x00",
  //           "randomCode",
  //           ACCOUNT_1_PUBLIC_KEY
  //         )
  //     ).to.be.revertedWith(new RegExp(/is missing role/));
  //   });

  //   it("works as expected", async () => {
  //     const randomCode = "This is a random invitation code";
  //     const hash = hre.ethers.utils.arrayify(
  //       hre.ethers.utils.solidityPackedKeccak256(["string"], [randomCode])
  //     );

  //     // prefixes automatically with \x19Ethereum Signed Message:\n32
  //     const signResult = await (
  //       await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
  //     ).signMessage(hash);
  //     console.log(signResult);
  //     await instance.redeemParticipationCode(
  //       "Paul",
  //       ACCOUNT_0_ADDRESS,
  //       ACCOUNT_1_ADDRESS,
  //       signResult,
  //       randomCode,
  //       ACCOUNT_1_PUBLIC_KEY
  //     );
  //     const result = await instance.allParticipants(ACCOUNT_1_ADDRESS);
  //     expect(result[0]).to.eq(ACCOUNT_1_ADDRESS);
  //     expect(result[1]).to.eq("Paul");
  //     expect(result[2]).to.eq(ACCOUNT_1_PUBLIC_KEY);
  //     expect(result[3]).to.eq(true);
  //     let hasRole = await instance.hasRole(ownerRoleHash, ACCOUNT_1_ADDRESS);
  //     expect(hasRole).to.be.false;
  //     hasRole = await instance.hasRole(participantRoleHash, ACCOUNT_1_ADDRESS);
  //     expect(hasRole).to.be.true;
  //     hasRole = await instance.hasRole(updaterRoleHash, ACCOUNT_1_ADDRESS);
  //     expect(hasRole).to.be.false;
  //     hasRole = await instance.hasRole(managerRoleHash, ACCOUNT_1_ADDRESS);
  //     expect(hasRole).to.be.false;
  //     hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_1_ADDRESS);
  //     expect(hasRole).to.be.false;
  //     const deployer = await instance.allParticipantAddresses(1);
  //     expect(deployer).to.eq(ACCOUNT_1_ADDRESS);
  //   });

  //   it("emits event AddParticipant", async () => {
  //     const randomCode = "This is a random invitation code";
  //     const hash = hre.ethers.utils.arrayify(
  //       hre.ethers.utils.solidityPackedKeccak256(["string"], [randomCode])
  //     );

  //     // prefixes automatically with \x19Ethereum Signed Message:\n32
  //     const signResult = await (
  //       await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
  //     ).signMessage(hash);
  //     const response = await instance.redeemParticipationCode(
  //       "Paul",
  //       ACCOUNT_0_ADDRESS,
  //       ACCOUNT_1_ADDRESS,
  //       signResult,
  //       randomCode,
  //       ACCOUNT_1_PUBLIC_KEY
  //     );
  //     expect(response).to.emit(instance, "AddParticipant");
  //   });

  //   it("fails for already redeemed code", async () => {
  //     const randomCode = "This is a random invitation code";
  //     const hash = hre.ethers.utils.arrayify(
  //       hre.ethers.utils.solidityPackedKeccak256(["string"], [randomCode])
  //     );

  //     // prefixes automatically with \x19Ethereum Signed Message:\n32
  //     const signResult = await (
  //       await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
  //     ).signMessage(hash);
  //     await instance.redeemParticipationCode(
  //       "Paul",
  //       ACCOUNT_0_ADDRESS,
  //       ACCOUNT_1_ADDRESS,
  //       signResult,
  //       randomCode,
  //       ACCOUNT_1_PUBLIC_KEY
  //     );
  //     await expect(
  //       instance.redeemParticipationCode(
  //         "Paul",
  //         ACCOUNT_0_ADDRESS,
  //         ACCOUNT_2_ADDRESS,
  //         signResult,
  //         randomCode,
  //         ACCOUNT_1_PUBLIC_KEY
  //       )
  //     ).to.be.revertedWith(new RegExp(/Already used/));
  //   });

  //   it("fails if user already exists", async () => {
  //     const randomCode = "This is a random invitation code";
  //     const hash = hre.ethers.utils.arrayify(
  //       hre.ethers.utils.solidityPackedKeccak256(["string"], [randomCode])
  //     );

  //     // prefixes automatically with \x19Ethereum Signed Message:\n32
  //     const signResult = await (
  //       await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
  //     ).signMessage(hash);
  //     await instance.redeemParticipationCode(
  //       "Paul",
  //       ACCOUNT_0_ADDRESS,
  //       ACCOUNT_1_ADDRESS,
  //       signResult,
  //       randomCode,
  //       ACCOUNT_1_PUBLIC_KEY
  //     );
  //     await expect(
  //       instance.redeemParticipationCode(
  //         "Paul",
  //         ACCOUNT_0_ADDRESS,
  //         ACCOUNT_1_ADDRESS,
  //         signResult,
  //         randomCode,
  //         ACCOUNT_1_PUBLIC_KEY
  //       )
  //     ).to.be.revertedWith(new RegExp(/User exists/));
  //   });
  // });

  describe("Sessions", () => {
    it("can be created", async () => {
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(
          ["address", "address", "uint256", "bytes"],
          [ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS, 100, new Uint8Array(10)]
        )
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);
      await instance.createSession(
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        100,
        new Uint8Array(10),
        signResult
      );
    });

    it("can be revoked", async () => {
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(
          ["address", "address", "uint256", "bytes"],
          [ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS, 100, new Uint8Array(10)]
        )
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);
      await instance.createSession(
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        100,
        new Uint8Array(10),
        signResult
      );

      const hash2 = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(
          ["address", "address"],
          [ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS]
        )
      );
      const signResult2 = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash2);

      await instance.revokeSession(
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        signResult2
      );
    });

    it("gives role to session holder when created", async () => {
      let hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_0_ADDRESS);
      expect(hasRole).to.be.true;

      hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_1_ADDRESS);
      expect(hasRole).to.be.false;

      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(
          ["address", "address", "uint256", "bytes"],
          [ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS, 100, new Uint8Array(10)]
        )
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      await instance.createSession(
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        100,
        new Uint8Array(10),
        signResult
      );

      hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_1_ADDRESS);
      expect(hasRole).to.be.true;
    });

    it("removes role from session holder when revoked", async () => {
      const hash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(
          ["address", "address", "uint256", "bytes"],
          [ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS, 100, new Uint8Array(10)]
        )
      );

      // prefixes automatically with \x19Ethereum Signed Message:\n32
      const signResult = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(hash);

      await instance.createSession(
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        100,
        new Uint8Array(10),
        signResult
      );

      let hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_1_ADDRESS);
      expect(hasRole).to.be.true;

      const logoutHash = hre.ethers.getBytes(
        hre.ethers.solidityPackedKeccak256(
          ["address", "address"],
          [ACCOUNT_0_ADDRESS, ACCOUNT_1_ADDRESS]
        )
      );
      const signResult2 = await (
        await hre.ethers.getSigner(ACCOUNT_0_ADDRESS)
      ).signMessage(logoutHash);

      await instance.revokeSession(
        ACCOUNT_0_ADDRESS,
        ACCOUNT_1_ADDRESS,
        signResult2
      );

      hasRole = await instance.hasRole(adminRoleHash, ACCOUNT_1_ADDRESS);
      expect(hasRole).to.be.false;
    });
  });
});
