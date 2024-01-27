import { caml_fq_srs_maybe_lagrange_commitment } from 'o1js/dist/node/bindings/compiled/node_bindings/plonk_wasm.cjs';
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
    console.log(counter);
    expect(counter).toEqual(1);
  })

  // it('store less than 100 eligible addresses', async () => {
  //   await localDeploy();
  //   let counter = Number(zkApp.addressCounter.get().toBigInt());
  //   console.log(counter);
  //   for (let i = 0; i < 100; i++) {
  //     const addr = PrivateKey.random().toPublicKey();
  //     console.log('round', i, addr.toBase58());
      
  //     if (i === 0) { const map = new MerkleMap(); }
  //     else { const map = zkApp.mapRoot.get()}
  //     const msg = new Message({ sender: addr, content: Field.from(0) });
  //     const path = map.getWitness(msg.hash());
  //     map.set(msg.hash(), Field(0));
  //     // update transaction
  //     const txn = await Mina.transaction(senderAccount, () => {
  //       zkApp.storeEligibleAddress(addr, path);
  //     });
  //     await txn.prove();
  //     await txn.sign([senderKey]).send();
  //   }

  //   counter = Number(zkApp.addressCounter.get().toBigInt());
  //   console.log(counter);
  //   const map = new MerkleMap();
  //   const msg = new Message({ sender: PrivateKey.random().toPublicKey(), content: Field(0) });
  //   const path = map.getWitness(msg.hash());
  //   map.set(msg.hash(), Field(0));
  //   // update transaction
  //   const txn = await Mina.transaction(senderAccount, () => {
  //     zkApp.storeEligibleAddress(PrivateKey.random().toPublicKey(), path);
  //   });
  //   await txn.prove();
  //   await txn.sign([senderKey]).send();
  // })

  it('user can send a message', async () => {
    await localDeploy();

    // const msg = new Message({ sender: senderAccount, content: Field(0) });
    const content = Field(11111111)
    const flag = Field(0b001100)
    const message = Gadgets.xor(
      Gadgets.leftShift64(content, 6), flag, 70);
    const msg = new Message({ sender: senderAccount, content: content });
    // const path = zkApp.mapRoot.get().getWitness(msg.hash());
    // zkApp.mapRoot.get().set(msg.hash(), Field(0));

    // const txn = await Mina.transaction(senderAccount, () => {
    //   zkApp.storeEligibleAddress(senderAccount, path);
    // });
    // await txn.prove();
    // await txn.sign([senderKey]).send();
  })
})