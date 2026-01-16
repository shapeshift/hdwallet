module.exports = {
  WalletContractV4: {
    create: jest.fn().mockReturnValue({
      address: { toString: jest.fn().mockReturnValue("mock-address") },
      init: { code: null, data: null },
      createTransfer: jest.fn(),
    }),
  },
  TonClient: jest.fn(),
};
