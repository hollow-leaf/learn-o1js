import {
  SmartContract,
  Gadgets,
  Poseidon,
  Field,
  Bool,
  State,
  state,
  UInt64,
  MerkleMap,
  MerkleMapWitness,
  method,
  PublicKey,
  Provable,
  Mina,
  Struct,
} from 'o1js';

class Message extends Struct({
  sender: PublicKey,
  content: Field,
}) {
  hash(): Field {
    return Poseidon.hash(Message.toFields(this))
  }
}

class MessageContract extends SmartContract {
  // @state(PublicKey) owner = State<PublicKey>();
  @state(Field) mapRoot = State<Field>();
  @state(UInt64) addressCounter = State<UInt64>();

  events = { 'MessageReceived': Field }
  @method
  init() {
    super.init();
    this.addressCounter.set(UInt64.from(0));
    // this.owner.set(this.sender);
    this.mapRoot.set(new MerkleMap().getRoot());
  }

  @method
  onlyOwner(): void {
    // const owner = this.owner.getAndRequireEquals();
    // owner.assertEquals(this.sender);
  }
  @method
  storeEligibleAddress(address: PublicKey, path: MerkleMapWitness): void {
    // Assuming only administrators can call this method to add eligible addresses
    // Check if the address is not already added and the limit is not reached
    // this.onlyOwner();
    this.addressCounter.getAndRequireEquals().assertLessThan(UInt64.from(100), 'Addresses Limit reached');

    // make sure the address is not already added
    const mapRoot = this.mapRoot.getAndRequireEquals();
    const [oldRoot, key] = path.computeRootAndKey(Field(0));

    const addr = new Message({ sender: address, content: Field(0) });
    oldRoot.assertEquals(mapRoot);
    key.assertEquals(addr.hash());
    
    // Store the address in the Merkle Tree
    this.addressCounter.set(this.addressCounter.get().add(UInt64.from(1)));
    this.mapRoot.set(path.computeRootAndKey(Field(1))[0]);
  }

  @method
  validateMessage(message: Field): Bool {
    const msg = [
      Gadgets.and(message, Field(32), 64).equals(Field(32)),
      Gadgets.and(message, Field(16), 64).equals(Field(16)),
      Gadgets.and(message, Field(8), 64).equals(Field(8)),
      Gadgets.and(message, Field(4), 64).equals(Field(4)),
      Gadgets.and(message, Field(2), 64).equals(Field(2)),
      Gadgets.and(message, Field(1), 64).equals(Field(1)),
    ]
    // If flag 1 is true, then flags 2, 3, 4, 5 and 6 must be false.
    const check1 = Provable.if(
      msg[0].equals(true), // flag 1 is true
      msg[1].equals(false).
        and(msg[2].equals(false)).
        and(msg[3].equals(false)).
        and(msg[4].equals(false)).
        and(msg[5].equals(false)),
        Bool(true)
      )
    // If flag 2 is true, then flag 3 must also be true.
      const check2 = Provable.if(
        msg[1].equals(true), // flag 2 is true
        msg[2].equals(true),
        Bool(true)
        )
      // If flag 4 is true, then flags 5 and 6 must be false.
      const check3 = Provable.if(
        msg[3].equals(true), // flag 4 is true
        msg[4].equals(false).
          and(msg[5].equals(false)),
          Bool(true)
        )

      check1.and(check2).and(check3).assertTrue('Invalid message')
      return check1.and(check2).and(check3)
  }
  @method
  storeMessage(address: PublicKey, message: Field, path: MerkleMapWitness): void {
    // Check if the sender is eligible
    this.validateMessage(message)

    const context = Gadgets.rightShift64(message, 6)

    // Check if the sender has not already deposited a message
    const mapRoot = this.mapRoot.getAndRequireEquals();
    const [oldRoot, key] = path.computeRootAndKey(Field(0));
    console.log('oldRoot', oldRoot)
    const addr = new Message({ sender: address, content: Field(0) });
    oldRoot.assertEquals(mapRoot);
    key.assertEquals(addr.hash());

    // // Store the message in the Merkle Tree
    // const newMessage = new Message({ sender, content: context });
    // this.mapRoot.set(path.computeRootAndKey(newMessage.hash())[0]);
    // console.log('newMessage', newMessage)
    // // Emit an event
    // this.emitEvent('MessageReceived', { sender, message });
  }
}

export { MessageContract, Message};