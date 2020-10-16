import { bip32ToAddressNList } from "@shapeshiftoss/hdwallet-core";
import { mnemonicToSeed } from "bip39";
import { NativeHDWallet } from "./native";

describe("FIO", () => {
  it("should generate a correct FIO address", async () => {
    const x = new NativeHDWallet({ mnemonic: "all all all all all all all all all all all all", deviceId: "fioTest" });
    const seed = await mnemonicToSeed("all all all all all all all all all all all all");
    await x.fioInitializeWallet(seed);

    const address = await x.fioGetAddress({ addressNList: bip32ToAddressNList("m/44'/235'/0'/0/0") });
    expect(address).toBe("FIO5NSKecB4CcMpUxtpHzG4u43SmcGMAjRbxyG38rE4HPegGpaHu9");
  });
});
