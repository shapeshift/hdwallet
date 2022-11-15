import { ETHSignMessage, ETHSignTx } from "@shapeshiftoss/hdwallet-core";

export type WalletConnectEthSignParams = {
  method: "eth_sign";
  params: [string, string];
};

export type WalletConnectEthSignTypedDataParams = {
  method: "eth_signTypedData";
  params: unknown;
};

export type WalletConnectPersonalSignParams = {
  method: "personal_sign";
  params: [string, string];
};

export type WalletConnectEthSendTransactionParams = {
  method: "eth_sendTransaction";
  params: {
    from: string;
    to: string;
    data: string;
    gas: string;
    gasPrice: string;
    value: string;
    nonce: string;
  }[];
};

export type WalletConnectEthSignTransactionParams = {
  method: "eth_signTransaction";
  params: {
    from: string;
    to: string;
    data: string;
    gas: string;
    gasPrice: string;
    value: string;
    nonce: string;
  }[];
};

export type WalletConnectRequestMethodAndParams =
  | WalletConnectEthSignParams
  | WalletConnectPersonalSignParams
  | WalletConnectEthSignTypedDataParams
  | WalletConnectEthSendTransactionParams
  | WalletConnectEthSignTransactionParams;

export type WalletConnectCallRequestResponseMap = {
  personal_sign: ETHSignMessage;
  eth_sendTransaction: ETHSignTx;
  eth_signTransaction: ETHSignTx;
};

export interface SessionProposalEvent {
  id: number;
  params: {
    id: number;
    expiry: number;
    relays: { protocol: string; data?: string }[];
    proposer: {
      publicKey: string;
      metadata: {
        name: string;
        description: string;
        url: string;
        icons: string[];
      };
    };
    requiredNamespaces: Record<
      string,
      {
        chains: string[];
        methods: string[];
        events: string[];
        extension?: {
          chains: string[];
          methods: string[];
          events: string[];
        }[];
      }
    >;
    pairingTopic?: string;
  };
}

export interface SessionEventEvent {
  id: number;
  topic: string;
  params: {
    event: { name: string; data: any };
    chainId: string;
  };
}

export interface SessionRequestEvent {
  id: number;
  topic: string;
  params: {
    request: WalletConnectRequestMethodAndParams;
    chainId: string;
  };
}

export interface SessionPingEvent {
  id: number;
  topic: string;
}

export interface SessionDeleteEvent {
  id: number;
  topic: string;
}
