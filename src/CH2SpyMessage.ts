// **Scenario:**
// The Mina spy headquarters receives messages from agents, typically in batches of 50 to 200 messages. Each message is identified by a unique message number.

// **Requirements:**
// 1. The contract should process batches of transactions and store the highest processed message number.
// 2. Each message contains:
//    - Message number
//    - Message details (private input)
//       - Agent ID (between 0 and 3000)
//       - Agent X coordinate (between 0 and 15000)
//       - Agent Y coordinate (between 5000 and 20000)
//       - Checksum
// 3. Checkpoints:
//    - If Agent ID is zero, no need to check other values, but still a valid message.
//    - If message details are incorrect, discard the message and proceed to the next.
//    - If the message number is not greater than the previous one, consider it a duplicate (process it without detailed checks).
// 4. Run on low-spec hardware, ensuring the circuit size remains low.
// 5. Store the highest processed message number permanently.

import { Field, Struct,Provable, SelfProof, ZkProgram, SmartContract, State, state, method } from "o1js"

// Define the message details structure
export class Message extends Struct({
    agentId: Field,
    xLocation: Field,
    yLocation: Field,
    checksum: Field,
}) {
  agentIdCheck() {
    return this.agentId.equals(0)
  }
  check() {
    return this.agentId.greaterThanOrEqual(0).and(this.agentId.lessThanOrEqual(3000))
      .and(this.xLocation.greaterThanOrEqual(0).and(this.xLocation.lessThanOrEqual(15000))
      .and(this.yLocation.greaterThanOrEqual(5000).and(this.yLocation.lessThanOrEqual(20000))
      .and(this.agentId.add(this.xLocation).add(this.yLocation).equals(this.checksum))))
  }
}

// ===============================================================
export const SpyMaster = ZkProgram({
    name: "spy-master",
    publicInput: Field,
    publicOutput: Field,
    
    methods: {
      init: {
        privateInputs:[],
        method (publicInput: Field) {
          publicInput.assertEquals(0)
          return publicInput
        }
      },
      processMessage: {
          privateInputs: [SelfProof, Message],

          method(messageNumber: Field, earlierProof: SelfProof<Field, Field>, message: Message) {
              earlierProof.verify()
              // If Agent ID is zero, no need to check other values, but still a valid message.
              const checkpoints1 = message.agentIdCheck();
              // If the message number is not greater than the previous one, consider it a duplicate
              const checkpoints2 = earlierProof.publicInput.greaterThan(messageNumber);


              const noNeedCheck = checkpoints1.or(checkpoints2);
              const isValid = noNeedCheck.or(message.check());
              
              // messageNumber.set(msgNumber)
              return Provable.if(
                  isValid,
                  Field,
                  messageNumber,
                  earlierProof.publicOutput
              )
          }
      }
    }
})

// ===============================================================
const { verificationKey } = await SpyMaster.compile();
class SpyMasterProof extends ZkProgram.Proof(SpyMaster) {}

export class SpyMasterContract extends SmartContract {
  @state(Field) highestMessageNumber = State<Field>();

  @method processBatch(proof: SpyMasterProof) {
    proof.verify();

    const messageNumber = this.highestMessageNumber.getAndRequireEquals();
    const calculatedMessageNumber = proof.publicOutput;
    const statement = calculatedMessageNumber.greaterThan(messageNumber);
    
    const newMessageNumber = Provable.if(
      statement,
      Field,
      calculatedMessageNumber,
      messageNumber
    );
    this.highestMessageNumber.set(newMessageNumber);
  }
}
