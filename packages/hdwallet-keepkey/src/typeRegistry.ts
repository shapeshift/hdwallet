import * as ProtoMessages from '@keepkey/device-protocol/lib/messages_pb'
import { Message } from 'google-protobuf'

const { default: Messages } = ProtoMessages as any // Conflict between typedef and actual js export

const upperCasedMessageClasses: { [msgTypeEnum: number]: any } = Object.entries(Messages).reduce((registry, entry: [string, Message]) => {
  registry[entry[0].toUpperCase()] = entry[1]
  return registry
})

// Map of message type enums to human readable message name
export const messageNameRegistry: { [msgTypeEnum: number]: string } = Object.entries(Messages.MessageType).reduce((registry, entry: [string, number]) => {
  registry[entry[1]] = entry[0].split('_')[1]
  return registry
}, {})

// Map of message type enum to their protobuf constructor
export const messageTypeRegistry: { [msgTypeEnum: number]: Message } = Object.entries(Messages.MessageType).reduce((registry, entry: [string, number]) => {
  registry[entry[1]] = upperCasedMessageClasses[entry[0].split('_')[1].toUpperCase()]
  return registry
}, {})