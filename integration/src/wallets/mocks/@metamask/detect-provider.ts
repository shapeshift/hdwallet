export const ethereum = {
  request: jest.fn(({ method, params }: any) => {
    switch (method) {
      case "eth_accounts":
        return ["0x3f2329C9ADFbcCd9A84f52c906E936A42dA18CB8"];
      case "personal_sign":
        const [message] = params;

        if (message === '48656c6c6f20576f726c64')
          return '0x29f7212ecc1c76cea81174af267b67506f754ea8c73f144afa900a0d85b24b21319621aeb062903e856352f38305710190869c3ce5a1425d65ef4fa558d0fc251b'

        throw new Error('unknown message');
      case "eth_sendTransaction":
        const [{ to }] = params;

        return `txHash-${to}`;
      default:
        throw new Error(`ethereum: Unkown method ${method}`);
    }
  })
}