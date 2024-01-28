import { MessageContract, Message} from './MessageCH1'
import { Gadgets, Field, Mina, PrivateKey, PublicKey, AccountUpdate, MerkleMap } from 'o1js';

let proofsEnabled = false;

describe('MessageContract', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: MessageContract;

  beforeAll(async () => {
    if (proofsEnabled) await MessageContract.compile();
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
    zkApp = new MessageContract(zkAppAddress)
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

  it('store eligible address', async () => {
    await localDeploy();

    const addr = PrivateKey.random().toPublicKey();

    const map = new MerkleMap();
    const msg = new Message({ sender: addr, content: Field(0) });
    const path = map.getWitness(msg.hash());
    map.set(msg.hash(), Field(0));
    // update transaction
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.storeEligibleAddress(addr, path);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const counter = Number(zkApp.addressCounter.get().toBigInt());
    expect(counter).toEqual(1);
  })

  describe('store message', () => {
    it('validate cond1 messages: If flag 1 is true, then all other flags must be false', async () => {
      await localDeploy();
      const content = Field(55688)
      const flag = Field(0b100000) 
      const message = Gadgets.xor(Gadgets.leftShift64(content, 6), flag, 64);
      
      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.validateMessage(message);
      });
      await txn.prove();
      await txn.sign([senderKey]).send();
    })

    it('validate cond2 messages: If flag 2 is true, then flag 3 must also be true.', async () => {
      await localDeploy();
      const content = Field(55688)
      const flag = Field(0b011000) 
      const message = Gadgets.xor(Gadgets.leftShift64(content, 6), flag, 64);

      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.validateMessage(message);
      });
      await txn.prove();
      await txn.sign([senderKey]).send();
    })

    it('validate cond3 messages: If flag 4 is true, then flags 5 and 6 must be false.', async () => {
      await localDeploy();
      const content = Field(55688)
      const flag = Field(0b000100) 
      const message = Gadgets.xor(Gadgets.leftShift64(content, 6), flag, 64);

      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.validateMessage(message);
      });
      await txn.prove();
      await txn.sign([senderKey]).send();
    })

    it('user can store a message', async () => {
      await localDeploy();
      
      const priv = PrivateKey.random()
      const addr = priv.toPublicKey();

      const map = new MerkleMap();
      const msg = new Message({ sender: addr, content: Field(0) });
      map.set(msg.hash(), Field(0));
      const witness = map.getWitness(msg.hash());
      const txn = await Mina.transaction(senderAccount, () => {
        zkApp.storeEligibleAddress(addr, witness);
      });
      await txn.prove();
      await txn.sign([senderKey]).send();


      const content = Field(55688)
      // cond1: 0b100000, cond2: 0b010000, cond3: 0b001000, cond4: 0b000100, cond5: 0b000010, cond6: 0b000001
      const flag = Field(0b100000) 
      console.log(flag)
      console.log(Gadgets.leftShift64(content, 6), flag, 64)
      const message = Gadgets.xor(
        Gadgets.leftShift64(content, 6), flag, 64); // assume the message is 64 bits
        console.log(message)
      const newMsg = new Message({ sender: addr, content: content });
      const txn2 = await Mina.transaction(senderAccount, () => {
        zkApp.storeMessage(addr, message, witness);
      });
      await txn2.prove();
      await txn2.sign([senderKey]).send();
      // const txn2 = await Mina.transaction(addr, () => {
      //   zkApp.storeMessage(addr, Field(0), witness);
      // });
      // await txn2.prove();
      // await txn2.sign([priv]).send();

      // map.set(newMsg.hash(), message);
      // const root = map.getRoot()
      // expect(root).toEqual(zkApp.mapRoot.get());
    })
  })
})