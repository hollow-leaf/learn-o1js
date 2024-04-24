import { Field, Poseidon, PrivateKey } from "o1js";
import { TestingAppChain } from "@proto-kit/sdk";
import { log } from "@proto-kit/common";
import { PrivateMessagesRuntime, privatZKProgram, privateProof } from "../src/CH4";

log.setLevel("ERROR");
// generate random Message Array
async function generateValidMessage(amount: number, start = 0, agentId = Field(1), securityCode = Field(12)): Promise<{proof: privateProof} []>{
  let messages: {proof: privateProof} [] = []
  for (let i = 0; i < amount; i++) {
    const messageNumber = Field(i + start + 1)
    // 12 chars should be random
    const twelveChar = Field(Math.floor(Math.random() * (999999999999 - 100000000000) + 100000000000))
    // 2 char code

    messages.push({
      proof: await privatZKProgram.processMessage({
        agentId,
        messageNumber,
        twelveChar,
        securityCode
      })
    })
  }
  return messages
}

describe("CH4.PrivateMessagesRuntime", () => {

  const appChain = TestingAppChain.fromRuntime({
    PrivateMessagesRuntime
  });
  appChain.configurePartial({
    Runtime: {
      PrivateMessagesRuntime: {},
      Balances: {},
    },
  });
  let privateMessagesRuntime: PrivateMessagesRuntime;
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();

  beforeAll(async () => {
    await appChain.start();
    appChain.setSigner(alicePrivateKey);
    privateMessagesRuntime = appChain.runtime.resolve("PrivateMessagesRuntime");
    // init an agent
    const securityCodeHash = Poseidon.hash([Field(12)]);
    const tx = await appChain.transaction(alice, () => {
      privateMessagesRuntime.initAgent(Field(1), securityCodeHash);
    });
    await tx.sign();
    await tx.send();
    await appChain.produceBlock();
  });

  describe("1. The AgentID exists in the system", () => {
    
    it("agent pub already set", async () => {
      const tx = await appChain.transaction(alice, () => {
        privateMessagesRuntime.initAgent(
          Field(1),
          Poseidon.hash([Field(12)])
        );
      });
      await tx.sign();
      await tx.send();

      const block = await appChain.produceBlock();
      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe("agent pub already set");
      });
    });
    
    it("agent does not exist", async () => {
      const notExistAgent = (await generateValidMessage(1, 0, Field(0), Field(12)))[0]
      const tx = await appChain.transaction(alice, () => {
        privateMessagesRuntime.processMessage(notExistAgent.proof);
      });
      await tx.sign();
      await tx.send();
      const block = await appChain.produceBlock();

      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe("Agent not exist, no agent with id init");
    });

  describe("2. The security code matches that held for that AgentID", () => {
    it("wrong security code", async () => {
      const wrongSecurity = (await generateValidMessage(1, 0, Field(1), Field(123456789012)))[0]
      const tx = await appChain.transaction(alice, () => {
        privateMessagesRuntime.processMessage(wrongSecurity.proof);
      });
      await tx.sign();
      await tx.send();
      const block = await appChain.produceBlock();

      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe("Security code not match");
    });
  });

  // describe("3. The message is of the correct length", () => {
  //   it("message too short or too long", async () => {
  //     expect(() => {
  //       privatZKProgram.processMessage({
  //         agentId: Field(1),
  //         messageNumber: Field(1),
  //         twelveChar: Field(10),
  //         securityCode: Field(12)
  //       });
  //     }).toThrow("Message too short (min 12 chars)");
  //   });
  //   it("message too short or too long", async () => {
  //     expect(() => {
  //       privatZKProgram.processMessage({
  //         agentId: Field(1),
  //         messageNumber: Field(1),
  //         twelveChar: Field(1234567890123456),
  //         securityCode: Field(12)
  //       });
  //     }).toThrow("Message too long (max 2 chars)");
  //   });
  // });
  
  describe("4. The message number is greater than the highest so far for that agent", () => {
    it("process message with right number", async () => {
      const msgs = await generateValidMessage(2, 0)
      const tx = await appChain.transaction(alice, () => {
        privateMessagesRuntime.processMessage(msgs[0].proof);
      });
      await tx.sign();
      await tx.send();
      await appChain.produceBlock();
      
      const tx2 = await appChain.transaction(alice, () => {
        privateMessagesRuntime.processMessage(msgs[1].proof);
      });
      await tx2.sign();
      await tx2.send();
      const block = await appChain.produceBlock();
      
      expect(block?.transactions[0].status.toBoolean()).toBe(true);
    });
    
    it("cannot process wrong number already processed", async () => {
      const msgs = await generateValidMessage(2, 0)
      const tx = await appChain.transaction(alice, () => {
        privateMessagesRuntime.processMessage(msgs[0].proof);
      });
      await tx.sign();
      await tx.send();
      await appChain.produceBlock();

      const tx2 = await appChain.transaction(alice, () => {
        privateMessagesRuntime.processMessage(msgs[0].proof);
      });
      await tx2.sign();
      await tx2.send();
      const block = await appChain.produceBlock();
      
      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe("Message number not greater than the last message number");
    });
  });
});