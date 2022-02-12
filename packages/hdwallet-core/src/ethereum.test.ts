import { bip32ToAddressNList } from ".";
import { ETHAddressDerivationScheme, ethDescribePath } from "./ethereum";

describe("ethDescribePath", () => {
  it("works with BIP44 derivation", async () => {
    const describePath = (x: string) =>
      ethDescribePath(bip32ToAddressNList(x), ETHAddressDerivationScheme.BIP44).verbose;

    expect(describePath("m/1/2/3")).toMatchInlineSnapshot(`"m/1/2/3"`);
    expect(describePath("m/44'/123")).toMatchInlineSnapshot(`"m/44'/123"`);
    expect(describePath("m/44'/123'")).toMatchInlineSnapshot(`"m/44'/123'"`);
    expect(describePath("m/44'/123'/0")).toMatchInlineSnapshot(`"m/44'/123'/0"`);
    expect(describePath("m/44'/123'/0'")).toMatchInlineSnapshot(`"m/44'/123'/0'"`);
    expect(describePath("m/44'/123'/0'/0")).toMatchInlineSnapshot(`"m/44'/123'/0'/0"`);
    expect(describePath("m/44'/123'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/123'/0'/0/0"`);
    expect(describePath("m/44'/0'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/0'/0'/0/0"`);

    expect(describePath("m/44'/60'/0'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #0"`);
    expect(describePath("m/44'/60'/1'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #1"`);
    expect(describePath("m/44'/60'/2'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #2"`);
    expect(describePath("m/44'/60'/3'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #3"`);

    expect(describePath("m/44'/60'/0'/0/1")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/1"`);
    expect(describePath("m/44'/60'/0'/0/2")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/2"`);
    expect(describePath("m/44'/60'/0'/0/3")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/3"`);

    expect(describePath("m/44'/60'/1'/0/1")).toMatchInlineSnapshot(`"m/44'/60'/1'/0/1"`);
    expect(describePath("m/44'/60'/1'/2/3")).toMatchInlineSnapshot(`"m/44'/60'/1'/2/3"`);
    expect(describePath("m/44'/60'/0'/0")).toMatchInlineSnapshot(`"m/44'/60'/0'/0"`);
    expect(describePath("m/44'/60'/0'/1")).toMatchInlineSnapshot(`"m/44'/60'/0'/1"`);
    expect(describePath("m/44'/60'/0'/2")).toMatchInlineSnapshot(`"m/44'/60'/0'/2"`);
    expect(describePath("m/44'/60'/0'/3")).toMatchInlineSnapshot(`"m/44'/60'/0'/3"`);
    expect(describePath("m/44'/60'/1'/0")).toMatchInlineSnapshot(`"m/44'/60'/1'/0"`);
    expect(describePath("m/44'/60'/1'/2")).toMatchInlineSnapshot(`"m/44'/60'/1'/2"`);
  });

  it("works with Metamask derivation", async () => {
    const describePath = (x: string) =>
      ethDescribePath(bip32ToAddressNList(x), ETHAddressDerivationScheme.Metamask).verbose;

    expect(describePath("m/1/2/3")).toMatchInlineSnapshot(`"m/1/2/3"`);
    expect(describePath("m/44'/123")).toMatchInlineSnapshot(`"m/44'/123"`);
    expect(describePath("m/44'/123'")).toMatchInlineSnapshot(`"m/44'/123'"`);
    expect(describePath("m/44'/123'/0")).toMatchInlineSnapshot(`"m/44'/123'/0"`);
    expect(describePath("m/44'/123'/0'")).toMatchInlineSnapshot(`"m/44'/123'/0'"`);
    expect(describePath("m/44'/123'/0'/0")).toMatchInlineSnapshot(`"m/44'/123'/0'/0"`);
    expect(describePath("m/44'/123'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/123'/0'/0/0"`);
    expect(describePath("m/44'/0'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/0'/0'/0/0"`);

    expect(describePath("m/44'/60'/0'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #0"`);
    expect(describePath("m/44'/60'/1'/0/0")).toMatchInlineSnapshot(`"m/44'/60'/1'/0/0"`);
    expect(describePath("m/44'/60'/2'/0/0")).toMatchInlineSnapshot(`"m/44'/60'/2'/0/0"`);
    expect(describePath("m/44'/60'/3'/0/0")).toMatchInlineSnapshot(`"m/44'/60'/3'/0/0"`);

    expect(describePath("m/44'/60'/0'/0/1")).toMatchInlineSnapshot(`"Ethereum Account #1"`);
    expect(describePath("m/44'/60'/0'/0/2")).toMatchInlineSnapshot(`"Ethereum Account #2"`);
    expect(describePath("m/44'/60'/0'/0/3")).toMatchInlineSnapshot(`"Ethereum Account #3"`);

    expect(describePath("m/44'/60'/1'/0/1")).toMatchInlineSnapshot(`"m/44'/60'/1'/0/1"`);
    expect(describePath("m/44'/60'/1'/2/3")).toMatchInlineSnapshot(`"m/44'/60'/1'/2/3"`);
    expect(describePath("m/44'/60'/0'/0")).toMatchInlineSnapshot(`"m/44'/60'/0'/0"`);
    expect(describePath("m/44'/60'/0'/1")).toMatchInlineSnapshot(`"m/44'/60'/0'/1"`);
    expect(describePath("m/44'/60'/0'/2")).toMatchInlineSnapshot(`"m/44'/60'/0'/2"`);
    expect(describePath("m/44'/60'/0'/3")).toMatchInlineSnapshot(`"m/44'/60'/0'/3"`);
    expect(describePath("m/44'/60'/1'/0")).toMatchInlineSnapshot(`"m/44'/60'/1'/0"`);
    expect(describePath("m/44'/60'/1'/2")).toMatchInlineSnapshot(`"m/44'/60'/1'/2"`);
  });

  it("works with OldLedger derivation", async () => {
    const describePath = (x: string) =>
      ethDescribePath(bip32ToAddressNList(x), ETHAddressDerivationScheme.OldLedger).verbose;

    expect(describePath("m/1/2/3")).toMatchInlineSnapshot(`"m/1/2/3"`);
    expect(describePath("m/44'/123")).toMatchInlineSnapshot(`"m/44'/123"`);
    expect(describePath("m/44'/123'")).toMatchInlineSnapshot(`"m/44'/123'"`);
    expect(describePath("m/44'/123'/0")).toMatchInlineSnapshot(`"m/44'/123'/0"`);
    expect(describePath("m/44'/123'/0'")).toMatchInlineSnapshot(`"m/44'/123'/0'"`);
    expect(describePath("m/44'/123'/0'/0")).toMatchInlineSnapshot(`"m/44'/123'/0'/0"`);
    expect(describePath("m/44'/123'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/123'/0'/0/0"`);
    expect(describePath("m/44'/0'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/0'/0'/0/0"`);

    expect(describePath("m/44'/60'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/0"`);
    expect(describePath("m/44'/60'/1'/0/0")).toMatchInlineSnapshot(`"m/44'/60'/1'/0/0"`);
    expect(describePath("m/44'/60'/2'/0/0")).toMatchInlineSnapshot(`"m/44'/60'/2'/0/0"`);
    expect(describePath("m/44'/60'/3'/0/0")).toMatchInlineSnapshot(`"m/44'/60'/3'/0/0"`);

    expect(describePath("m/44'/60'/0'/0/1")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/1"`);
    expect(describePath("m/44'/60'/0'/0/2")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/2"`);
    expect(describePath("m/44'/60'/0'/0/3")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/3"`);

    expect(describePath("m/44'/60'/1'/0/1")).toMatchInlineSnapshot(`"m/44'/60'/1'/0/1"`);
    expect(describePath("m/44'/60'/1'/2/3")).toMatchInlineSnapshot(`"m/44'/60'/1'/2/3"`);
    expect(describePath("m/44'/60'/0'/0")).toMatchInlineSnapshot(`"Ethereum Account #0"`);
    expect(describePath("m/44'/60'/0'/1")).toMatchInlineSnapshot(`"Ethereum Account #1"`);
    expect(describePath("m/44'/60'/0'/2")).toMatchInlineSnapshot(`"Ethereum Account #2"`);
    expect(describePath("m/44'/60'/0'/3")).toMatchInlineSnapshot(`"Ethereum Account #3"`);
    expect(describePath("m/44'/60'/1'/0")).toMatchInlineSnapshot(`"m/44'/60'/1'/0"`);
    expect(describePath("m/44'/60'/1'/2")).toMatchInlineSnapshot(`"m/44'/60'/1'/2"`);
  });

  it("works with Ledger derivation", async () => {
    const describePath = (x: string) =>
      ethDescribePath(bip32ToAddressNList(x), ETHAddressDerivationScheme.Ledger).verbose;

    expect(describePath("m/1/2/3")).toMatchInlineSnapshot(`"m/1/2/3"`);
    expect(describePath("m/44'/123")).toMatchInlineSnapshot(`"m/44'/123"`);
    expect(describePath("m/44'/123'")).toMatchInlineSnapshot(`"m/44'/123'"`);
    expect(describePath("m/44'/123'/0")).toMatchInlineSnapshot(`"m/44'/123'/0"`);
    expect(describePath("m/44'/123'/0'")).toMatchInlineSnapshot(`"m/44'/123'/0'"`);
    expect(describePath("m/44'/123'/0'/0")).toMatchInlineSnapshot(`"m/44'/123'/0'/0"`);
    expect(describePath("m/44'/123'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/123'/0'/0/0"`);
    expect(describePath("m/44'/0'/0'/0/0")).toMatchInlineSnapshot(`"m/44'/0'/0'/0/0"`);

    expect(describePath("m/44'/60'/0'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #0"`);
    expect(describePath("m/44'/60'/1'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #1"`);
    expect(describePath("m/44'/60'/2'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #2"`);
    expect(describePath("m/44'/60'/3'/0/0")).toMatchInlineSnapshot(`"Ethereum Account #3"`);

    expect(describePath("m/44'/60'/0'/0/1")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/1"`);
    expect(describePath("m/44'/60'/0'/0/2")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/2"`);
    expect(describePath("m/44'/60'/0'/0/3")).toMatchInlineSnapshot(`"m/44'/60'/0'/0/3"`);

    expect(describePath("m/44'/60'/1'/0/1")).toMatchInlineSnapshot(`"m/44'/60'/1'/0/1"`);
    expect(describePath("m/44'/60'/1'/2/3")).toMatchInlineSnapshot(`"m/44'/60'/1'/2/3"`);
    expect(describePath("m/44'/60'/0'/0")).toMatchInlineSnapshot(`"Ethereum Account #0 (Legacy)"`);
    expect(describePath("m/44'/60'/0'/1")).toMatchInlineSnapshot(`"Ethereum Account #1 (Legacy)"`);
    expect(describePath("m/44'/60'/0'/2")).toMatchInlineSnapshot(`"Ethereum Account #2 (Legacy)"`);
    expect(describePath("m/44'/60'/0'/3")).toMatchInlineSnapshot(`"Ethereum Account #3 (Legacy)"`);
    expect(describePath("m/44'/60'/1'/0")).toMatchInlineSnapshot(`"m/44'/60'/1'/0"`);
    expect(describePath("m/44'/60'/1'/2")).toMatchInlineSnapshot(`"m/44'/60'/1'/2"`);
  });
});
