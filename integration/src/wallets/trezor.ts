import * as core from "@shapeshiftoss/hdwallet-core";
import * as trezor from "@shapeshiftoss/hdwallet-trezor";

export class MockTransport extends trezor.TrezorTransport {
  memoized = new Map();

  constructor(keyring: core.Keyring) {
    super(keyring);
    this.populate();
  }

  public async getDeviceID(): Promise<string> {
    return "mock#1";
  }

  public call(method: string, msg: any): Promise<trezor.TrezorConnectResponse> {
    const key = JSON.stringify({ method: method, msg: msg });
    if (!this.memoized.has(key)) {
      console.error(method, `JSON.parse('${JSON.stringify(msg)}')`);
      throw new Error("mock not yet recorded for arguments");
    }
    return Promise.resolve(this.memoized.get(key));
  }

  public async cancel(): Promise<void> {
    // Do nothing.
  }

  public memoize(method: string, msg: any, response: any) {
    const key = JSON.stringify({ method: method, msg: msg });
    this.memoized.set(key, response);
  }

  public populate() {
    this.memoize(
      "loadDevice",
      {
        mnemonic: "alcohol woman abuse must during monitor noble actual mixed trade anger aisle",
        pin: undefined,
        passphraseProtection: undefined,
        label: "test",
      },
      {
        success: true,
      }
    );

    this.memoize(
      "ethereumGetAddress",
      {
        path: "m/44'/60'/0'/0/0",
        showOnTrezor: false,
      },
      {
        success: true,
        payload: {
          address: "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
        },
      }
    );

    this.memoize(
      "ethereumSignTransaction",
      {
        path: [2147483692, 2147483708, 2147483648, 0, 0],
        transaction: {
          to: "0x41e5560054824ea6b0732e656e3ad64e20e94e45",
          value: "0x00",
          data: "0xa9059cbb0000000000000000000000001d8ce9022f6284c3a5c317f8f34620107214e54500000000000000000000000000000000000000000000000000000002540be400",
          chainId: 1,
          nonce: "0x01",
          gasLimit: "0x14",
          gasPrice: "0x14",
        },
      },
      {
        success: true,
        payload: {
          v: 37,
          r: "0x1238fd332545415f09a01470350a5a20abc784dbf875cf58f7460560e66c597f",
          s: "0x10efa4dd6fdb381c317db8f815252c2ac0d2a883bd364901dee3dec5b7d3660a",
        },
      }
    );

    this.memoize(
      "ethereumSignMessage",
      {
        path: [2147483692, 2147483708, 2147483648, 0, 0],
        message: "Hello World",
      },
      {
        success: true,
        payload: {
          address: "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
          signature:
            "29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b",
        },
      }
    );

    this.memoize(
      "ethereumVerifyMessage",
      {
        address: "0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8",
        message: "Hello World",
        signature:
          "29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b",
      },
      {
        success: true,
        payload: {
          message: "Message verified",
        },
      }
    );

    // Parsing errors in here are really unhelpful without this try/catch:
    try {
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/49\'/0\'/0\'/0/0","showOnTrezor":true,"coin":"btc"}'),
        JSON.parse(
          '{"payload":{"address":"3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX","path":[2147483697,2147483648,2147483648,0,0],"serializedPath":"m/49\'/0\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse(
          '{"path":"m/49\'/0\'/0\'/0/0","showOnTrezor":true,"coin":"btc","address":"3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX"}'
        ),
        JSON.parse(
          '{"payload":{"address":"3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX","path":[2147483697,2147483648,2147483648,0,0],"serializedPath":"m/49\'/0\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse('{"path":[2147483697,2147483648,2147483648,0,0],"showOnTrezor":false,"coin":"btc"}'),
        JSON.parse(
          '{"payload":{"address":"3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX","path":[2147483697,2147483648,2147483648,0,0],"serializedPath":"m/49\'/0\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "signTransaction",
        JSON.parse(
          '{"coin":"btc","inputs":[{"address_n":[0],"prev_hash":"d5f65ee80147b4bcc70b75e4bbf2d7382021b871bd8867ef8fa525ef50864882","prev_index":0}],"outputs":[{"address":"1MJ2tj2ThBE62zXbBYA5ZaN3fdve5CPAz1","amount":"380000","script_type":"PAYTOADDRESS"}],"push":false}'
        ),
        JSON.parse(
          '{"payload":{"signatures":["30450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede781"],"serializedTx":"010000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000006b4830450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede7810121023230848585885f63803a0a8aecdd6538792d5c539215c91698e315bf0253b43dffffffff0160cc0500000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "signMessage",
        JSON.parse('{"path":[2147483692,2147483648,2147483648,0,0],"message":"Hello World","coin":"btc"}'),
        JSON.parse(
          '{"payload":{"address":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM","signature":"IKA3yREETNbIUbZQgxfYiSBnsLYgdLLPHA35q9SqBTo8JD/9w39k168shXEo6vyBlHw4CZVZZhXl3MMToV9RLN0="},"id":3,"success":true}'
        )
      );
      this.memoize(
        "verifyMessage",
        JSON.parse(
          '{"address":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM","message":"Hello World","signature":"IKA3yREETNbIUbZQgxfYiSBnsLYgdLLPHA35q9SqBTo8JD/9w39k168shXEo6vyBlHw4CZVZZhXl3MMToV9RLN0=","coin":"btc"}'
        ),
        JSON.parse('{"payload":{"message":"Message verified"},"id":4,"success":true}')
      );
      this.memoize(
        "verifyMessage",
        JSON.parse(
          '{"address":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM","message":"Fake World","signature":"IKA3yREETNbIUbZQgxfYiSBnsLYgdLLPHA35q9SqBTo8JD/9w39k168shXEo6vyBlHw4CZVZZhXl3MMToV9RLN0=","coin":"btc"}'
        ),
        JSON.parse('{"payload":{"error":"Invalid signature","code":"Failure_DataError"},"id":2,"success":false}')
      );
      this.memoize(
        "getPublicKey",
        JSON.parse(
          '{"bundle":[{"path":[2147483692,2147483648,2147483648]},{"path":[2147483692,2147483648,2147483649]}]}'
        ),
        JSON.parse(
          '{"payload":[{"path":[2147483692,2147483648,2147483648],"serializedPath":"m/44\'/0\'/0\'","childNum":2147483648,"xpub":"xpub6D1weXBcFAo8CqBbpP4TbH5sxQH8ZkqC5pDEvJ95rNNBZC9zrKmZP2fXMuve7ZRBe18pWQQsGg68jkq24mZchHwYENd8cCiSb71u3KD4AFH","chainCode":"2bb4d964626dcfa95387a62718142a6e5aabe191c4b32553d3daecd1090321ea","publicKey":"02b9f9fabea9aaba811781d3cbf728dabe9502485d56031570bc49442a47dd057d","fingerprint":3115854823,"depth":3},{"path":[2147483692,2147483648,2147483649],"serializedPath":"m/44\'/0\'/1\'","childNum":2147483649,"xpub":"xpub6D1weXBcFAo8HPiRxhc6tBvwu7o35mYfn2BemJhhB93syYFJ1FCE7Rn2dbLNh1EPqKG3BAuB66gLyqgW8ouxyo1hnU1p9xQpFSNQgXDuQL4","chainCode":"f5cf3ee3971bab53e873e0e911b8069cff43d1030d6b0407d6aef095a2ec940f","publicKey":"036664e2c61cfe121e89a5b8dd4da6bc23038b00287c6abc2c2612a8ef165f7c68","fingerprint":3115854823,"depth":3}],"id":5,"success":true}'
        )
      );
      this.memoize("wipeDevice", {}, { success: true });
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/44\'/0\'/0\'/0/0","showOnTrezor":false,"coin":"btc"}'),
        JSON.parse(
          '{"payload":{"address":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM","path":[2147483692,2147483648,2147483648,0,0],"serializedPath":"m/44\'/0\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse(
          '{"path":"m/44\'/0\'/0\'/0/0","showOnTrezor":true,"coin":"btc","address":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM"}'
        ),
        JSON.parse(
          '{"payload":{"address":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM","path":[2147483692,2147483648,2147483648,0,0],"serializedPath":"m/44\'/0\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/49\'/2\'/0\'/0/0","showOnTrezor":false,"coin":"ltc"}'),
        JSON.parse(
          '{"payload":{"address":"MFoQRU1KQq365Sy3cXhix3ygycEU4YWB1V","path":[2147483697,2147483650,2147483648,0,0],"serializedPath":"m/49\'/2\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/44\'/5\'/0\'/0/0","showOnTrezor":false,"coin":"dash"}'),
        JSON.parse(
          '{"payload":{"address":"XxKhGNv6ECbqVswm9KYcLPQnyWgZ86jJ6Q","path":[2147483692,2147483653,2147483648,0,0],"serializedPath":"m/44\'/5\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/44\'/2\'/0\'/0/0","showOnTrezor":false,"coin":"ltc"}'),
        JSON.parse(
          '{"payload":{"address":"LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ","path":[2147483692,2147483650,2147483648,0,0],"serializedPath":"m/44\'/2\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse(
          '{"path":"m/44\'/2\'/0\'/0/0","showOnTrezor":true,"coin":"ltc","address":"LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ"}'
        ),
        JSON.parse(
          '{"payload":{"address":"LYXTv5RdsPYKC4qGmb6x6SuKoFMxUdSjLQ","path":[2147483692,2147483650,2147483648,0,0],"serializedPath":"m/44\'/2\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/84\'/2\'/0\'/0/0","showOnTrezor":false,"coin":"ltc"}'),
        JSON.parse(
          '{"payload":{"address":"ltc1qf6pwfkw4wd0fetq2pfrwzlfknskjg6nyvt6ngv","path":[2147483732,2147483650,2147483648,0,0],"serializedPath":"m/84\'/2\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/84\'/2\'/0\'/0/0","showOnTrezor":false,"coin":"ltc"}'),
        JSON.parse(
          '{"payload":{"address":"ltc1qf6pwfkw4wd0fetq2pfrwzlfknskjg6nyvt6ngv","path":[2147483732,2147483650,2147483648,0,0],"serializedPath":"m/84\'/2\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "ethereumSignTransaction",
        JSON.parse(
          '{"path":[2147483692,2147483708,2147483648,0,0],"transaction":{"to":"0x12eC06288EDD7Ae2CC41A843fE089237fC7354F0","value":"0x2c68af0bb14000","data":"","chainId":1,"nonce":"0x01","gasLimit":"0x5622","gasPrice":"0x1dcd65000"}}'
        ),
        JSON.parse(
          '{"success":true,"payload":{"v":38,"r":"0x63db3dd3bf3e1fe7dde1969c0fc8850e34116d0b501c0483a0e08c0f77b8ce0a","s":"0x28297d012cccf389f6332415e96ee3fc0bbf8474d05f646e029cd281a031464b"}}'
        )
      );
      this.memoize(
        "loadDevice",
        JSON.parse('{"mnemonic":"all all all all all all all all all all all all","label":"test"}'),
        JSON.parse('{"success":true}')
      );
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/49\'/0\'/0\'/0/0","showOnTrezor":false,"coin":"btc"}'),
        JSON.parse(
          '{"payload":{"address":"3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX","path":[2147483697,2147483648,2147483648,0,0],"serializedPath":"m/49\'/0\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "getAddress",
        JSON.parse('{"path":"m/49\'/0\'/0\'/0/0","showOnTrezor":false,"coin":"btc"}'),
        JSON.parse(
          '{"payload":{"address":"3AnYTd2FGxJLNKL1AzxfW3FJMntp9D2KKX","path":[2147483697,2147483648,2147483648,0,0],"serializedPath":"m/49\'/0\'/0\'/0/0"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "signTransaction",
        JSON.parse(
          '{"coin":"testnet","inputs":[{"address_n":[2147483697,2147483649,2147483648,1,0],"prev_hash":"20912f98ea3ed849042efed0fdac8cb4fc301961c5988cba56902d8ffb61c337","prev_index":0}],"outputs":[{"address":"mhRx1CeVfaayqRwq5zgRQmD7W5aWBfD5mC","amount":"12300000","script_type":"PAYTOADDRESS"},{"address_n":[2147483697,2147483649,2147483648,1,0],"amount":"111145789","scriptType":"PAYTOP2SHWitness"}],"push":false}'
        ),
        JSON.parse(
          '{"payload":{"signatures":["fixme"],"serializedTx":"0100000000010137c361fb8f2d9056ba8c98c5611930fcb48cacfdd0fe2e0449d83eea982f91200000000017160014d16b8c0680c61fc6ed2e407455715055e41052f5ffffffff02e0aebb00000000001976a91414fdede0ddc3be652a0ce1afbc1b509a55b6b94888ac3df39f060000000017a91458b53ea7f832e8f096e896b8713a8c6df0e892ca8702483045022100ccd253bfdf8a5593cd7b6701370c531199f0f05a418cd547dfc7da3f21515f0f02203fa08a0753688871c220648f9edadbdb98af42e5d8269364a326572cf703895b012103e7bfe10708f715e8538c92d46ca50db6f657bbc455b7494e6a0303ccdb868b7900000000"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "signTransaction",
        JSON.parse(
          '{"coin":"testnet","inputs":[{"address_n":[2147483732,2147483649,2147483648,0,0],"prev_hash":"09144602765ce3dd8f4329445b20e3684e948709c5cdcaf12da3bb079c99448a","prev_index":0}],"outputs":[{"address":"2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp","amount":"5000000","script_type":"PAYTOADDRESS"},{"address_n":[2147483732,2147483649,2147483648,1,0],"amount":"7289000","scriptType":"PAYTOWITNESS"}],"push":false}'
        ),
        JSON.parse(
          '{"payload":{"signatures":["fixme"],"serializedTx":"010000000001018a44999c07bba32df1cacdc50987944e68e3205b4429438fdde35c76024614090000000000ffffffff02404b4c000000000017a9147a55d61848e77ca266e79a39bfc85c580a6426c987a8386f0000000000160014cc8067093f6f843d6d3e22004a4290cd0c0f336b024730440220067675423ca6a0be3ddd5e13da00a9433775041e5cebc838873d2686f1d2840102201a5819e0312e6451d6b6180689101bce995685a51524cc4c3a5383f7bdab979a012103adc58245cf28406af0ef5cc24b8afba7f1be6c72f279b642d85c48798685f86200000000"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "signTransaction",
        JSON.parse(
          '{"coin":"btc","inputs":[{"address_n":[0],"prev_hash":"d5f65ee80147b4bcc70b75e4bbf2d7382021b871bd8867ef8fa525ef50864882","prev_index":0,"amount":"390000","script_type":"SPENDADDRESS"}],"outputs":[{"address":"1MJ2tj2ThBE62zXbBYA5ZaN3fdve5CPAz1","amount":"380000","script_type":"PAYTOADDRESS"}],"push":false}'
        ),
        JSON.parse(
          '{"payload":{"signatures":["30450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede781"],"serializedTx":"010000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000006b4830450221009a0b7be0d4ed3146ee262b42202841834698bb3ee39c24e7437df208b8b7077102202b79ab1e7736219387dffe8d615bbdba87e11477104b867ef47afed1a5ede7810121023230848585885f63803a0a8aecdd6538792d5c539215c91698e315bf0253b43dffffffff0160cc0500000000001976a914de9b2a8da088824e8fe51debea566617d851537888ac00000000"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "signTransaction",
        JSON.parse(
          '{"coin":"testnet","inputs":[{"address_n":[2147483697,2147483649,2147483648,1,0],"prev_hash":"20912f98ea3ed849042efed0fdac8cb4fc301961c5988cba56902d8ffb61c337","prev_index":0,"amount":"123456789","script_type":"SPENDP2SHWITNESS"}],"outputs":[{"address":"mhRx1CeVfaayqRwq5zgRQmD7W5aWBfD5mC","amount":"12300000","script_type":"PAYTOADDRESS"},{"address_n":[2147483697,2147483649,2147483648,1,0],"amount":"111145789","script_type":"PAYTOP2SHWITNESS"}],"push":false}'
        ),
        JSON.parse(
          '{"payload":{"signatures":["fixme"],"serializedTx":"0100000000010137c361fb8f2d9056ba8c98c5611930fcb48cacfdd0fe2e0449d83eea982f91200000000017160014d16b8c0680c61fc6ed2e407455715055e41052f5ffffffff02e0aebb00000000001976a91414fdede0ddc3be652a0ce1afbc1b509a55b6b94888ac3df39f060000000017a91458b53ea7f832e8f096e896b8713a8c6df0e892ca8702483045022100ccd253bfdf8a5593cd7b6701370c531199f0f05a418cd547dfc7da3f21515f0f02203fa08a0753688871c220648f9edadbdb98af42e5d8269364a326572cf703895b012103e7bfe10708f715e8538c92d46ca50db6f657bbc455b7494e6a0303ccdb868b7900000000"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "signTransaction",
        JSON.parse(
          '{"coin":"testnet","inputs":[{"address_n":[2147483732,2147483649,2147483648,0,0],"prev_hash":"e4b5b24159856ea18ab5819832da3b4a6330f9c3c0a46d96674e632df504b56b","prev_index":0,"amount":"100000","script_type":"SPENDWITNESS"}],"outputs":[{"address":"2N4Q5FhU2497BryFfUgbqkAJE87aKHUhXMp","amount":"50000","script_type":"PAYTOADDRESS"},{"address_n":[2147483732,2147483649,2147483648,1,0],"amount":"49000","script_type":"PAYTOWITNESS"}],"push":false}'
        ),
        JSON.parse(
          '{"payload":{"signatures":["fixme"],"serializedTx":"010000000001016bb504f52d634e67966da4c0c3f930634a3bda329881b58aa16e855941b2b5e40000000000ffffffff0250c300000000000017a9147a55d61848e77ca266e79a39bfc85c580a6426c98768bf000000000000160014cc8067093f6f843d6d3e22004a4290cd0c0f336b0247304402200f62d997b9dafe79a7a680626f4510a0b1be7a6e6b67607985e611f771c8acaf022009b3fb8ea7d8a80daa3e4cb44d51ba40289b049c59741e906424c55e90df9900012103adc58245cf28406af0ef5cc24b8afba7f1be6c72f279b642d85c48798685f86200000000"},"id":2,"success":true}'
        )
      );
      this.memoize(
        "signTransaction",
        JSON.parse(
          '{"coin":"btc","inputs":[{"address_n":[0],"prev_hash":"d5f65ee80147b4bcc70b75e4bbf2d7382021b871bd8867ef8fa525ef50864882","prev_index":0,"amount":"390000","script_type":"SPENDADDRESS"}],"outputs":[{"address":"bc1qksxqxurvejkndenuv0alqawpr3e4vtqkn246cu","amount":"380000","script_type":"PAYTOADDRESS"},{"address":"1FH6ehAd5ZFXCM1cLGzHxK1s4dGdq1JusM","amount":"9000","script_type":"PAYTOADDRESS"}],"push":false}'
        ),
        JSON.parse(
          '{"payload":{"signatures":["304402207eee02e732e17618c90f8fdcaf3da24e2cfe2fdd6e37094b73f225360029515002205c29f80efc0bc077fa63633ff9ce2c44e0f109f70221a91afb7c531cdbb6305c"],"serializedTx":"010000000182488650ef25a58fef6788bd71b8212038d7f2bbe4750bc7bcb44701e85ef6d5000000006a47304402207eee02e732e17618c90f8fdcaf3da24e2cfe2fdd6e37094b73f225360029515002205c29f80efc0bc077fa63633ff9ce2c44e0f109f70221a91afb7c531cdbb6305c0121023230848585885f63803a0a8aecdd6538792d5c539215c91698e315bf0253b43dffffffff0360cc050000000000160014b40c03706cccad36e67c63fbf075c11c73562c1628230000000000001976a9149c9d21f47382762df3ad81391ee0964b28dd951788ac00000000000000003d6a3b535741503a4554482e4554483a3078393331443338373733316242624339383842333132323036633734463737443030344436423834623a34323000000000"},"id":2,"success":true}'
        )
      );
      this.memoize("getFeatures", {}, { success: true, payload: { initialized: true } });
    } catch (e) {
      console.error(e);
    }
  }
}

export function name(): string {
  return "Trezor";
}

export async function createWallet(): Promise<core.HDWallet> {
  const keyring = new core.Keyring();
  const transport = new MockTransport(keyring);
  return trezor.create(transport as trezor.TrezorTransport);
}

export function createInfo(): core.HDWalletInfo {
  return trezor.info();
}

export function selfTest(get: () => core.HDWallet): void {
  let wallet: trezor.TrezorHDWallet & core.ETHWallet & core.BTCWallet & core.HDWallet;

  beforeAll(async () => {
    const w = get();
    if (trezor.isTrezor(w) && core.supportsBTC(w) && core.supportsETH(w)) {
      wallet = w;
    } else {
      throw new Error("Wallet is not a Trezor");
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

  it("uses the same BIP32 paths for ETH as wallet.trezor.io", () => {
    if (!wallet) return;
    [0, 1, 3, 27].forEach((account) => {
      const paths = wallet.ethGetAccountPaths({
        coin: "Ethereum",
        accountIdx: account,
      });
      expect(paths).toEqual([
        {
          addressNList: core.bip32ToAddressNList(`m/44'/60'/0'/0/${account}`),
          hardenedPath: core.bip32ToAddressNList("m/44'/60'/0'"),
          relPath: core.bip32ToAddressNList(`m/0/${account}`),
          description: "Trezor",
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
      verbose: "m/44'/60'/3'/0/0",
      coin: "Ethereum",
      isKnown: false,
    });

    expect(
      wallet.info.describePath({
        path: core.bip32ToAddressNList("m/44'/60'/0'/0/3"),
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
  });
}
