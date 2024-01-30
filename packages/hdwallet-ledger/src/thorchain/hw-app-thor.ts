/** ******************************************************************************
 *  (c) 2019 ZondaX GmbH
 *  (c) 2016-2017 Ledger
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */
import type Transport from "@ledgerhq/hw-transport";

import {
  APP_KEY,
  CHUNK_SIZE,
  CLA,
  ErrorCode,
  errorCodeToString,
  INS,
  P1_VALUES,
  PAYLOAD_TYPE,
  processErrorResponse,
} from "./common";

export type GetAddressAndPubKeyResponse = {
  address: string;
  publicKey: string;
  error_message: string;
  return_code: number;
};

export type SignResponse = {
  signature: null | Buffer;
  error_message: string;
  return_code: number;
};

export class Thorchain {
  transport: Transport;
  versionResponse: any;

  constructor(transport: Transport, scrambleKey = APP_KEY) {
    if (!transport) {
      throw new Error("Transport has not been defined");
    }

    this.transport = transport;
    transport.decorateAppAPIMethods.bind(transport)(this, ["getAddress", "sign"], scrambleKey);
  }

  getVersion() {
    return this.transport.send(CLA, INS.GET_VERSION, 0, 0).then((response) => {
      const errorCodeData = response.slice(-2);
      const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

      let targetId = 0;
      if (response.length >= 9) {
        targetId = (response[5] << 24) + (response[6] << 16) + (response[7] << 8) + (response[8] << 0);
      }

      return {
        return_code: returnCode,
        error_message: errorCodeToString(returnCode),
        test_mode: response[0] !== 0,
        major: response[1],
        minor: response[2],
        patch: response[3],
        device_locked: response[4] === 1,
        target_id: targetId.toString(16),
      };
    }, processErrorResponse);
  }

  serializeHRP(hrp: string) {
    if (hrp == null || hrp.length === 0 || hrp.length > 83) {
      throw new Error("Invalid HRP");
    }

    const buf = Buffer.alloc(1 + hrp.length);
    buf.writeUInt8(hrp.length, 0);
    buf.write(hrp, 1);
    return buf;
  }

  async serializePath(path: Array<number>) {
    this.versionResponse = await this.getVersion();

    if (this.versionResponse.return_code !== ErrorCode.NoError) {
      throw this.versionResponse;
    }

    switch (this.versionResponse.major) {
      case 2: {
        if (!path || path.length !== 5) {
          throw new Error("Invalid path.");
        }

        const buf = Buffer.alloc(20);
        buf.writeUInt32LE(path[0], 0);
        buf.writeUInt32LE(path[1], 4);
        buf.writeUInt32LE(path[2], 8);
        buf.writeUInt32LE(path[3], 12);
        buf.writeUInt32LE(path[4], 16);

        return buf;
      }
      default:
        return {
          return_code: 0x6400,
          error_message: "App Version is not supported",
        };
    }
  }

  async getAddress(path: Array<number>, hrp: string, boolDisplay?: boolean): Promise<GetAddressAndPubKeyResponse> {
    try {
      return await this.serializePath(path)
        .then((serializedPath) => {
          if (!Buffer.isBuffer(serializedPath)) return serializedPath;

          const data = Buffer.concat([this.serializeHRP(hrp), serializedPath]);

          return this.transport
            .send(
              CLA,
              INS.GET_ADDR_SECP256K1,
              boolDisplay ? P1_VALUES.SHOW_ADDRESS_IN_DEVICE : P1_VALUES.ONLY_RETRIEVE,
              0,
              data,
              [ErrorCode.NoError]
            )
            .then((response) => {
              const errorCodeData = response.slice(-2);
              const return_code = errorCodeData[0] * 256 + errorCodeData[1];
              return {
                address: Buffer.from(response.slice(33, -2)).toString(),
                publicKey: Buffer.from(response.slice(0, 33)).toString("hex"),
                return_code,
                error_message: errorCodeToString(return_code),
              };
            }, processErrorResponse);
        })
        .catch((err) => processErrorResponse(err));
    } catch (e) {
      return processErrorResponse(e);
    }
  }

  async signGetChunks(path: Array<number>, message: string) {
    const serializedPath = await this.serializePath(path);

    if (!Buffer.isBuffer(serializedPath)) return serializedPath;

    const chunks = [];
    chunks.push(serializedPath);
    const buffer = Buffer.from(message);

    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      let end = i + CHUNK_SIZE;
      if (i > buffer.length) {
        end = buffer.length;
      }
      chunks.push(buffer.slice(i, end));
    }

    return chunks;
  }

  async signSendChunk(chunkIdx: number, chunkNum: number, chunk: Buffer): Promise<SignResponse> {
    switch (this.versionResponse.major) {
      case 2: {
        chunkIdx = (() => {
          if (chunkIdx === 1) return PAYLOAD_TYPE.INIT;
          if (chunkIdx === chunkNum) return PAYLOAD_TYPE.LAST;
          return PAYLOAD_TYPE.ADD;
        })();

        return this.transport
          .send(CLA, INS.SIGN_SECP256K1, chunkIdx, 0, chunk, [ErrorCode.NoError, 0x6984, 0x6a80])
          .then((response) => {
            const errorCodeData = response.slice(-2);
            const returnCode = errorCodeData[0] * 256 + errorCodeData[1];
            let errorMessage = errorCodeToString(returnCode);

            if (returnCode === 0x6a80 || returnCode === 0x6984) {
              errorMessage = `${errorMessage} : ${response.slice(0, response.length - 2).toString("ascii")}`;
            }

            let signature: Buffer | null = null;
            if (response.length > 2) {
              signature = response.slice(0, response.length - 2);
            }

            return {
              signature,
              return_code: returnCode,
              error_message: errorMessage,
            };
          }, processErrorResponse);
      }
      default:
        return {
          signature: null,
          return_code: 0x6400,
          error_message: "App Version is not supported",
        };
    }
  }

  async sign(path: Array<number>, message: string): Promise<SignResponse> {
    return this.signGetChunks(path, message).then((chunks) => {
      if (!Array.isArray(chunks)) return chunks;

      return this.signSendChunk(1, chunks.length, chunks[0]).then(async (response) => {
        let result: SignResponse = {
          return_code: response.return_code,
          error_message: response.error_message,
          signature: null,
        };

        for (let i = 1; i < chunks.length; i += 1) {
          result = await this.signSendChunk(1 + i, chunks.length, chunks[i]);
          if (result.return_code !== ErrorCode.NoError) {
            break;
          }
        }

        return {
          return_code: result.return_code,
          error_message: result.error_message,
          signature: result.signature,
        };
      }, processErrorResponse);
    }, processErrorResponse);
  }
}
