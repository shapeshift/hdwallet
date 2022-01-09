import { RemoteServer, revocable } from "@shapeshiftoss/hdwallet-core";

import { SecP256K1 } from "../../../core";
import * as BIP32 from "../../../core/bip32";
import { NodeParams } from "./client";

export class SeedServer extends RemoteServer {
  readonly #seed: BIP32.Seed

  protected constructor(seed: BIP32.Seed) {
    super()
    this.#seed = seed
  }

  addRevoker(revoke: () => void) {
    this.#seed.addRevoker?.(revoke)
  }

  revoke() {
    this.#seed.revoke?.()
  }

  static async create(seed: BIP32.Seed): Promise<SeedServer> {
    const obj = new SeedServer(seed)
    return revocable(obj, (x) => obj.addRevoker(x))
  }

  protected async handleCall(method: string, ...args: unknown[]): Promise<unknown> {
    switch (method) {
      case "revoke":
        this.revoke()
        return
      case "toMasterKey": {
        const masterKey = await this.#seed.toMasterKey(...(args as Parameters<BIP32.Seed["toMasterKey"]>))
        const server = await NodeServer.create(masterKey)
        const params: NodeParams = {
          publicKey: await masterKey.getPublicKey(),
          chainCode: await masterKey.getChainCode(),
          port: server.messagePort
        }
        return params
      }
      default:
        throw new Error('no such method')
    }
  }
}

type NodeType = BIP32.Node & Partial<SecP256K1.ECDSARecoverableKey> & Partial<SecP256K1.ECDHKey>
export class NodeServer extends RemoteServer {
  readonly #node: NodeType

  protected constructor(node: NodeType) {
    super()
    this.#node = node
  }

  addRevoker(revoke: () => void) {
    this.#node.addRevoker?.(revoke)
  }

  revoke() {
    this.#node.revoke?.()
  }

  static async create(node: NodeType): Promise<NodeServer> {
    const obj = new NodeServer(node)
    return revocable(obj, (x) => obj.addRevoker(x))
  }

  protected async handleCall(method: string, ...args: unknown[]): Promise<unknown> {
    switch (method) {
      case "revoke":
        this.revoke()
        return
      case "ecdsaSign":
        return await this.#node.ecdsaSign(...(args as Parameters<NodeType["ecdsaSign"]>))
      case "ecdsaSignRecoverable":
        return await this.#node.ecdsaSignRecoverable?.(...(args as Parameters<NonNullable<NodeType["ecdsaSignRecoverable"]>>))
      case "ecdh":
        return await this.#node.ecdh?.(...(args as Parameters<NonNullable<NodeType["ecdh"]>>))
      case "ecdhRaw":
        return await this.#node.ecdhRaw?.(...(args as Parameters<NonNullable<NodeType["ecdhRaw"]>>))
      case "derive": {
        const node = await this.#node.derive(...(args as Parameters<NodeType["derive"]>))
        const server = await NodeServer.create(node)
        const params: NodeParams = {
          publicKey: await node.getPublicKey(),
          chainCode: await node.getChainCode(),
          port: server.messagePort
        }
        return params
      }
      default:
        throw new Error('no such method')
    }
  }
}