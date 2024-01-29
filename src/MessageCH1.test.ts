import { MessageContract, Message} from './MessageCH1'
import { Gadgets, Field, Mina, PrivateKey, PublicKey, AccountUpdate, MerkleMap, Poseidon } from 'o1js';

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
  describe('Admin(deployer): store address', () => {
    it('store eligible address', async () => {
      await localDeploy();

      const addr = PrivateKey.random().toPublicKey();

      const map = new MerkleMap();
      // only deposit once for each address
      const msg = new Message({ sender: addr, content: Field(0) });
      const path = map.getWitness(msg.pkHash());
      map.set(msg.pkHash(), Field(0));
      // update transaction
      const txn = await Mina.transaction(deployerAccount, () => {
        zkApp.storeEligibleAddress(addr, path);
      });
      await txn.prove();
      await txn.sign([deployerKey]).send();

      const counter = Number(zkApp.addressCounter.get().toBigInt());
      const root = zkApp.mapRoot.get();
      map.set(msg.pkHash(), msg.hash());
      
      expect(counter).toEqual(1);
      expect(root).toEqual(map.getRoot());
    })

    // case: too slow to run in github action almost (181211 ms)
    it('store 100 eligible address', async () => { 
      await localDeploy();
      const map = new MerkleMap();
      for(let i = 0; i < 100; i++) {
        const addr = PrivateKey.random().toPublicKey();
        const msg = new Message({ sender: addr, content: Field(0) });
        const path = map.getWitness(msg.pkHash());
        map.set(msg.pkHash(), Field(0));
        // update transaction
        const txn = await Mina.transaction(deployerAccount, () => {
          zkApp.storeEligibleAddress(addr, path);
        });
        await txn.prove();
        await txn.sign([deployerKey]).send();

        map.set(msg.pkHash(), msg.hash());
      }
    })
  })

  describe('Sender: store message', () => {
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
      map.set(msg.pkHash(), Field(0));
      const txn = await Mina.transaction(deployerAccount, () => {
        zkApp.storeEligibleAddress(addr, map.getWitness(msg.pkHash()));
      });
      await txn.prove();
      await txn.sign([deployerKey]).send();
      map.set(msg.pkHash(), msg.hash());

      const content = Field(55688)
      
      const flag = Field(0b100000) 
      const message = Gadgets.xor(
        Gadgets.leftShift64(content, 6), flag, 64); // assume the message is 64 bits

      const newMsg = new Message({ sender: addr, content: content });
      const txn2 = await Mina.transaction(senderAccount, () => {
        zkApp.storeMessage(addr, message, map.getWitness(msg.pkHash()));
      });
      await txn2.prove();
      await txn2.sign([senderKey]).send();

      map.set(msg.pkHash(), newMsg.hash());
      expect(zkApp.mapRoot.get()).toEqual(map.getRoot());
    })
  })
})