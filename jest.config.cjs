// jest.config.cjs

module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleDirectories: ["node_modules", "src"],
  roots: ["<rootDir>/__tests__"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { diagnostics: { warnOnly: true } }],
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/dist/$1",
  },
  collectCoverage: false,
};
