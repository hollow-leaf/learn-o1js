import { TestingAppChain } from "@proto-kit/sdk";
import { Field, PrivateKey } from "o1js";
import { Message, MessagesRuntime} from "../src/CH3";
import { log } from "@proto-kit/common";

log.setLevel("ERROR");

// generate random Message Array
function generateValidMessage(amount: number, start = 0): {message: Message} [] {
  let messages: {message: Message} [] = []
  const agentId = Field(1)
  for (let i = 0; i < amount; i++) {
    const messageNumber = Field(i + start + 1)
    // 12 chars should be random
    const twelveChar = Field(Math.floor(Math.random() * (999999999999 - 100000000000) + 100000000000))
    const securityCode = Field(12345)
    messages.push({
      message: new Message({
        agentId,
        messageNumber,
        twelveChar,
        securityCode
      })
    })
  }
  return messages
}

const notExistAgent = generateValidMessage(1, 0)[0]
notExistAgent.message.agentId = Field(2)

const wrongSecurity = generateValidMessage(1, 0)[0]
wrongSecurity.message.securityCode = Field(12346)

const tooShortMessage = generateValidMessage(1, 0)[0]
tooShortMessage.message.twelveChar = Field(1234567890)

const tooLongMessage = generateValidMessage(1, 0)[0]
tooLongMessage.message.twelveChar = Field(12345678901234567890)


describe("CH3.MessagesRuntime", () => {
  const appChain = TestingAppChain.fromRuntime({
    MessagesRuntime,
  });
  
  appChain.configurePartial({
    Runtime: {
      MessagesRuntime: {},
      Balances: {},
    },
  });
  
  let messagesRuntime: MessagesRuntime;
  const alicePrivateKey = PrivateKey.random();
  const alice = alicePrivateKey.toPublicKey();

  beforeAll(async () => {
    await appChain.start();
    appChain.setSigner(alicePrivateKey);
    messagesRuntime = appChain.runtime.resolve("MessagesRuntime");
    // init an agent
    const tx = await appChain.transaction(alice, () => {
      messagesRuntime.initAgent(Field(1), Field(12345));
    });
    await tx.sign();
    await tx.send();
    await appChain.produceBlock();
  });

  describe("The AgentID exists in the system", () => {
    it("processes valid message", async () => {
      const tx = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(generateValidMessage(1, 0)[0].message);
      });
      await tx.sign();
      await tx.send();
      const block = await appChain.produceBlock();

      const agentInfo = await appChain.query.runtime.MessagesRuntime.agentsMap.get(Field(1));
      expect(block?.transactions[0].status.toBoolean()).toBe(true);

      expect(agentInfo?.messageNumber).toEqual(Field(1));
    });

    it("agent does not exist", async () => {
      const tx = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(notExistAgent.message);
      });
      await tx.sign();
      await tx.send();
      const block = await appChain.produceBlock();

      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe("Agent not exist, no agent with id init");
    });
  });

  describe("The security code matches that held for that AgentID", () => {
    it("wrong security code", async () => {
      const tx = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(wrongSecurity.message);
      });
      await tx.sign();
      await tx.send();
      const block = await appChain.produceBlock();

      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe("Security code not match");
    });
  });

  describe("The message is of the correct length", () => {
    it("message too short or too long", async () => {
      const tx1 = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(tooShortMessage.message);
      });
      await tx1.sign();
      await tx1.send();
      const block1 = await appChain.produceBlock();

      expect(block1?.transactions[0].status.toBoolean()).toBe(false);
      expect(block1?.transactions[0].statusMessage).toBe("Message too short (min 12 chars)");

      const tx2 = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(tooLongMessage.message);
      });
      await tx2.sign();
      await tx2.send();
      const block2 = await appChain.produceBlock();
  
      expect(block2?.transactions[0].status.toBoolean()).toBe(false);
      expect(block2?.transactions[0].statusMessage).toBe("Message too long (max 12 chars)");
    });
  });
  
  describe("The message number is greater than the highest so far for that agent", () => {
    it("processes message with a message number greater than the last message number", async () => {
      const msgs = generateValidMessage(2, 0)
      const tx = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(msgs[0].message);
      });
      await tx.sign();
      await tx.send();
      await appChain.produceBlock();
      
      const tx2 = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(msgs[1].message);
      });
      await tx2.sign();
      await tx2.send();
      const block = await appChain.produceBlock();
      
      expect(block?.transactions[0].status.toBoolean()).toBe(true);
    });
    
    it("does not process message with a message number already processed", async () => {
      const msgs = generateValidMessage(2, 0)
      const tx = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(msgs[0].message);
      });
      await tx.sign();
      await tx.send();
      await appChain.produceBlock();

      const tx2 = await appChain.transaction(alice, () => {
        messagesRuntime.processMessage(msgs[0].message);
      });
      await tx2.sign();
      await tx2.send();
      const block = await appChain.produceBlock();
      
      expect(block?.transactions[0].status.toBoolean()).toBe(false);
      expect(block?.transactions[0].statusMessage).toBe("Message number not greater than the last message number");
    });
  });
});