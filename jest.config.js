module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ["<rootDir>/**/*.ts", "!<rootDir>/**/*.test.ts"],
  preset: "ts-jest",
  // reporters: ["default", "jest-junit"],
  rootDir: "packages",
  testEnvironment: "node",
  testMatch: ["<rootDir>/**/*.test.ts"],
  moduleNameMapper: {
    "^@shapeshiftoss/(.*)": "<rootDir>/$1/src",
  },
};
