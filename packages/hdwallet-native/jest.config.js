module.exports = {
  preset: "ts-jest",
//   testEnvironment: "node",
  testPathIgnorePatterns: ["dist"],
  globals: {
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
  },
};
