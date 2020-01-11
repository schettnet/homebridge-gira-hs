# homebridge-platform-gira-homeserver

Gira HomeServer Platform plugin for HomeBridge.

## Configuration

```json
{
  "platforms": [
    {
      "platform": "GiraHomeServerPlatform",
      "name": "Gira HomeServer",
      "quadClient": {
        "host": "192.168.0.99",
        "port": 443,
        "username": "qcusername",
        "password": "qcpassword",
        "rejectUnauthorized": false
      }
    }
  ]
}
```

## Common Problems

> Error: unable to verify the first certificate

## License

This project is licensed under the terms of the MIT license. See the [LICENSE](LICENSE) file for details.
