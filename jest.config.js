module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: [ 'default', 'jest-junit' ],
  moduleNameMapper: {
    "^@shapeshiftoss/(.*)": "<rootDir>/packages/$1/dist/index.umd.js"
  }
};
