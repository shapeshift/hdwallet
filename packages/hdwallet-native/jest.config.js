module.exports = {
  preset: "ts-jest",
//   testEnvironment: "node",
  moduleNameMapper: {
    "^@shapeshiftoss/(.*)": "<rootDir>/../../packages/$1/src",
  },
  testPathIgnorePatterns: ["dist"],
  globals: {
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
  },
};
