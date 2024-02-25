import { SpyMaster, SpyMasterContract, Message } from './CH2SpyMessage.js'
import { Field, Mina, PrivateKey, PublicKey, AccountUpdate } from 'o1js';

let proofsEnabled = false;
function randomNumner (min:number, max:number) {
  return Math.floor(Math.random() * (max - min) + min)
}



describe('CH2.SpyMasterContract', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: SpyMasterContract;

  beforeAll(async () => {
    if (proofsEnabled) await SpyMasterContract.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new SpyMasterContract(zkAppAddress)
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  function generateValidMessage(amount: number, start = 0): {messageNumber: Field, message: Message} [] {
    let messages: {messageNumber: Field, message: Message} [] = []
    for (let i = 0; i < amount; i++) {
      const agentId = randomNumner(1, 3000)
      const xLocation = randomNumner(1, 15000)
      const yLocation = randomNumner(5000, 20000)
      const checksum = agentId + xLocation + yLocation
  
      messages.push({
        messageNumber: Field(i + start),
        message: new Message({
          agentId: Field(agentId),
          xLocation: Field(xLocation),
          yLocation: Field(yLocation),
          checksum: Field(checksum)
        })
      })
    }
    return messages; 
  }

  describe('spy master', () => {
    it('process valid messages', async () => {
      await localDeploy();
      await SpyMaster.compile()
      let proof = await SpyMaster.init(Field(0));

      const messages = generateValidMessage(3)

      for (const msg of messages) {
        proof = await SpyMaster.processMessage(msg.messageNumber, proof, msg.message);
      }

      let txn = await Mina.transaction(deployerAccount, () => {
          zkApp.processBatch(proof);
      });
      await txn.prove();
      await txn.sign([deployerKey]).send();

      expect(zkApp.highestMessageNumber.get()).toEqual(Field(2)); // 0 1 2
    });
  })

  
  it('process messages with agentId = 0', async () => {
    await localDeploy();
    await SpyMaster.compile()
    let proof = await SpyMaster.init(Field(0));

    const messages = [{
      messageNumber: Field(1), 
      message: new Message({
        agentId: Field(0),
        // invalid xLocation, yLocation, checksum
        xLocation: Field(15001),
        yLocation: Field(0),
        checksum: Field(0)
      })
    }]

    for (const msg of messages) {
      proof = await SpyMaster.processMessage(msg.messageNumber, proof, msg.message);
    }

    let txn = await Mina.transaction(deployerAccount, () => {
        zkApp.processBatch(proof);
    });
    await txn.prove();
    await txn.sign([deployerKey]).send();

    expect(zkApp.highestMessageNumber.get()).toEqual(Field(1));
  });

  it('process messages with consider is duplicate', async () => {
    await localDeploy();
    await SpyMaster.compile()
    let proof = await SpyMaster.init(Field(0));

    const messages = generateValidMessage(2, 5)
    
    for (const msg of messages) {
      proof = await SpyMaster.processMessage(msg.messageNumber, proof, msg.message);
    }

    let txn = await Mina.transaction(deployerAccount, () => {
        zkApp.processBatch(proof);
    });
    await txn.prove();
    await txn.sign([deployerKey]).send();

    const newMessage = [{
      messageNumber: Field(1),
      message: new Message({
        agentId: Field(1),
        xLocation: Field(100),
        yLocation: Field(5001),
        checksum: Field(5102)
      })
    }]

    for (const msg of newMessage) {
      proof = await SpyMaster.processMessage(msg.messageNumber, proof, msg.message);
    }

    expect(zkApp.highestMessageNumber.get()).toEqual(Field(6)); // 5 6
  });

  it('process messages: message details are incorrect, discard the message and proceed to the next.', async () => {
    await localDeploy();
    await SpyMaster.compile()
    let proof = await SpyMaster.init(Field(0));
    // 1 invalid message, 2 valid message
    const messages = [{
      messageNumber: Field(0),
      // invalid xLocation, yLocation, checksum
      message: new Message({
        agentId: Field(1),
        xLocation: Field(100),
        yLocation: Field(5001),
        checksum: Field(0) // invalid checksum
      })
    }, {
      messageNumber: Field(1),
      message: new Message({
        agentId: Field(2),
        xLocation: Field(100),
        yLocation: Field(5001),
        checksum: Field(5103)
      })
    }]

    for (const msg of messages) {
      proof = await SpyMaster.processMessage(msg.messageNumber, proof, msg.message);
    }

    let txn = await Mina.transaction(deployerAccount, () => {
        zkApp.processBatch(proof);
    });
    await txn.prove();
    await txn.sign([deployerKey]).send();

    expect(zkApp.highestMessageNumber.get()).toEqual(Field(1)); 
  })
})
