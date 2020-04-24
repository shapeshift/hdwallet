

let unsigned = {
    "expiration": "2018-07-14T07:43:28",
    "ref_block_num": 6439,
    "ref_block_prefix": 2995713264,
    "max_net_usage_words": 0,
    "max_cpu_usage_ms": 0,
    "delay_sec": 0,
    "context_free_actions": [],
    "actions": [
        {
            "account": "eosio.token",
            "name": "transfer",
            "authorization": [
                {
                    "actor": "xhackmebrosx",
                    "permission": "active"
                }
            ],
            "data": {
                "from": "xhackmebrosx",
                "to": "xhighlanderx",
                "quantity": "0.0001 EOS",
                "memo": "testmemo"
            }
        }
    ]
}

let action = [ { account: 'eosio.token',
    name: 'transfer',
    authorization: [ [Object] ],
    data:
      { from: 'xhackmebrosx',
          to: 'xhighlanderx',
          quantity: '0.0001 EOS',
          memo: 'testmemo' } } ]

let actionHex = "D031BD4749884CEBD0AF4AD3C4C65CEB010000000000000004454F530000000008746573746D656D6F"

let asHex = "426ca25e8439fee4342a000000000100a6823403ea3055000000572d3ccdcd01d031bd4749884ceb00000000a8ed323229d031bd4749884cebd0af4ad3c4c65ceb010000000000000004454f530000000008746573746d656d6f00"

//let keepkeySig
let sigV = 32
let sigR = "685e2414257cb3fd87bc9af6b99e04f9891d912c9240f6113a3bbd98a6b9b3d7"
let sigS = "5a55bf57d5e1e1d87cbfcbda90f1eca4a72843708a1d0c1e134511ddb5711322"
let hash = "3af6d9173cde35533215450df90150cbff1b6a67d375d415f69f2ee07953f955"

// ???

//final
let sigExpected = "SIG_K1_JyeA2rZQwYiqps5TdP2SRw823BxKVr2LQD9zZFeqSkzq4fvDd93aU3aSAPK1XUsWSp6jz5tphKqkyBs8BuLtcppRsv5THS"
