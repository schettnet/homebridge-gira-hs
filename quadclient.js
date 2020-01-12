'use strict'

const WebSocket = require('ws')
const https = require('https')
const xml = require('fast-xml-parser')

function QuadClient (log, config, platform) {
  this.log = log
  this.config = config
  this.platform = platform
  this.query = 'xx'

  if (!('host' in config)) {
    this.config.host = '192.168.0.11'
  }
  if (!('port' in config)) {
    this.config.port = 443
  }
  if (!('rejectUnauthorized' in config)) {
    this.config.rejectUnauthorized = false
  }
}

QuadClient.prototype.connect = function () {
  this.ws = new WebSocket(
    'wss://' + this.config.host + ':' + this.config.port + '/quad/ws',
    {
      headers: {
        authorization:
        'Basic ' +
        Buffer.from(
          this.config.username + ':' + this.config.password
        ).toString('base64')
      },
      origin: 'http://' + this.config.host + ':' + this.config.port,
      perMessageDeflate: false,
      rejectUnauthorized: this.config.rejectUnauthorized
    }
  )

  this.ws.on('message', data => {
    this.onMessage(data)
  })
}

QuadClient.prototype.onMessage = function (data) {
  this.platform.log.debug('quadClient:onMessage(' + data + ')')

  const args = data.toString().split('|')
  const action = parseInt(args.shift())

  if (action === 1) {
    const deviceId = args.shift()
    const deviceValue = parseFloat(args.shift())
    this.setDeviceValue(deviceId, deviceValue)
  } else if (action === 2) {
    const deviceId = args.shift()
    const deviceValue = parseFloat(args.shift())
    this.setDeviceValue(deviceId, deviceValue)
  } else if (action === 81) { // date/time?
    // TODO?
  } else if (action === 91) { // send hashed password
    // const salt = args.shift()
    // https://github.com/leoyn/gira-homeserver-api/blob/c4bac2ddb97127f4dca79845b0ce55c6928cca38/api.py#L131
    // def __generateHash(self, username, password, salt):
    //   salt = [ord(c) for c in salt]
    //   arr1 = [salt[i] ^ 92 if len(salt) > i else 92 for i in range(64)]
    //   arr2 = [salt[i] ^ 54 if len(salt) > i else 54 for i in range(64)]
    //   arr1 = "".join([chr(b) for b in arr1])
    //   arr2 = "".join([chr(b) for b in arr2])
    //   hash = hashlib.md5((arr2 + username + password).encode()).hexdigest().upper()
    //   hash = hashlib.md5((arr1 + hash).encode()).hexdigest().upper()
    //   return hash
    this.ws.send('92|' + this.config.password + '|') // FIXME
  } else if (action === 93) { // login succeeded
    this.query = args.shift()
    https.get(
      {
        host: this.config.host,
        port: this.config.port,
        path: '/quad/client/client_project.xml?' + this.query,
        rejectUnauthorized: this.config.rejectUnauthorized
      },
      response => {
        var chunks = []
        response.on('data', chunk => {
          chunks.push(chunk)
        })
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString()
          this.project = xml.parse(body, { ignoreAttributes: false }).project
          this.project.rooms.room.forEach(room => {
            const roomFriendlyName = room['@_txt']
            this.project.device_groups.device_group.find(deviceGroup => deviceGroup['@_id'] === room['@_device_group']).device.forEach(device => {
              const id = device['@_id']
              const deviceFriendlyName = device['@_text']
              const realDevice = this.project.devices.device.find(device => device['@_id'] === id)
              const nodeName = realDevice['@_txt']
              const friendlyName = roomFriendlyName + ' ' + deviceFriendlyName
              this.addDevice(nodeName, friendlyName, [realDevice.connect].flat())
            })
          })
          this.ws.send('94||')
        })
      }
    )
  } else if (action === 95) { // finished device values?
    // TODO?
  } else if (action === 100) { // username request
    this.ws.send('90|' + this.config.username + '|')
  } else {
    // TODO?
  }
}

QuadClient.prototype.addDevice = function (nodeName, friendlyName, connects) {
  this.platform.onAddDevice && this.platform.onAddDevice(nodeName, friendlyName, connects)
}

QuadClient.prototype.setDeviceValue = function (deviceId, deviceValue) {
  this.log.debug('quadClient:setValue(' + deviceId + ',' + deviceValue + ')')
  this.platform.onSetDeviceValue && this.platform.onSetDeviceValue(deviceId, deviceValue)
}

QuadClient.prototype.send = function (deviceId, deviceValue) {
  const message = ['1', deviceId, deviceValue].join('|')
  this.log.debug('quadClient:send(' + message + ')')
  this.ws.send(message)
}

module.exports = QuadClient
