### The spymaster is worried that this design is not private. Is he correct ?
Yes, the system is not private, all messages and values are public inputs. Everyone can get the securityCode and agentInfo by ID on-chain. 


### How could you change the system to ensure that messages are private ?

I could use ZKProgram make private inputs and generate proof to verify on-chain.

The better way to change this system to private, I should edit the initAgent function to make this part off-chain and private.

I think merkleMap is the way to store the agent and use ZkProgram to verify message proof.