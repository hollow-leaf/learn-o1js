import { runtimeModule, state, runtimeMethod, RuntimeModule } from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { Field, PublicKey, Experimental, Struct, Poseidon} from "o1js";
import { UInt64 } from "@proto-kit/library"
export const ZkProgram = Experimental.ZkProgram;

export class Message extends Struct({agentId: Field, messageNumber: Field, twelveChar: Field, securityCode: Field }) {}

export class AgentPublicOutput extends Struct({agentId: Field, securityCodeHash: Field, messageNumber: Field }) {}

// The highest message number per agent can be public
// extend the state stored to also include the following fields.
// 1. Current block height
// 2. Transaction sender
// 3. Sender's nonce
export class AgentInfo extends Struct({ messageNumber: Field, securityCodeHash: Field, blockHeight: UInt64, transactionSender: PublicKey, sendersNonce: UInt64 }) {}

// 1. Change your application so that messages and their verification are private
// ans. ZK Program to verify the private message proof
// private message proof
export const privatZKProgram = ZkProgram({
  key: 'private-message',
  publicOutput: AgentPublicOutput,

  methods: {
    processMessage: {
      privateInputs: [Message],
      method(message: Message): AgentPublicOutput {
        const secretHash = Poseidon.hash([message.securityCode]);
        // assert(message.twelveChar.greaterThanOrEqual(Field(100000000000)), "Message too short (min 12 chars)");
        // assert(message.twelveChar.lessThanOrEqual(Field(999999999999)), "Message too long (max 12 chars)");
        return new AgentPublicOutput({
          agentId: message.agentId,  
          securityCodeHash: secretHash,
          messageNumber: message.messageNumber
        });
      }
    },
  },
});
const { verificationKey } = await privatZKProgram.compile();
export class privateProof extends ZkProgram.Proof(privatZKProgram) {}

// Runtime Module
@runtimeModule()
export class PrivateMessagesRuntime extends RuntimeModule<unknown> {
  @state() public agentsMap  = StateMap.from<Field, AgentInfo>(
      Field, 
      AgentInfo
  );
  @state() public agentPub = State.from<PublicKey>(PublicKey);

  @runtimeMethod()
  public initAgent(
      agentId: Field, 
      securityCodeHash: Field
  ): void {
      const sender = this.transaction.sender.value;
      assert(this.agentPub.get().isSome.not(), "agent pub already set");
      this.agentPub.set(sender);

      this.agentsMap.set(agentId, new AgentInfo({ 
        messageNumber: Field(0), 
        securityCodeHash: securityCodeHash,
        blockHeight: UInt64.from(0),
        transactionSender: sender,
        sendersNonce: UInt64.from(0),
        })
      )
  }

  @runtimeMethod()
  public processMessage(messageProof: privateProof){
      messageProof.verify()
      // The AgentID exists in the system
      const proofOutput = new AgentPublicOutput(messageProof.publicOutput);
      assert(this.agentsMap.get(proofOutput.agentId).isSome, "Agent not exist, no agent with id init");
      const agentInfo = new AgentInfo(this.agentsMap.get(proofOutput.agentId).value);
      
      // The security code matches that held for that AgentID
      assert(proofOutput.securityCodeHash.equals(agentInfo.securityCodeHash), "Security code not match");
  
      // The message number is greater than the highest so far for that agent.
      assert(proofOutput.messageNumber.greaterThan(agentInfo.messageNumber), "Message number not greater than the last message number");

      // should update the agent state to store the last message number received.
      this.agentsMap.set(proofOutput.agentId, {
        messageNumber: proofOutput.messageNumber,
        securityCodeHash: proofOutput.securityCodeHash,
        blockHeight: UInt64.from(this.network.block.height),
        transactionSender: this.transaction.sender.value,
        sendersNonce: UInt64.from(this.transaction.nonce.value)
      });
  }
}