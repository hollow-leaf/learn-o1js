import { runtimeModule, state, runtimeMethod, RuntimeModule } from "@proto-kit/module";
import { StateMap, assert } from "@proto-kit/protocol";
import { Field, Struct } from "o1js";

export class Message extends Struct({agentId: Field, messageNumber: Field, twelveChar: Field, securityCode: Field }) {}

export class AgentInfo extends Struct({ messageNumber: Field, securityCode: Field }) {}

@runtimeModule()
export class MessagesRuntime extends RuntimeModule<unknown> {
  @state() public agentsMap  = StateMap.from<Field, AgentInfo>(
      Field, 
      AgentInfo
  );

  @runtimeMethod()
  public initAgent(
      agentId: Field, 
      securityCode: Field
  ): void {
    assert(securityCode.greaterThanOrEqual(Field(10)), "Message too short (min 2 chars)");
      assert(securityCode.lessThanOrEqual(Field(99)), "Message too long (max 2 chars)");
      const spyInfo = new AgentInfo({ messageNumber: Field(0), securityCode });
      this.agentsMap.set(agentId, spyInfo);
  }

  @runtimeMethod()
  public processMessage(message: Message){
      // The AgentID exists in the system
      const agentID = message.agentId;
      assert(this.agentsMap.get(agentID).isSome, "Agent not exist, no agent with id init");
      const agentInfo = this.agentsMap.get(agentID).value;

      // The security code matches that held for that AgentID
      assert(agentInfo.securityCode.equals(message.securityCode), "Security code not match");

      // The message is of the correct length.
      assert(message.twelveChar.greaterThanOrEqual(Field(100000000000)), "Message too short (min 12 chars)");
      assert(message.twelveChar.lessThanOrEqual(Field(999999999999)), "Message too long (max 12 chars)");

      // The message number is greater than the highest so far for that agent.
      assert(message.messageNumber.greaterThan(agentInfo.messageNumber), "Message number not greater than the last message number");

      // should update the agent state to store the last message number received. 
      // An app chain implementing the above functionality.
      agentInfo.messageNumber = message.messageNumber;
      this.agentsMap.set(agentID, agentInfo);
  }
}