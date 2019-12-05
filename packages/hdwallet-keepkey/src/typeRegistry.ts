import * as ProtoMessages from '@keepkey/device-protocol/lib/messages_pb'
import * as CosmosMessages from '@keepkey/device-protocol/lib/messages-cosmos_pb'
import * as NanoMessages from '@keepkey/device-protocol/lib/messages-nano_pb'
import * as EosMessages from '@keepkey/device-protocol/lib/messages-eos_pb'

import { Message } from 'google-protobuf'

// Conflict between typedef and actual js export
const { default: Messages } = ProtoMessages as any
const { default: Cosmos } = CosmosMessages as any
const { default: Nano } = NanoMessages as any
const { default: Eos } = EosMessages as any

const AllMessages = []
  .concat(Object.entries(Messages))
  .concat(Object.entries(Cosmos))
  .concat(Object.entries(Nano))
  .concat(Object.entries(Eos))

const upperCasedMessageClasses: { [msgTypeEnum: number]: any } =
  AllMessages.reduce(
    (registry, entry: [string, Message]) => {
      registry[entry[0].toUpperCase()] = entry[1]
      return registry
    })

// Map of message type enums to human readable message name
export const messageNameRegistry: { [msgTypeEnum: number]: string } =
  Object.entries(Messages.MessageType).reduce(
    (registry, entry: [string, number]) => {
      registry[entry[1]] = entry[0].split('_')[1]
      return registry
    }, {})

// Map of message type enum to their protobuf constructor
export const messageTypeRegistry: { [msgTypeEnum: number]: Message } =
  Object.entries(Messages.MessageType).reduce(
    (registry, entry: [string, number]) => {
      registry[entry[1]] = upperCasedMessageClasses[entry[0].split('_')[1].toUpperCase()]
      return registry
    }, {})