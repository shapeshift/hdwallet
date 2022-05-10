// This ensures that the module's exports are all writable, so that jest.spyOn() will work.
const actual = jest.requireActual("@shapeshiftoss/hdwallet-core");
const mock: any = {};
for (const key of Object.keys(Object.getOwnPropertyDescriptors(actual))) {
  mock[key] = actual[key];
}
module.exports = mock as typeof actual;
export {};
