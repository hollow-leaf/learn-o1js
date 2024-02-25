# Mina zkApp

### CH1: January challenge is based around depositing secret messages from authored users.
Github Action should show the test result :)
[MessageContract](./src/CH1Message.ts)
[MessageContract.test](./src/CH1Message.test.ts)

### CH2. February challenge is based around batch computing valid message
Github Action should show the test result
oh no ... The job running on runner GitHub Actions 6 has exceeded the maximum execution time of 10 minutes. I want know how to reduce the test time
[SpyMessageContract](./src/CH2SpyMessage.ts)
[SpyMessageContract.test](./src/CH2SpyMessage.test.ts)


### Self-Host Runner
```
cp runner.yml runner-prod.yml
docker-compose -f runner-prod.yml up -d
```
## License

[Apache-2.0](LICENSE)