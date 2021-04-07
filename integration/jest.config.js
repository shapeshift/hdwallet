module.exports = {
  collectCoverage: false,
  // collectCoverageFrom: ["<rootDir>/**/*.ts", "!<rootDir>/**/*.test.ts"],
  preset: "ts-jest",
  // reporters: ["default", "jest-junit"],
  rootDir: "./src",
  // testEnvironment: "node",
  testMatch: ["<rootDir>/**/*.test.ts"],
  moduleNameMapper: {
    "^@shapeshiftoss/(.*)": "<rootDir>/../../packages/$1/src",
  },
  testPathIgnorePatterns: ["dist"],
  globals: {
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
  },
};
