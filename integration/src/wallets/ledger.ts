import * as core from "@shapeshiftoss/hdwallet-core";
import * as ledger from "@shapeshiftoss/hdwallet-ledger";

export class MockTransport extends ledger.LedgerTransport {
  memoized = new Map();
  currentApp: string;

  constructor(keyring: core.Keyring, type: string) {
    super(core.untouchable("actual ledger transport unavailable"), keyring);
    this.currentApp = type;
    this.populate();
  }

  public async getDeviceID(): Promise<string> {
    return "mock#1";
  }

  public async call<T extends ledger.LedgerTransportCoinType, U extends ledger.LedgerTransportMethodName<T>>(
    coin: T,
    method: U,
    ...args: Parameters<ledger.LedgerTransportMethod<T, U>>
  ): Promise<ledger.LedgerResponse<T, U>> {
    const key = JSON.stringify({ coin: coin, method: method, args: args });

    if (!this.memoized.has(key)) {
      console.error(coin, method, `JSON.parse('${JSON.stringify(args)}')`);
      throw new Error("mock not yet recorded for arguments");
    }

    return Promise.resolve(this.memoized.get(key));
  }

  public memoize(coin: string | null, method: string, args: any, response: any) {
    const key = JSON.stringify({ coin: coin, method: method, args: args });
    this.memoized.set(key, response);
  }

  public populate() {
    try {
      // Device
      this.memoize(
        null,
        "getAppAndVersion",
        JSON.parse("[]"),
        JSON.parse(`{"success":true,"coin":null,"method":"getAppAndVersion","payload":{"name":"${this.currentApp}"}}`)
      );

      // Ethereum:
      this.memoize(
        "Eth",
        "getAddress",
        JSON.parse("[\"m/44'/60'/0'/0/0\",false]"),
        JSON.parse(
          '{"success":true,"coin":"Eth","method":"getAddress","payload":{"address":"0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8","publicKey":"0427ceefada0c89b5ed12d163d5e3dc3b8f326321503a9bdbf6414367f3780b1925541fe40bbf058ecf4978977c6aeb675b95022dc7f5d54e4a83ed3972d7333e1"}}'
        )
      );
      this.memoize(
        "Eth",
        "signTransaction",
        JSON.parse(
          '["m/44\'/60\'/0\'/0/0","f8620114149441e5560054824ea6b0732e656e3ad64e20e94e4580b844a9059cbb0000000000000000000000001d8ce9022f6284c3a5c317f8f34620107214e54500000000000000000000000000000000000000000000000000000002540be4001c8080"]'
        ),
        JSON.parse(
          '{"success":true,"coin":"Eth","method":"signTransaction","payload":{"r":"1238fd332545415f09a01470350a5a20abc784dbf875cf58f7460560e66c597f","s":"10efa4dd6fdb381c317db8f815252c2ac0d2a883bd364901dee3dec5b7d3660a","v":37}}'
        )
      );
      this.memoize(
        "Eth",
        "signPersonalMessage",
        JSON.parse('["m/44\'/60\'/0\'/0/0","48656c6c6f20576f726c64"]'),
        JSON.parse(
          '{"success":true,"coin":"Eth","method":"signPersonalMessage","payload":{"r":"","s":"","v":"","address":"0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8","publicKey":"0427ceefada0c89b5ed12d163d5e3dc3b8f326321503a9bdbf6414367f3780b1925541fe40bbf058ecf4978977c6aeb675b95022dc7f5d54e4a83ed3972d7333e1"}}'
        )
      );
      this.memoize(
        "Eth",
        "signTransaction",
        JSON.parse(
          '["m/44\'/60\'/0\'/0/0","f8620114149441e5560054824ea6b0732e656e3ad64e20e94e4580b844a9059cbb0000000000000000000000001d8ce9022f6284c3a5c317f8f34620107214e54500000000000000000000000000000000000000000000000000000002540be4001c8080"]'
        ),
        JSON.parse(
          '{"success":true,"coin":"Eth","method":"signTransaction","payload":{"r":"e761a565eaa263060b47e4b354a2a4ed947ccae1de625ecd165e8c304a73d6eb","s":"4299c943818c1e324510a2b20636b1482bf07e7ea8828b8e23c9c15a37c46323","v": "5c"}}'
        )
      );
      this.memoize(
        "Eth",
        "signTransaction",
        JSON.parse(
          '["m/44\'/60\'/0\'/0/0","eb808501dcd650008256229412ec06288edd7ae2cc41a843fe089237fc7354f0872c68af0bb14000801c8080"]'
        ),
        JSON.parse(
          '{"success":true,"coin":"Eth","method":"signTransaction","payload":{"r":"c39538d22687be7b08ed3127c655dcbbcfd7a2ea0267f90acd13f7ddea72b72c","s":"58a5ef3f43bb4459512a37ec9054f1b9528cb17f70c64981d1a7b94f2dafbf38","v":38}}'
        )
      );
      this.memoize(
        "Eth",
        "signTransaction",
        JSON.parse(
          '["m/44\'/60\'/0\'/0/0","eb018501dcd650008256229412ec06288edd7ae2cc41a843fe089237fc7354f0872c68af0bb1400080018080"]'
        ),
        JSON.parse(
          '{"success":true,"payload":{"v":"26","r":"63db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0a","s":"28297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b"},"coin":"Eth","method":"signTransaction"}'
        )
      );
      this.memoize(
        "Eth",
        "signTransaction",
        JSON.parse(
          '["m/44\'/60\'/0\'/0/0","f8620114149441e5560054824ea6b0732e656e3ad64e20e94e4580b844a9059cbb0000000000000000000000001d8ce9022f6284c3a5c317f8f34620107214e54500000000000000000000000000000000000000000000000000000002540be400018080"]'
        ),
        JSON.parse(
          '{"success":true,"payload":{"v":"25","r":"1238fd332545415f09a01470350a5a20abc784dbf875cf58f7460560e66c597f","s":"10efa4dd6fdb381c317db8f815252c2ac0d2a883bd364901dee3dec5b7d3660a"},"coin":"Eth","method":"signTransaction"}'
        )
      );

      // Bitcoin:
      // first mock of getPublicKeys()
      this.memoize(
        "Btc",
        "getWalletPublicKey",
        JSON.parse('["44\'/0\'", {"verify": false }]'),
        JSON.parse(
          '{"success":true,"coin":"Btc","method":"getWalletPublicKey","payload":{"bitcoinAddress":"1Hvzdx2kSLHT93aTnEeDNDSo4DS1Wn3CML","chainCode":"98c92a09b8adb1ab9e5d665fd6ae1dd331d130172d75916189de33f1cf2ff482","publicKey":"045e61c65bb0af92d4af140ea98334df1a0975a331c89dab2549debc945ed72a8a0ff3e429dcfaa6b316c994e998f3e9dbe8b04bb0777aeaa6208da6020ccf4306"}}'
        )
      );

      // getAddress
      this.memoize(
        "Btc",
        "getWalletPublicKey",
        JSON.parse('["m/49\'/0\'/0\'/0/0", {"verify": false, "format": "p2sh"}]'),
        JSON.parse(
          '{"success":true,"coin":"Btc","method":"getWalletPublicKey","payload":{"bitcoinAddress":"3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX","chainCode":"167cbfcd34f24da5a3fa39092431b2f3717066d334775fb82053ae83901e1cec","publicKey":"0475abefec6c107632baad1a38f8dc3286ee09fbbbbf7221e642d885e514e0cd4232877f26fc9c5b8857aa6b48d42f6aecdbeabeb0f293b0b5ba7d5d1d24a274c8"}}'
        )
      );
      this.memoize(
        "Btc",
        "getWalletPublicKey",
        JSON.parse('["m/49\'/0\'/0\'/0/0", {"verify": true, "format": "p2sh"}]'),
        JSON.parse(
          '{"success":true,"coin":"Btc","method":"getWalletPublicKey","payload":{"bitcoinAddress":"3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX","chainCode":"167cbfcd34f24da5a3fa39092431b2f3717066d334775fb82053ae83901e1cec","publicKey":"0475abefec6c107632baad1a38f8dc3286ee09fbbbbf7221e642d885e514e0cd4232877f26fc9c5b8857aa6b48d42f6aecdbeabeb0f293b0b5ba7d5d1d24a274c8"}}'
        )
      );

      this.memoize(
        "Btc",
        "signMessageNew",
        JSON.parse('["m/44\'/0\'/0\'/0/0", "48656c6c6f20576f726c64"]'),
        JSON.parse(
          '{"success":true,"coin":"Btc","method":"signMessageNew","payload":{"r":"a037c911044cd6c851b6508317d8892067b0b62074b2cf1c0df9abd4aa053a3c","s":"243ffdc37f64d7af2c857128eafc81947c380995596615e5dcc313a15f512cdd","v":1}}'
        )
      );

      // These are the three calls in btcSignTx:
      this.memoize(
        "Btc",
        "splitTransaction",
        [
          "Btc",
          "splitTransaction",
          "020000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000001976a91424a56db43cf6f2b02e838ea493f95d8d6047423188acffffffff0160cc0500000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000",
        ],
        JSON.parse(
          '{"success":true,"payload":{"version":{"type":"Buffer","data":[2,0,0,0]},"inputs":[{"prevout":{"type":"Buffer","data":[130,72,134,80,239,37,165,143,239,103,136,189,113,184,33,32,56,215,242,187,228,117,11,199,188,180,71,1,232,94,246,213,0,0,0,0]},"script":{"type":"Buffer","data":[118,169,20,36,165,109,180,60,246,242,176,46,131,142,164,147,249,93,141,96,71,66,49,136,172]},"sequence":{"type":"Buffer","data":[255,255,255,255]},"tree":{"type":"Buffer","data":[]}}],"outputs":[{"amount":{"type":"Buffer","data":[96,204,5,0,0,0,0,0]},"script":{"type":"Buffer","data":[118,169,20,222,155,42,141,160,136,130,78,143,229,29,235,234,86,102,23,216,81,83,120,136,172]}}],"locktime":{"type":"Buffer","data":[0,0,0,0]},"timestamp":{"type":"Buffer","data":[]},"nVersionGroupId":{"type":"Buffer","data":[]},"nExpiryHeight":{"type":"Buffer","data":[]},"extraData":{"type":"Buffer","data":[]}},"coin":"Btc","method":"splitTransaction"}'
        )
      );
      this.memoize(
        "Btc",
        "serializeTransactionOutputs",
        JSON.parse(
          '["Btc", "serializeTransactionOutputs", {"version":{"type":"Buffer","data":[2,0,0,0]},"inputs":[{"prevout":{"type":"Buffer","data":[130,72,134,80,239,37,165,143,239,103,136,189,113,184,33,32,56,215,242,187,228,117,11,199,188,180,71,1,232,94,246,213,0,0,0,0]},"script":{"type":"Buffer","data":[118,169,20,36,165,109,180,60,246,242,176,46,131,142,164,147,249,93,141,96,71,66,49,136,172]},"sequence":{"type":"Buffer","data":[255,255,255,255]},"tree":{"type":"Buffer","data":[]}}],"outputs":[{"amount":{"type":"Buffer","data":[96,204,5,0,0,0,0,0]},"script":{"type":"Buffer","data":[118,169,20,222,155,42,141,160,136,130,78,143,229,29,235,234,86,102,23,216,81,83,120,136,172]}}],"locktime":{"type":"Buffer","data":[0,0,0,0]},"timestamp":{"type":"Buffer","data":[]},"nVersionGroupId":{"type":"Buffer","data":[]},"nExpiryHeight":{"type":"Buffer","data":[]},"extraData":{"type":"Buffer","data":[]}}]'
        ), // TODO need args
        JSON.parse(
          '{"success":true,"payload":{"type":"Buffer","data":[1,96,204,5,0,0,0,0,0,25,118,169,20,222,155,42,141,160,136,130,78,143,229,29,235,234,86,102,23,216,81,83,120,136,172]},"coin":"Btc","method":"serializeTransactionOutputs"}'
        )
      ); // TODO need payload
      this.memoize(
        "Btc",
        "createPaymentTransactionNew",
        JSON.parse(
          '["Btc", "createPaymentTransactionNew", {"0":[[{"version":{"type":"Buffer","data":[2,0,0,0]},"inputs":[{"prevout":{"type":"Buffer","data":[130,72,134,80,239,37,165,143,239,103,136,189,113,184,33,32,56,215,242,187,228,117,11,199,188,180,71,1,232,94,246,213,0,0,0,0]},"script":{"type":"Buffer","data":[118,169,20,36,165,109,180,60,246,242,176,46,131,142,164,147,249,93,141,96,71,66,49,136,172]},"sequence":{"type":"Buffer","data":[255,255,255,255]},"tree":{"type":"Buffer","data":[]}}],"outputs":[{"amount":{"type":"Buffer","data":[96,204,5,0,0,0,0,0]},"script":{"type":"Buffer","data":[118,169,20,222,155,42,141,160,136,130,78,143,229,29,235,234,86,102,23,216,81,83,120,136,172]}}],"locktime":{"type":"Buffer","data":[0,0,0,0]},"timestamp":{"type":"Buffer","data":[]},"nVersionGroupId":{"type":"Buffer","data":[]},"nExpiryHeight":{"type":"Buffer","data":[]},"extraData":{"type":"Buffer","data":[]}},0]],"1":["0\'/0/0"],"3":{"type":"Buffer","data":[1,96,204,5,0,0,0,0,0,25,118,169,20,222,155,42,141,160,136,130,78,143,229,29,235,234,86,102,23,216,81,83,120,136,172]}}]'
        ),
        JSON.parse(
          '{"success":true,"payload":"01000000016f07b61b82e550d516508c954f1d301bd8d7abd552fd3c2867e6cb243a19a696000000006b48304502210090d4e777a35a53fcc47e0912e7b54db9e7156d21ba1638803375a1a910d969ff02206d10c6814ebb016f62b1e11678d555eee19bf60499f2397aae404f7ff58d0ad201210356c531d23ce2b9b787532fb22c5b4c8fae70c692f30b7771e18bdfdbb7148ab9ffffffff0160cc0500000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000","coin":"Btc","method":"createPaymentTransactionNew"}'
        )
      );
      this.memoize(
        "Btc",
        "getWalletPublicKey",
        JSON.parse('["m/44\'/0\'/0\'/0/0",{"verify":true,"format":"legacy"}]'),
        JSON.parse(
          '{"success":true,"coin":"Btc","method":"getWalletPublicKey","payload":{"bitcoinAddress":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM","chainCode":"fixme","publicKey":"fixme"}}'
        )
      );
      this.memoize(
        "Btc",
        "getWalletPublicKey",
        JSON.parse('["m/44\'/0\'/0\'/0/0",{"verify":false,"format":"legacy"}]'),
        JSON.parse(
          '{"success":true,"coin":"Btc","method":"getWalletPublicKey","payload":{"bitcoinAddress":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM","chainCode":"fixme","publicKey":"fixme"}}'
        )
      );
    } catch (e) {
      console.error(e);
    }
  }
}

export function name(): string {
  return "Ledger";
}

export function createInfo(): core.HDWalletInfo {
  return ledger.info();
}

export async function createWallet(type: any = "Bitcoin"): Promise<core.HDWallet> {
  const keyring = new core.Keyring();
  const transport = new MockTransport(keyring, type);
  return ledger.create(transport as any);
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: ledger.LedgerHDWallet & core.ETHWallet & core.BTCWallet & core.HDWallet;

  beforeAll(async () => {
    const w = get();
    if (ledger.isLedger(w) && core.supportsBTC(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      throw new Error("Wallet is not a Ledger");
    }
  });

  it("supports Ethereum mainnet", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsNetwork(1)).toEqual(true);
  });

  it("does not support Native ShapeShift", async () => {
    if (!wallet) return;
    expect(wallet.ethSupportsNativeShapeShift()).toEqual(false);
    expect(wallet.btcSupportsNativeShapeShift()).toEqual(false);
  });

  it("does not support Secure Transfer", async () => {
    if (!wallet) return;
    expect(await wallet.ethSupportsSecureTransfer()).toEqual(false);
    expect(await wallet.btcSupportsSecureTransfer()).toEqual(false);
  });

  it("validates current app", async () => {
    if (!wallet) return;
    await expect(wallet.validateCurrentApp("Bitcoin")).resolves.not.toThrow();
    await expect(wallet.validateCurrentApp(undefined)).rejects.toThrow(); // no coin
    await expect(wallet.validateCurrentApp("FakeCoin")).rejects.toThrow(); // invalid coin
    await expect(wallet.validateCurrentApp("Ethereum")).rejects.toThrow(); // wrong coin
  });

  it("has a non-BIP 44 derivation path for Ethereum", () => {
    if (!wallet) return;
    [0, 1, 3, 27].forEach((account) => {
      const paths = wallet.ethGetAccountPaths({
        coin: "Ethereum",
        accountIdx: account,
      });
      expect(paths).toEqual([
        {
          addressNList: [0x80000000 + 44, 0x80000000 + 60, 0x80000000 + account, 0, 0],
          hardenedPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000 + account],
          relPath: [0, 0],
          description: "BIP 44: Ledger (Ledger Live)",
        },
        {
          addressNList: [0x80000000 + 44, 0x80000000 + 60, 0x80000000 + 0, account],
          hardenedPath: [0x80000000 + 44, 0x80000000 + 60, 0x80000000 + 0],
          relPath: [account],
          description: "Non BIP 44: Ledger (legacy, Ledger Chrome App)",
        },
      ]);
      paths.forEach((path) => {
        expect(
          wallet.describePath({
            coin: "Ethereum",
            path: path.addressNList,
          }).isKnown
        ).toBeTruthy();
      });
    });
  });

  it("uses correct bip44 paths", () => {
    if (!wallet) return;

    const paths = wallet.btcGetAccountPaths({
      coin: "Litecoin",
      accountIdx: 3,
    });

    expect(paths).toEqual([
      {
        addressNList: [2147483697, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendP2SHWitness,
        coin: "Litecoin",
      },
      {
        addressNList: [2147483692, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendAddress,
        coin: "Litecoin",
      },
      {
        addressNList: [2147483732, 2147483650, 2147483651],
        scriptType: core.BTCInputScriptType.SpendWitness,
        coin: "Litecoin",
      },
    ]);
  });

  it("supports btcNextAccountPath", () => {
    if (!wallet) return;

    const paths = core.mustBeDefined(
      wallet.btcGetAccountPaths({
        coin: "Litecoin",
        accountIdx: 3,
      })
    );

    expect(
      paths
        .map((path) => core.mustBeDefined(wallet.btcNextAccountPath(path)))
        .map((path) =>
          wallet.describePath({
            ...path,
            path: path.addressNList,
          })
        )
    ).toEqual([
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2sh-p2wpkh",
        verbose: "Litecoin Account #4",
        wholeAccount: true,
        isPrefork: false,
      },
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2pkh",
        verbose: "Litecoin Account #4 (Legacy)",
        wholeAccount: true,
        isPrefork: false,
      },
      {
        accountIdx: 4,
        coin: "Litecoin",
        isKnown: true,
        scriptType: "p2wpkh",
        verbose: "Litecoin Account #4 (Segwit Native)",
        wholeAccount: true,
        isPrefork: false,
      },
    ]);
  });

  it("can describe paths", () => {
    expect(
      wallet.info.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/0'/0/0"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "Bitcoin Account #0, Address #0 (Legacy)",
      coin: "Bitcoin",
      scriptType: core.BTCInputScriptType.SpendAddress,
      isKnown: true,
      accountIdx: 0,
      addressIdx: 0,
      wholeAccount: false,
      isChange: false,
      isPrefork: false,
    });

    expect(
      wallet.info.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/7'/1/5"),
        coin: "Bitcoin",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "Bitcoin Account #7, Change Address #5 (Legacy)",
      coin: "Bitcoin",
      scriptType: core.BTCInputScriptType.SpendAddress,
      isKnown: true,
      accountIdx: 7,
      addressIdx: 5,
      wholeAccount: false,
      isChange: true,
      isPrefork: false,
    });

    expect(
      wallet.info.describePath({
        path: core.bip32ToAddressNList("m/44'/0'/7'/1/5"),
        coin: "BitcoinCash",
        scriptType: core.BTCInputScriptType.SpendAddress,
      })
    ).toEqual({
      verbose: "m/44'/0'/7'/1/5",
      coin: "BitcoinCash",
      scriptType: core.BTCInputScriptType.SpendAddress,
      isKnown: false,
    });

    expect(
      wallet.info.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/0'/0/0"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "Ethereum Account #0",
      coin: "Ethereum",
      isKnown: true,
      accountIdx: 0,
      wholeAccount: true,
      isPrefork: false,
    });

    expect(
      wallet.info.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/3'/0/0"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "Ethereum Account #3",
      coin: "Ethereum",
      isKnown: true,
      accountIdx: 3,
      wholeAccount: true,
      isPrefork: false,
    });

    expect(
      wallet.info.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/0'/42"),
        coin: "Ethereum",
      })
    ).toEqual({
      verbose: "Ethereum Account #42",
      coin: "Ethereum",
      isKnown: true,
      wholeAccount: true,
      accountIdx: 42,
      isPrefork: false,
    });
  });
}
