import * as fio from "fiosdk-offline";
import * as core from "@shapeshiftoss/hdwallet-core";
import * as NativeHDWallet from "./native";
import { base58, sha256 } from "ethers/lib/utils";
import * as tinyecc from "tiny-secp256k1";

const MNEMONIC = "all all all all all all all all all all all all";

const mswMock = require("mswMock")({
  get: {
    "https://fio.eu.eosamsterdam.net/v1/chain/get_info": {
      server_version: "0b30e123",
      chain_id: "21dcae42c0182200e93f954a074011f9048a7624c6fe81d3c9541a614a88bd1c",
      head_block_num: 61842307,
      last_irreversible_block_num: 61841978,
      last_irreversible_block_id: "03afa23a114cfee7ef1c7ca90e270422fe37396080738ece42391d9ef31440e8",
      head_block_id: "03afa38300f285879d00fe0f2f659f7a4b09d134dcd678ad12fc788dccf67952",
      head_block_time: "2021-03-18T00:05:14.000",
      head_block_producer: "aloha3joooqd",
      virtual_block_cpu_limit: 200000000,
      virtual_block_net_limit: 1048576000,
      block_cpu_limit: 199900,
      block_net_limit: 1048576,
      server_version_string: "v2.0.0",
      fork_db_head_block_num: 61842307,
      fork_db_head_block_id: "03afa38300f285879d00fe0f2f659f7a4b09d134dcd678ad12fc788dccf67952",
    },
  },
  post: {
    "https://fio.eu.eosamsterdam.net/v1/chain/get_block": {
      timestamp: "2021-03-18T00:02:29.500",
      producer: "sweidrpkehv2",
      confirmed: 0,
      previous: "03afa2397459431ac5325ceefccfc17168d96efa07198221a48dc7339e4cc265",
      transaction_mroot: "0000000000000000000000000000000000000000000000000000000000000000",
      action_mroot: "5ceb022b440279ec9943e07564aadfa82a3fadfccc9531510ae60c8d6e035d4e",
      schedule_version: 73,
      new_producers: null,
      header_extensions: [],
      producer_signature:
        "SIG_K1_KAJ9KUhQ94GWqPGmZ13rzHYbaR7kB3f4xaK73G24EEU82fMjboJTtBxZWk65Qdcy3iQimgeJ6bUWaSsU7kmmMMMFwb2fmR",
      transactions: [],
      block_extensions: [],
      id: "03afa23a114cfee7ef1c7ca90e270422fe37396080738ece42391d9ef31440e8",
      block_num: 61841978,
      ref_block_prefix: 2843483375,
    },
    "https://fio.eu.eosamsterdam.net/v1/chain/get_raw_abi": (body) => {
      const abis = {
        "fio.address": {
          account_name: "fio.address",
          code_hash: "0aacfee458bee8aa4ba6773bfcf05f9d3565a12e2ea03dfa4124aa32672d6948",
          abi_hash: "0dca0ca50be70bb04a84c2494e3eecdf72c083498a3acdbe0ed7ebc4a89d8ad9",
          abi:
            "DmVvc2lvOjphYmkvMS4wABMHZmlvbmFtZQAJAmlkBnVpbnQ2NARuYW1lBnN0cmluZwhuYW1laGFzaAd1aW50MTI4BmRvbWFpbgZzdHJpbmcKZG9tYWluaGFzaAd1aW50MTI4CmV4cGlyYXRpb24GdWludDY0DW93bmVyX2FjY291bnQEbmFtZQlhZGRyZXNzZXMOdG9rZW5wdWJhZGRyW10XYnVuZGxlZWxpZ2libGVjb3VudGRvd24GdWludDY0BmRvbWFpbgAGAmlkBnVpbnQ2NARuYW1lBnN0cmluZwpkb21haW5oYXNoB3VpbnQxMjgHYWNjb3VudARuYW1lCWlzX3B1YmxpYwV1aW50OApleHBpcmF0aW9uBnVpbnQ2NAplb3Npb19uYW1lAAMHYWNjb3VudARuYW1lCWNsaWVudGtleQZzdHJpbmcHa2V5aGFzaAd1aW50MTI4CnJlZ2FkZHJlc3MABQtmaW9fYWRkcmVzcwZzdHJpbmcUb3duZXJfZmlvX3B1YmxpY19rZXkGc3RyaW5nB21heF9mZWUFaW50NjQFYWN0b3IEbmFtZQR0cGlkBnN0cmluZwx0b2tlbnB1YmFkZHIAAwp0b2tlbl9jb2RlBnN0cmluZwpjaGFpbl9jb2RlBnN0cmluZw5wdWJsaWNfYWRkcmVzcwZzdHJpbmcKYWRkYWRkcmVzcwAFC2Zpb19hZGRyZXNzBnN0cmluZxBwdWJsaWNfYWRkcmVzc2VzDnRva2VucHViYWRkcltdB21heF9mZWUFaW50NjQFYWN0b3IEbmFtZQR0cGlkBnN0cmluZwpyZW1hZGRyZXNzAAULZmlvX2FkZHJlc3MGc3RyaW5nEHB1YmxpY19hZGRyZXNzZXMOdG9rZW5wdWJhZGRyW10HbWF4X2ZlZQVpbnQ2NAVhY3RvcgRuYW1lBHRwaWQGc3RyaW5nCnJlbWFsbGFkZHIABAtmaW9fYWRkcmVzcwZzdHJpbmcHbWF4X2ZlZQVpbnQ2NAVhY3RvcgRuYW1lBHRwaWQGc3RyaW5nCXJlZ2RvbWFpbgAFCmZpb19kb21haW4Gc3RyaW5nFG93bmVyX2Zpb19wdWJsaWNfa2V5BnN0cmluZwdtYXhfZmVlBWludDY0BWFjdG9yBG5hbWUEdHBpZAZzdHJpbmcLcmVuZXdkb21haW4ABApmaW9fZG9tYWluBnN0cmluZwdtYXhfZmVlBWludDY0BHRwaWQGc3RyaW5nBWFjdG9yBG5hbWUMcmVuZXdhZGRyZXNzAAQLZmlvX2FkZHJlc3MGc3RyaW5nB21heF9mZWUFaW50NjQEdHBpZAZzdHJpbmcFYWN0b3IEbmFtZQxzZXRkb21haW5wdWIABQpmaW9fZG9tYWluBnN0cmluZwlpc19wdWJsaWMEaW50OAdtYXhfZmVlBWludDY0BWFjdG9yBG5hbWUEdHBpZAZzdHJpbmcLYnVybmV4cGlyZWQAAAtkZWNyY291bnRlcgACC2Zpb19hZGRyZXNzBnN0cmluZwRzdGVwBWludDMyCmJpbmQyZW9zaW8AAwdhY2NvdW50BG5hbWUKY2xpZW50X2tleQZzdHJpbmcIZXhpc3RpbmcEYm9vbAtidXJuYWRkcmVzcwAEC2Zpb19hZGRyZXNzBnN0cmluZwdtYXhfZmVlBWludDY0BHRwaWQGc3RyaW5nBWFjdG9yBG5hbWUKeGZlcmRvbWFpbgAFCmZpb19kb21haW4Gc3RyaW5nGG5ld19vd25lcl9maW9fcHVibGljX2tleQZzdHJpbmcHbWF4X2ZlZQVpbnQ2NAVhY3RvcgRuYW1lBHRwaWQGc3RyaW5nC3hmZXJhZGRyZXNzAAULZmlvX2FkZHJlc3MGc3RyaW5nGG5ld19vd25lcl9maW9fcHVibGljX2tleQZzdHJpbmcHbWF4X2ZlZQVpbnQ2NAVhY3RvcgRuYW1lBHRwaWQGc3RyaW5nCmFkZGJ1bmRsZXMABQtmaW9fYWRkcmVzcwZzdHJpbmcLYnVuZGxlX3NldHMFaW50NjQHbWF4X2ZlZQVpbnQ2NAR0cGlkBnN0cmluZwVhY3RvcgRuYW1lDwCuylNTdJFKC2RlY3Jjb3VudGVyAAAAxuqmZJi6CnJlZ2FkZHJlc3MAAADG6qZkUjIKYWRkYWRkcmVzcwAAAMbqpmSkugpyZW1hZGRyZXNzAADATcnEaKS6CnJlbWFsbGFkZHIAAACYzkiamLoJcmVnZG9tYWluAACmM5Imrqa6C3JlbmV3ZG9tYWluAICxuikZrqa6DHJlbmV3YWRkcmVzcwAAkrqudjWvPgtidXJuZXhwaXJlZABwdJ3OSJqywgxzZXRkb21haW5wdWIAAAB1mCqRpjsKYmluZDJlb3NpbwAAMFY3JTOvPgtidXJuYWRkcmVzcwAAwHRG0nTV6gp4ZmVyZG9tYWluAAAwVjclc9XqC3hmZXJhZGRyZXNzAAAAVjFNfVIyCmFkZGJ1bmRsZXMAAwAAAFhJM6lbA2k2NAECaWQBBnN0cmluZwdmaW9uYW1lAAAAAE9nJE0DaTY0AQJpZAEGc3RyaW5nBmRvbWFpbgBANTJPTREyA2k2NAEHYWNjb3VudAEGdWludDY0CmVvc2lvX25hbWUAAAAA=",
        },
        "fio.reqobt": {
          account_name: "fio.reqobt",
          code_hash: "acf8c14120e6930948e8977e9f7472054fb87066fd15da7ab1b4e5970d6885f5",
          abi_hash: "93118de6229f77f4213dc948674c4e11d462f573db821204224a73628b942ffd",
          abi:
            "DmVvc2lvOjphYmkvMS4wAAoKZmlvcmVxY3R4dAANDmZpb19yZXF1ZXN0X2lkBnVpbnQ2NBFwYXllcl9maW9fYWRkcmVzcwd1aW50MTI4EXBheWVlX2Zpb19hZGRyZXNzB3VpbnQxMjgZcGF5ZXJfZmlvX2FkZHJlc3NfaGV4X3N0cgZzdHJpbmcZcGF5ZWVfZmlvX2FkZHJlc3NfaGV4X3N0cgZzdHJpbmcbcGF5ZXJfZmlvX2FkZHJlc3Nfd2l0aF90aW1lB3VpbnQxMjgbcGF5ZWVfZmlvX2FkZHJlc3Nfd2l0aF90aW1lB3VpbnQxMjgHY29udGVudAZzdHJpbmcKdGltZV9zdGFtcAZ1aW50NjQOcGF5ZXJfZmlvX2FkZHIGc3RyaW5nDnBheWVlX2Zpb19hZGRyBnN0cmluZwlwYXllcl9rZXkGc3RyaW5nCXBheWVlX2tleQZzdHJpbmcOcmVjb3Jkb2J0X2luZm8ADQJpZAZ1aW50NjQRcGF5ZXJfZmlvX2FkZHJlc3MHdWludDEyOBFwYXllZV9maW9fYWRkcmVzcwd1aW50MTI4GXBheWVyX2Zpb19hZGRyZXNzX2hleF9zdHIGc3RyaW5nGXBheWVlX2Zpb19hZGRyZXNzX2hleF9zdHIGc3RyaW5nG3BheWVyX2Zpb19hZGRyZXNzX3dpdGhfdGltZQd1aW50MTI4G3BheWVlX2Zpb19hZGRyZXNzX3dpdGhfdGltZQd1aW50MTI4B2NvbnRlbnQGc3RyaW5nCnRpbWVfc3RhbXAGdWludDY0DnBheWVyX2Zpb19hZGRyBnN0cmluZw5wYXllZV9maW9fYWRkcgZzdHJpbmcJcGF5ZXJfa2V5BnN0cmluZwlwYXllZV9rZXkGc3RyaW5nCWZpb3JlcXN0cwAFAmlkBnVpbnQ2NA5maW9fcmVxdWVzdF9pZAZ1aW50NjQGc3RhdHVzBnVpbnQ2NAhtZXRhZGF0YQZzdHJpbmcKdGltZV9zdGFtcAZ1aW50NjQMZmlvdHJ4dF9pbmZvAA8CaWQGdWludDY0DmZpb19yZXF1ZXN0X2lkBnVpbnQ2NBJwYXllcl9maW9fYWRkcl9oZXgHdWludDEyOBJwYXllZV9maW9fYWRkcl9oZXgHdWludDEyOA1maW9fZGF0YV90eXBlBXVpbnQ4CHJlcV90aW1lBnVpbnQ2NA5wYXllcl9maW9fYWRkcgZzdHJpbmcOcGF5ZWVfZmlvX2FkZHIGc3RyaW5nCXBheWVyX2tleQZzdHJpbmcJcGF5ZWVfa2V5BnN0cmluZw1wYXllcl9hY2NvdW50BG5hbWUNcGF5ZWVfYWNjb3VudARuYW1lC3JlcV9jb250ZW50BnN0cmluZwtvYnRfY29udGVudAZzdHJpbmcIb2J0X3RpbWUGdWludDY0Cm1pZ3JsZWRnZXIABwJpZAZ1aW50NjQIYmVnaW5vYnQFaW50NjQKY3VycmVudG9idAVpbnQ2NAdiZWdpbnJxBWludDY0CWN1cnJlbnRycQVpbnQ2NApjdXJyZW50c3RhBWludDY0CmlzRmluaXNoZWQEaW50OAdtaWdydHJ4AAIGYW1vdW50BWludDE2BWFjdG9yBnN0cmluZwlyZWNvcmRvYnQABw5maW9fcmVxdWVzdF9pZAZzdHJpbmcRcGF5ZXJfZmlvX2FkZHJlc3MGc3RyaW5nEXBheWVlX2Zpb19hZGRyZXNzBnN0cmluZwdjb250ZW50BnN0cmluZwdtYXhfZmVlBWludDY0BWFjdG9yBnN0cmluZwR0cGlkBnN0cmluZwtuZXdmdW5kc3JlcQAGEXBheWVyX2Zpb19hZGRyZXNzBnN0cmluZxFwYXllZV9maW9fYWRkcmVzcwZzdHJpbmcHY29udGVudAZzdHJpbmcHbWF4X2ZlZQVpbnQ2NAVhY3RvcgZzdHJpbmcEdHBpZAZzdHJpbmcMcmVqZWN0Zm5kcmVxAAQOZmlvX3JlcXVlc3RfaWQGc3RyaW5nB21heF9mZWUFaW50NjQFYWN0b3IGc3RyaW5nBHRwaWQGc3RyaW5nDGNhbmNlbGZuZHJlcQAEDmZpb19yZXF1ZXN0X2lkBnN0cmluZwdtYXhfZmVlBWludDY0BWFjdG9yBnN0cmluZwR0cGlkBnN0cmluZwUAAACg33yZkwdtaWdydHJ4AAAAyIemS5G6CXJlY29yZG9idAAArLo4Tb24mgtuZXdmdW5kc3JlcQBg1U1zZaSeugxyZWplY3RmbmRyZXEAYNVNc0WFpkEMY2FuY2VsZm5kcmVxAAUAcO4ZWXWpWwNpNjQBDmZpb19yZXF1ZXN0X2lkAQZ1aW50NjQKZmlvcmVxY3R4dAAAzoemS5G6A2k2NAECaWQBBnVpbnQ2NA5yZWNvcmRvYnRfaW5mbwAAxhlbdalbA2k2NAECaWQBBnVpbnQ2NAlmaW9yZXFzdHMAAMA495upWwNpNjQBAmlkAQZ1aW50NjQMZmlvdHJ4dF9pbmZvAPBVLKl4mZMDaTY0AQJpZAEGdWludDY0Cm1pZ3JsZWRnZXIAAAAA=",
        },
        "fio.token": {
          account_name: "fio.token",
          code_hash: "f20c3d91844682c1ac035fee1509f1c91a934122e372ac6df45594bb3f3f171e",
          abi_hash: "b368fbc363f0da588eea9c943b75caadffb881dcb4dc4f283bfee7a86c97850f",
          abi:
            "DmVvc2lvOjphYmkvMS4xAAoHYWNjb3VudAABB2JhbGFuY2UFYXNzZXQGY3JlYXRlAAEObWF4aW11bV9zdXBwbHkFYXNzZXQOY3VycmVuY3lfc3RhdHMAAwZzdXBwbHkFYXNzZXQKbWF4X3N1cHBseQVhc3NldAZpc3N1ZXIEbmFtZQVpc3N1ZQADAnRvBG5hbWUIcXVhbnRpdHkFYXNzZXQEbWVtbwZzdHJpbmcLbG9ja3BlcmlvZHMAAghkdXJhdGlvbgVpbnQ2NAdwZXJjZW50B2Zsb2F0NjQHbWludGZpbwACAnRvBG5hbWUGYW1vdW50BnVpbnQ2NAZyZXRpcmUAAghxdWFudGl0eQVhc3NldARtZW1vBnN0cmluZwh0cmFuc2ZlcgAEBGZyb20EbmFtZQJ0bwRuYW1lCHF1YW50aXR5BWFzc2V0BG1lbW8Gc3RyaW5nDHRybnNmaW9wdWJreQAFEHBheWVlX3B1YmxpY19rZXkGc3RyaW5nBmFtb3VudAVpbnQ2NAdtYXhfZmVlBWludDY0BWFjdG9yBG5hbWUEdHBpZAZzdHJpbmcLdHJuc2xvY3Rva3MABxBwYXllZV9wdWJsaWNfa2V5BnN0cmluZwhjYW5fdm90ZQVpbnQzMgdwZXJpb2RzDWxvY2twZXJpb2RzW10GYW1vdW50BWludDY0B21heF9mZWUFaW50NjQFYWN0b3IEbmFtZQR0cGlkBnN0cmluZwcAAAAAqGzURQZjcmVhdGUAAAAAAAClMXYFaXNzdWUAAAAAgLqVp5MHbWludGZpbwAAAAAAqOuyugZyZXRpcmUAAAAAVy08zc0IdHJhbnNmZXIA4OHRlbqF580MdHJuc2Zpb3B1Ymt5AAAwpBnRiOfNC3RybnNsb2N0b2tzAAIAAAA4T00RMgNpNjQAAAdhY2NvdW50AAAAAACQTcYDaTY0AAAOY3VycmVuY3lfc3RhdHMAAAAA=",
        },
        eosio: {
          account_name: "eosio",
          code_hash: "811bd423b5d3ba3ac4760e15acfa298fa2b9896b319812a40019b37b3ecfb450",
          abi_hash: "ead7a5cf52addda442d99acf5a35494f235330392b02c4ced3d4a09dd5a7602d",
          abi:
            "DmVvc2lvOjphYmkvMS4xADcIYWJpX2hhc2gAAgVvd25lcgRuYW1lBGhhc2gLY2hlY2tzdW0yNTYJYWRkYWN0aW9uAAMGYWN0aW9uBG5hbWUIY29udHJhY3QGc3RyaW5nBWFjdG9yBG5hbWUMYWRkZ2VubG9ja2VkAAQFb3duZXIEbmFtZQdwZXJpb2RzDWxvY2twZXJpb2RzW10HY2Fudm90ZQRib29sBmFtb3VudAVpbnQ2NAlhZGRsb2NrZWQAAwVvd25lcgRuYW1lBmFtb3VudAVpbnQ2NAhsb2NrdHlwZQVpbnQxNglhdXRob3JpdHkABAl0aHJlc2hvbGQGdWludDMyBGtleXMMa2V5X3dlaWdodFtdCGFjY291bnRzGXBlcm1pc3Npb25fbGV2ZWxfd2VpZ2h0W10Fd2FpdHMNd2FpdF93ZWlnaHRbXQxibG9ja19oZWFkZXIACAl0aW1lc3RhbXAGdWludDMyCHByb2R1Y2VyBG5hbWUJY29uZmlybWVkBnVpbnQxNghwcmV2aW91cwtjaGVja3N1bTI1NhF0cmFuc2FjdGlvbl9tcm9vdAtjaGVja3N1bTI1NgxhY3Rpb25fbXJvb3QLY2hlY2tzdW0yNTYQc2NoZWR1bGVfdmVyc2lvbgZ1aW50MzINbmV3X3Byb2R1Y2VycxJwcm9kdWNlcl9zY2hlZHVsZT8VYmxvY2tjaGFpbl9wYXJhbWV0ZXJzABETbWF4X2Jsb2NrX25ldF91c2FnZQZ1aW50NjQadGFyZ2V0X2Jsb2NrX25ldF91c2FnZV9wY3QGdWludDMyGW1heF90cmFuc2FjdGlvbl9uZXRfdXNhZ2UGdWludDMyHmJhc2VfcGVyX3RyYW5zYWN0aW9uX25ldF91c2FnZQZ1aW50MzIQbmV0X3VzYWdlX2xlZXdheQZ1aW50MzIjY29udGV4dF9mcmVlX2Rpc2NvdW50X25ldF91c2FnZV9udW0GdWludDMyI2NvbnRleHRfZnJlZV9kaXNjb3VudF9uZXRfdXNhZ2VfZGVuBnVpbnQzMhNtYXhfYmxvY2tfY3B1X3VzYWdlBnVpbnQzMhp0YXJnZXRfYmxvY2tfY3B1X3VzYWdlX3BjdAZ1aW50MzIZbWF4X3RyYW5zYWN0aW9uX2NwdV91c2FnZQZ1aW50MzIZbWluX3RyYW5zYWN0aW9uX2NwdV91c2FnZQZ1aW50MzIYbWF4X3RyYW5zYWN0aW9uX2xpZmV0aW1lBnVpbnQzMh5kZWZlcnJlZF90cnhfZXhwaXJhdGlvbl93aW5kb3cGdWludDMyFW1heF90cmFuc2FjdGlvbl9kZWxheQZ1aW50MzIWbWF4X2lubGluZV9hY3Rpb25fc2l6ZQZ1aW50MzIXbWF4X2lubGluZV9hY3Rpb25fZGVwdGgGdWludDE2E21heF9hdXRob3JpdHlfZGVwdGgGdWludDE2CmJ1cm5hY3Rpb24AAQtmaW9hZGRyaGFzaAd1aW50MTI4C2NhbmNlbGRlbGF5AAIOY2FuY2VsaW5nX2F1dGgQcGVybWlzc2lvbl9sZXZlbAZ0cnhfaWQLY2hlY2tzdW0yNTYLY3JhdXRvcHJveHkAAgVwcm94eQRuYW1lBW93bmVyBG5hbWUKZGVsZXRlYXV0aAADB2FjY291bnQEbmFtZQpwZXJtaXNzaW9uBG5hbWUHbWF4X2ZlZQZ1aW50NjQSZW9zaW9fZ2xvYmFsX3N0YXRlFWJsb2NrY2hhaW5fcGFyYW1ldGVycwsdbGFzdF9wcm9kdWNlcl9zY2hlZHVsZV91cGRhdGUUYmxvY2tfdGltZXN0YW1wX3R5cGUYbGFzdF9wZXJ2b3RlX2J1Y2tldF9maWxsCnRpbWVfcG9pbnQOcGVydm90ZV9idWNrZXQFaW50NjQPcGVyYmxvY2tfYnVja2V0BWludDY0E3RvdGFsX3VucGFpZF9ibG9ja3MGdWludDMyD3RvdGFsX3ZvdGVkX2ZpbwVpbnQ2NBV0aHJlc2hfdm90ZWRfZmlvX3RpbWUKdGltZV9wb2ludBtsYXN0X3Byb2R1Y2VyX3NjaGVkdWxlX3NpemUGdWludDE2GnRvdGFsX3Byb2R1Y2VyX3ZvdGVfd2VpZ2h0B2Zsb2F0NjQPbGFzdF9uYW1lX2Nsb3NlFGJsb2NrX3RpbWVzdGFtcF90eXBlD2xhc3RfZmVlX3VwZGF0ZRRibG9ja190aW1lc3RhbXBfdHlwZRNlb3Npb19nbG9iYWxfc3RhdGUyAAMObGFzdF9ibG9ja19udW0UYmxvY2tfdGltZXN0YW1wX3R5cGUcdG90YWxfcHJvZHVjZXJfdm90ZXBheV9zaGFyZQdmbG9hdDY0CHJldmlzaW9uBXVpbnQ4E2Vvc2lvX2dsb2JhbF9zdGF0ZTMAAhZsYXN0X3ZwYXlfc3RhdGVfdXBkYXRlCnRpbWVfcG9pbnQcdG90YWxfdnBheV9zaGFyZV9jaGFuZ2VfcmF0ZQdmbG9hdDY0BmluY3JhbQACCWFjY291bnRtbgRuYW1lBmFtb3VudAVpbnQ2NAxpbmhpYml0dW5sY2sAAgVvd25lcgRuYW1lBXZhbHVlBnVpbnQzMgRpbml0AAIHdmVyc2lvbgl2YXJ1aW50MzIEY29yZQZzeW1ib2wKa2V5X3dlaWdodAACA2tleQpwdWJsaWNfa2V5BndlaWdodAZ1aW50MTYIbGlua2F1dGgABQdhY2NvdW50BG5hbWUEY29kZQRuYW1lBHR5cGUEbmFtZQtyZXF1aXJlbWVudARuYW1lB21heF9mZWUGdWludDY0GGxvY2tlZF90b2tlbl9ob2xkZXJfaW5mbwAHBW93bmVyBG5hbWUSdG90YWxfZ3JhbnRfYW1vdW50BnVpbnQ2NBV1bmxvY2tlZF9wZXJpb2RfY291bnQGdWludDMyCmdyYW50X3R5cGUGdWludDMyEWluaGliaXRfdW5sb2NraW5nBnVpbnQzMhdyZW1haW5pbmdfbG9ja2VkX2Ftb3VudAZ1aW50NjQJdGltZXN0YW1wBnVpbnQzMhJsb2NrZWRfdG9rZW5zX2luZm8ACAJpZAVpbnQ2NA1vd25lcl9hY2NvdW50BG5hbWULbG9ja19hbW91bnQFaW50NjQRcGF5b3V0c19wZXJmb3JtZWQFaW50MzIIY2FuX3ZvdGUFaW50MzIHcGVyaW9kcw1sb2NrcGVyaW9kc1tdFXJlbWFpbmluZ19sb2NrX2Ftb3VudAVpbnQ2NAl0aW1lc3RhbXAGdWludDMyC2xvY2twZXJpb2RzAAIIZHVyYXRpb24FaW50NjQHcGVyY2VudAdmbG9hdDY0Cm5ld2FjY291bnQABAdjcmVhdG9yBG5hbWUEbmFtZQRuYW1lBW93bmVyCWF1dGhvcml0eQZhY3RpdmUJYXV0aG9yaXR5B29uYmxvY2sAAQZoZWFkZXIMYmxvY2tfaGVhZGVyB29uZXJyb3IAAglzZW5kZXJfaWQHdWludDEyOAhzZW50X3RyeAVieXRlcxBwZXJtaXNzaW9uX2xldmVsAAIFYWN0b3IEbmFtZQpwZXJtaXNzaW9uBG5hbWUXcGVybWlzc2lvbl9sZXZlbF93ZWlnaHQAAgpwZXJtaXNzaW9uEHBlcm1pc3Npb25fbGV2ZWwGd2VpZ2h0BnVpbnQxNg1wcm9kdWNlcl9pbmZvAAwCaWQGdWludDY0BW93bmVyBG5hbWULZmlvX2FkZHJlc3MGc3RyaW5nC2FkZHJlc3NoYXNoB3VpbnQxMjgLdG90YWxfdm90ZXMHZmxvYXQ2NBNwcm9kdWNlcl9wdWJsaWNfa2V5CnB1YmxpY19rZXkJaXNfYWN0aXZlBGJvb2wDdXJsBnN0cmluZw11bnBhaWRfYmxvY2tzBnVpbnQzMg9sYXN0X2NsYWltX3RpbWUKdGltZV9wb2ludAxsYXN0X2JwY2xhaW0GdWludDMyCGxvY2F0aW9uBnVpbnQxNgxwcm9kdWNlcl9rZXkAAg1wcm9kdWNlcl9uYW1lBG5hbWURYmxvY2tfc2lnbmluZ19rZXkKcHVibGljX2tleRFwcm9kdWNlcl9zY2hlZHVsZQACB3ZlcnNpb24GdWludDMyCXByb2R1Y2Vycw5wcm9kdWNlcl9rZXlbXQtyZWdwcm9kdWNlcgAGC2Zpb19hZGRyZXNzBnN0cmluZwtmaW9fcHViX2tleQZzdHJpbmcDdXJsBnN0cmluZwhsb2NhdGlvbgZ1aW50MTYFYWN0b3IEbmFtZQdtYXhfZmVlBWludDY0CHJlZ3Byb3h5AAMLZmlvX2FkZHJlc3MGc3RyaW5nBWFjdG9yBG5hbWUHbWF4X2ZlZQVpbnQ2NAlyZW1hY3Rpb24AAgZhY3Rpb24EbmFtZQVhY3RvcgRuYW1lCnJlc2V0Y2xhaW0AAQhwcm9kdWNlcgRuYW1lC3JtdnByb2R1Y2VyAAEIcHJvZHVjZXIEbmFtZQZzZXRhYmkAAgdhY2NvdW50BG5hbWUDYWJpBWJ5dGVzDHNldGF1dG9wcm94eQACBXByb3h5BG5hbWUFb3duZXIEbmFtZQdzZXRjb2RlAAQHYWNjb3VudARuYW1lBnZtdHlwZQV1aW50OAl2bXZlcnNpb24FdWludDgEY29kZQVieXRlcwlzZXRwYXJhbXMAAQZwYXJhbXMVYmxvY2tjaGFpbl9wYXJhbWV0ZXJzB3NldHByaXYAAgdhY2NvdW50BG5hbWUHaXNfcHJpdgV1aW50OA10b3BfcHJvZF9pbmZvAAEIcHJvZHVjZXIEbmFtZQp1bmxpbmthdXRoAAMHYWNjb3VudARuYW1lBGNvZGUEbmFtZQR0eXBlBG5hbWUMdW5sb2NrdG9rZW5zAAEFYWN0b3IEbmFtZQl1bnJlZ3Byb2QAAwtmaW9fYWRkcmVzcwZzdHJpbmcFYWN0b3IEbmFtZQdtYXhfZmVlBWludDY0CnVucmVncHJveHkAAwtmaW9fYWRkcmVzcwZzdHJpbmcFYWN0b3IEbmFtZQdtYXhfZmVlBWludDY0CnVwZGF0ZWF1dGgABQdhY2NvdW50BG5hbWUKcGVybWlzc2lvbgRuYW1lBnBhcmVudARuYW1lBGF1dGgJYXV0aG9yaXR5B21heF9mZWUGdWludDY0C3VwZGF0ZXBvd2VyAAIFdm90ZXIEbmFtZQp1cGRhdGVvbmx5BGJvb2wLdXBkbGJwY2xhaW0AAQhwcm9kdWNlcgRuYW1lCXVwZGxvY2tlZAACBW93bmVyBG5hbWUPYW1vdW50cmVtYWluaW5nBnVpbnQ2NAx1cGR0cmV2aXNpb24AAQhyZXZpc2lvbgV1aW50OA51c2VyX3Jlc291cmNlcwAEBW93bmVyBG5hbWUKbmV0X3dlaWdodAVhc3NldApjcHVfd2VpZ2h0BWFzc2V0CXJhbV9ieXRlcwVpbnQ2NAx2b3RlcHJvZHVjZXIABAlwcm9kdWNlcnMIc3RyaW5nW10LZmlvX2FkZHJlc3MGc3RyaW5nBWFjdG9yBG5hbWUHbWF4X2ZlZQVpbnQ2NAl2b3RlcHJveHkABAVwcm94eQZzdHJpbmcLZmlvX2FkZHJlc3MGc3RyaW5nBWFjdG9yBG5hbWUHbWF4X2ZlZQVpbnQ2NAp2b3Rlcl9pbmZvAAwCaWQGdWludDY0CmZpb2FkZHJlc3MGc3RyaW5nC2FkZHJlc3NoYXNoB3VpbnQxMjgFb3duZXIEbmFtZQVwcm94eQRuYW1lCXByb2R1Y2VycwZuYW1lW10QbGFzdF92b3RlX3dlaWdodAdmbG9hdDY0E3Byb3hpZWRfdm90ZV93ZWlnaHQHZmxvYXQ2NAhpc19wcm94eQRib29sDWlzX2F1dG9fcHJveHkEYm9vbAlyZXNlcnZlZDIGdWludDMyCXJlc2VydmVkMwVhc3NldAt3YWl0X3dlaWdodAACCHdhaXRfc2VjBnVpbnQzMgZ3ZWlnaHQGdWludDE2IwAAmNRlZFIyCWFkZGFjdGlvbgCQFEQ0TsVSMgxhZGRnZW5sb2NrZWQAAABICiIaUzIJYWRkbG9ja2VkAADApC4jM68+CmJ1cm5hY3Rpb24AALyJKkWFpkELY2FuY2VsZGVsYXkAAHynt9KszUULY3JhdXRvcHJveHkAAEDL2qisokoKZGVsZXRlYXV0aAAAAAAASHPRdAZpbmNyYW0AAFGcOrvj2nQMaW5oaWJpdHVubGNrAAAAAAAAkN10BGluaXQAAAAALWsDp4sIbGlua2F1dGgAAECemiJkuJoKbmV3YWNjb3VudAAAAAAAIhrPpAdvbmJsb2NrAAAAAODSe9WkB29uZXJyb3IAAK5COtFbmboLcmVncHJvZHVjZXIAAAAAvtNbmboIcmVncHJveHkAAACY1GVkpLoJcmVtYWN0aW9uAACAdCairLC6CnJlc2V0Y2xhaW0AAK5COtFbt7wLcm12cHJvZHVjZXIAAAAAALhjssIGc2V0YWJpAOA7vZVmbbLCDHNldGF1dG9wcm94eQAAAABAJYqywgdzZXRjb2RlAAAAwNJcU7PCCXNldHBhcmFtcwAAAABgu1uzwgdzZXRwcml2AABAy9rA6eLUCnVubGlua2F1dGgAgKeCNENE49QMdW5sb2NrdG9rZW5zAAAASPRWpu7UCXVucmVncHJvZAAAgO/0Vqbu1Ap1bnJlZ3Byb3h5AABAy9qobFLVCnVwZGF0ZWF1dGgAAK7itKpsUtULdXBkYXRlcG93ZXIAAKQzEdUTU9ULdXBkbGJwY2xhaW0AAABICiIaU9UJdXBkbG9ja2VkADCpw26rm1PVDHVwZHRyZXZpc2lvbgBwFdKJ3qoy3Qx2b3RlcHJvZHVjZXIAAADwnd6qMt0Jdm90ZXByb3h5AAoAAACgYdPcMQNpNjQAAAhhYmlfaGFzaAAAAABEc2hkA2k2NAAAEmVvc2lvX2dsb2JhbF9zdGF0ZQAAAEBEc2hkA2k2NAAAE2Vvc2lvX2dsb2JhbF9zdGF0ZTIAAABgRHNoZANpNjQAABNlb3Npb19nbG9iYWxfc3RhdGUzgKeCNCcFEY0DaTY0AAAYbG9ja2VkX3Rva2VuX2hvbGRlcl9pbmZvAACeCtIMEY0DaTY0AAASbG9ja2VkX3Rva2Vuc19pbmZvAADAVyGd6K0DaTY0AAANcHJvZHVjZXJfaW5mbwAAADjRWyvNA2k2NAAADXRvcF9wcm9kX2luZm8AAAAAq3sV1gNpNjQAAA51c2VyX3Jlc291cmNlcwAAAADgqzLdA2k2NAAACnZvdGVyX2luZm8AAAAA=",
        },
      };
      const out = abis[body.account_name];
      if (!out) throw 500;
      return out;
    },
  },
}).startServer();
afterEach(() => expect(mswMock).not.toHaveBeenCalled());

const untouchable = require("untouchableMock");

describe("NativeFioWalletInfo", () => {
  const info = NativeHDWallet.info();

  it("should return some static metadata", async () => {
    expect(await untouchable.call(info, "fioSupportsNetwork")).toBe(true);
    expect(await untouchable.call(info, "fioSupportsSecureTransfer")).toBe(false);
    expect(untouchable.call(info, "fioSupportsNativeShapeShift")).toBe(false);
  });

  it("should return the correct account paths", async () => {
    const paths = info.fioGetAccountPaths({ accountIdx: 0 });
    expect(paths).toMatchObject([{ addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0") }]);
  });

  it("does not support getting the next account path", async () => {
    expect(untouchable.call(info, "fioNextAccountPath", {})).toBe(undefined);
  });
});

describe("NativeFioWallet", () => {
  let wallet: NativeHDWallet.NativeHDWallet;

  beforeEach(async () => {
    wallet = NativeHDWallet.create({ deviceId: "native" });
    await wallet.loadDevice({ mnemonic: MNEMONIC });
    expect(await wallet.initialize()).toBe(true);
  });

  describe("stuff that uses the network", () => {
    afterEach(() => {
      expect(mswMock.handlers.post["https://fio.eu.eosamsterdam.net/v1/chain/get_raw_abi"]).toHaveBeenCalledWith({
        account_name: "fio.address",
      });
      expect(mswMock.handlers.post["https://fio.eu.eosamsterdam.net/v1/chain/get_raw_abi"]).toHaveBeenCalledWith({
        account_name: "fio.reqobt",
      });
      expect(mswMock.handlers.post["https://fio.eu.eosamsterdam.net/v1/chain/get_raw_abi"]).toHaveBeenCalledWith({
        account_name: "fio.token",
      });
      expect(mswMock.handlers.post["https://fio.eu.eosamsterdam.net/v1/chain/get_raw_abi"]).toHaveBeenCalledWith({
        account_name: "eosio",
      });
      mswMock.clear();
    });

    it("should generate a correct FIO address", async () => {
      const address = await wallet.fioGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0") });
      expect(address).toBe("FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9");
    });

    it("should generate another correct FIO address", async () => {
      const address = await wallet.fioGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/235'/1337'/123/4") });
      expect(address).toBe("FIO8Pok1EBMsZWphhfUj2m3MXrxBZJq7erqyi7E1teAfZE18HyjK5");
    });

    it("should generate another correct FIO address", async () => {
      const address = await wallet.fioGetAddress({ addressNList: core.bip32ToAddressNList("m/44'/235'/1'/0/0") });
      expect(address).toMatchInlineSnapshot(`"FIO8HiUzsRDYo69AEmUk39f7h7nawTjn9msbX6oUY5wrX6ERCh3rA"`);
    });

    it("should expose the FIO SDK", async () => {
      expect(await wallet.getFioSdk(core.bip32ToAddressNList("m/44'/235'/0'/0/0"))).toBeInstanceOf(fio.FIOSDK);
    });

    it("should sign a message", async () => {
      const sig = await wallet.fioSignTx({
        addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
        actions: [
          {
            account: "fio.address",
            name: "addaddress",
            data: {
              fio_address: "FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9",
              public_addresses: [
                {
                  chain_code: "foo",
                  token_code: "bar",
                  public_address: "baz",
                },
              ],
              max_fee: 0,
              tpid: "FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9",
            },
          },
        ],
      });
      // This is the output of the native library's own signing function.
      /*expect(sig).toMatchInlineSnapshot(`
        Object {
          "serialized": "ee9952603aa2ef1c7ca90000000001003056372503a85b0000c6eaa66452320180f2f085077460fd00000000a8ed323289013546494f354e534b6563423443634d7055787470487a4734753433536d63474d416a5262787947333872453448506567477061487539010362617203666f6f0362617a000000000000000080f2f085077460fd3546494f354e534b6563423443634d7055787470487a4734753433536d63474d416a526278794733387245344850656747706148753900",
          "signature": "SIG_K1_JxgRLcqJHYjaqAhwHpsi8iGGkYVZRKMGT46xozonn2YwBF6vv3Jg7UZ95PsFKh9BFpHNTwhcLHhzyzhxdvw47zF12REeM2",
        }
      `);*/
      // This is the output from tiny-secp256k1.
      expect(sig).toMatchInlineSnapshot(`
        Object {
          "serialized": "ee9952603aa2ef1c7ca90000000001003056372503a85b0000c6eaa66452320180f2f085077460fd00000000a8ed323289013546494f354e534b6563423443634d7055787470487a4734753433536d63474d416a5262787947333872453448506567477061487539010362617203666f6f0362617a000000000000000080f2f085077460fd3546494f354e534b6563423443634d7055787470487a4734753433536d63474d416a526278794733387245344850656747706148753900",
          "signature": "SIG_K1_KtHZaEcAbNfEJZPZKNPyYZrQJxPPZFy4MDEADYYAP7L8Hwni1uCzw8zjvDohaEZ5av5Pgwijxjuv7j5qyZpw3xvuKGhmtz",
        }
      `);
      expect(mswMock).toHaveBeenCalledWith("GET", "https://fio.eu.eosamsterdam.net/v1/chain/get_info");
      expect(mswMock).toHaveBeenCalledWith("POST", "https://fio.eu.eosamsterdam.net/v1/chain/get_block", {
        block_num_or_id: 61841978,
      });

      const chainId = Buffer.from(
        mswMock.handlers.get["https://fio.eu.eosamsterdam.net/v1/chain/get_info"].chain_id,
        "hex"
      );
      const msgRaw = Buffer.concat([chainId, Buffer.from(sig.serialized, "hex"), Buffer.alloc(32)]);

      const msgHash = Buffer.from(sha256(msgRaw).slice(2), "hex");
      const pubKey = base58.decode("FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9".slice(3)).slice(0, -4);
      const sigRaw = base58.decode(sig.signature.slice(7)).slice(1, -4);
      expect(tinyecc.verify(msgHash, pubKey, sigRaw)).toBe(true);
    });
  });

  it("should encrypt a request", async () => {
    expect(
      await wallet.fioEncryptRequestContent({
        addressNList: core.bip32ToAddressNList("m/44'/235'/0'/0/0"),
        content: {
          payee_public_address: "FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9",
          amount: "1234",
          chain_code: "foo",
          token_code: "bar",
          memo: "baz",
          hash: "bash",
          offline_url: "foobar",
        },
        publicKey: "FIO8HiUzsRDYo69AEmUk39f7h7nawTjn9msbX6oUY5wrX6ERCh3rA",
        contentType: core.FioEncryptionContentType.REQUEST,
        iv: Buffer.from("deadbeefdeadbeefdeadbeefdeadbeef", "hex"),
      } as any)
    ).toMatchInlineSnapshot(
      `"3q2+796tvu/erb7v3q2+7yeNoq+0I2pI2M5ylVEBuYkKwwHIJfKeuDZPp9bOLZNVbGtY7bfy/U9b7n316iuX1EQJHlIiHLOELx60jdWfF4A67x1T3WR8OW6lGBYCZDj8j50YbQM/oqcAIG5ND9MWK9U6Z2rcubAuZvQAcll1Jm4cIgVp49+ZxSKzEvH7Aasz"`
    );
  });

  it("should decrypt a request", async () => {
    expect(
      await wallet.fioDecryptRequestContent({
        addressNList: core.bip32ToAddressNList("m/44'/235'/1'/0/0"),
        content:
          "3q2+796tvu/erb7v3q2+7yeNoq+0I2pI2M5ylVEBuYkKwwHIJfKeuDZPp9bOLZNVbGtY7bfy/U9b7n316iuX1EQJHlIiHLOELx60jdWfF4A67x1T3WR8OW6lGBYCZDj8j50YbQM/oqcAIG5ND9MWK9U6Z2rcubAuZvQAcll1Jm4cIgVp49+ZxSKzEvH7Aasz",
        publicKey: "FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9",
        contentType: core.FioEncryptionContentType.REQUEST,
      })
    ).toMatchInlineSnapshot(`
      Object {
        "amount": "1234",
        "chain_code": "foo",
        "hash": "bash",
        "memo": "baz",
        "offline_url": "foobar",
        "payee_public_address": "FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9",
        "token_code": "bar",
      }
    `);
  });
});
