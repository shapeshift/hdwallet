module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/**/*.ts", "!<rootDir>/**/*.test.ts", "!**/dist/**"],
  coverageDirectory: "<rootDir>/../coverage",
  preset: "ts-jest",
  reporters: ["default", "jest-junit"],
  rootDir: "packages",
  // testEnvironment: "node",
  testMatch: ["<rootDir>/**/*.test.ts"],
  moduleNameMapper: {
    "^@shapeshiftoss/(.*)": "<rootDir>/$1/src",
  },
  testPathIgnorePatterns: ["dist"],
  globals: {
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
  },
};
