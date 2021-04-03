'use strict'

const QuadClient = require('./quadclient')

var Accessory, Characteristic, Service, UUIDGen

module.exports = function (homebridge) {
  Accessory = homebridge.platformAccessory
  Characteristic = homebridge.hap.Characteristic
  Service = homebridge.hap.Service
  UUIDGen = homebridge.hap.uuid

  homebridge.registerPlatform(
    'homebridge-platform-gira-homeserver',
    'GiraHomeServerPlatform',
    GiraHomeServerPlatform,
    true
  )
}

function GiraHomeServerPlatform (log, config, api) {
  log.debug('GiraHomeServerPlatform Init')

  var platform = this

  this.log = log
  this.config = config
  this.api = api

  this.accessories = []
  this.quadClient = new QuadClient(this.log, this.config.quadClient, {
    onAddDevice: (nodeName, displayName, connects) => platform.addDevice(nodeName, displayName, connects),
    onSetDeviceValue: (deviceId, deviceValue) => platform.setDeviceValue(deviceId, deviceValue)
  })

  this.api.on('didFinishLaunching', function () {
    platform.log.debug('DidFinishLaunching')
    platform.quadClient.connect()
  })
}

GiraHomeServerPlatform.prototype.configureAccessory = function (accessory) {
  this.log.debug(accessory.displayName, 'Configure Accessory')

  var platform = this

  // Set the accessory to reachable if plugin can currently process the
  // accessory, otherwise set to false and update the reachability later by
  // invoking accessory.updateReachability()
  this.log.debug('accessory.reachable = ' + accessory.reachable)
  accessory.reachable = true

  accessory.on('identify', function (paired, callback) {
    platform.log(accessory.displayName, 'Identify!!!')
    callback()
  })

  for (const key in accessory.context.tags) {
    const slot = accessory.context.tags[key]

    if (slot === 'dim_s') {
      accessory.getService(Service.Lightbulb) // , accessory.displayName)
        .getCharacteristic(Characteristic.On)
        .on('set', function (value, callback) {
          platform.log.debug('configureAccessory/set:', accessory.displayName,
            '[' + key + ']', 'On -> ' + value)
          platform.quadClient.send(key, value ? 1 : 0)
          callback()
        })
    } else if (slot === 'dim_val') {
      accessory.getService(Service.Lightbulb) // , accessory.displayName)
        .getCharacteristic(Characteristic.Brightness)
        .on('set', function (value, callback) {
          platform.log.debug('configureAccessory/set:', accessory.displayName,
            '[' + key + ']', 'Brightness -> ' + value)
          platform.quadClient.send(key, value)
          callback()
        })
    } else if (slot === 'switch') {
      accessory.getService(Service.Switch) // , accessory.displayName)
        .getCharacteristic(Characteristic.On)
        .on('set', function (value, callback) {
          platform.log.debug('configureAccessory/set:', accessory.displayName,
            '[' + key + ']', 'On -> ' + value)
          platform.quadClient.send(key, value ? 1 : 0)
          callback()
        })
    }
  }

  this.accessories.push(accessory)
}

GiraHomeServerPlatform.prototype.addAccessory = function (nodeName, displayName, context) {
  this.log.debug('Add Accessory:' + JSON.stringify(context.tags))

  var platform = this

  const uuid = UUIDGen.generate(nodeName)
  if (this.accessories.find(accessory => accessory.UUID === uuid)) {
    this.log.debug('Already present')
    return
  }

  const accessory = new Accessory(displayName, uuid)
  accessory.getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, 'Gira')
    .setCharacteristic(Characteristic.Model, 'HomeServer')
    // .setCharacteristic(Characteristic.SerialNumber, ...)
    .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version)

  accessory.on('identify', function (paired, callback) {
    platform.log(accessory.displayName, 'Identify!!!')
    callback()
  })

  accessory.context = context

  for (const key in accessory.context.tags) {
    const slot = accessory.context.tags[key]
    platform.log.debug('key:', key, 'slot:', slot)

    if (slot === 'dim_s') {
      accessory.addService(Service.Lightbulb, displayName)
        .getCharacteristic(Characteristic.On)
        .on('set', function (value, callback) {
          platform.log.debug('addAccessory/set:', accessory.displayName,
            '[' + key + ']', 'On -> ' + value)
          platform.quadClient.send(key, value ? 1 : 0)
          callback()
        })
    } else if (slot === 'switch') {
      accessory.addService(Service.Switch, displayName)
        .getCharacteristic(Characteristic.On)
        .on('set', function (value, callback) {
          platform.log.debug('addAccessory/set:', accessory.displayName,
            '[' + key + ']', 'On -> ' + value)
          platform.quadClient.send(key, value ? 1 : 0)
          callback()
        })
    } else if (slot === 'slot_position') {
      accessory.addService(Service.WindowCovering, displayName)
        .getCharacteristic(Characteristic.PositionState)
        .on('set', function (value, callback) {
          platform.log.debug('addAccessory/set:', accessory.displayName,
            '[' + key + ']', 'PositionState -> ' + value)
          platform.quadClient.send(key, value)
          callback()
        })
    }
  }

  for (const key in accessory.context.tags) {
    const slot = accessory.context.tags[key]

    if (slot === 'dim_val') {
      accessory.getService(Service.Lightbulb, displayName)
        .getCharacteristic(Characteristic.Brightness)
        .on('set', function (value, callback) {
          platform.log.debug('addAccessory/set:', accessory.displayName,
            '[' + key + ']', 'Brightness -> ' + value)
          platform.quadClient.send(key, value)
          callback()
        })
    }
  }

  this.accessories.push(accessory)
  this.api.registerPlatformAccessories(
    'homebridge-platform-gira-homeserver',
    'GiraHomeServerPlatform',
    [accessory])

  this.log.debug('register acc', [accessory])
}

GiraHomeServerPlatform.prototype.updateAccessoriesReachability = function () {
  this.log.debug('Update Reachability')

  for (const index in this.accessories) {
    const accessory = this.accessories[index]
    accessory.updateReachability(false)
  }
}

GiraHomeServerPlatform.prototype.addDevice = function (nodeName, displayName, connects) {
  this.log.debug('Platform:addDevice("' + nodeName + '","' + displayName + '")')

  // var accessory = new Accessory(displayName, UUIDGen.generate(nodeName))
  // console.log(accessory)
  // accessory.getService(Service.AccessoryInformation)
  //   .setCharacteristic(Characteristic.Manufacturer, 'Gira')
  //   .setCharacteristic(Characteristic.Model, 'HomeServer')
  // .setCharacteristic(Characteristic.SerialNumber, device.serialNumber)
  // .setCharacteristic(Characteristic.FirmwareRevision, device.firmwareVersion)

  var context = { tags: {} }
  connects.forEach(connect => { context.tags[connect['@_tag']] = connect['@_slot'] })

  this.addAccessory(nodeName, displayName, context)
}

GiraHomeServerPlatform.prototype.setDeviceValue = function (deviceId, deviceValue) {
  this.log.debug('Platform:setDeviceValue(' + deviceId + ',' + deviceValue + ')')

  const accessory = this.accessories.find(accessory => deviceId in accessory.context.tags)
  // console.log(this.accessories[0].context.tags)

  if (accessory) {
    const slot = accessory.context.tags[deviceId]

    if (slot === 'dim_s') {
      accessory.getService(Service.Lightbulb, accessory.displayName)
        .getCharacteristic(Characteristic.On)
        .updateValue(parseInt(deviceValue) === 1)
    } else if (slot === 'dim_val') {
      accessory.getService(Service.Lightbulb, accessory.displayName)
        .getCharacteristic(Characteristic.Brightness)
        .updateValue(parseFloat(deviceValue))
    } else if (slot === 'switch') {
      accessory.getService(Service.Switch, accessory.displayName)
        .getCharacteristic(Characteristic.On)
        .updateValue(parseInt(deviceValue) === 1)
    } else if (slot === 'slot_position') {
      accessory.getService(Service.WindowCovering, accessory.displayName)
        .getCharacteristic(Characteristic.TargetPosition)
        .updateValue(parseFloat(deviceValue))
    }
  } else {
    // this.log.error(deviceId + ' not found')
    // process.exit(1)
  }
}
