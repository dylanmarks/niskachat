export default {
  testEnvironment: "node",
  testMatch: ["**/backend/**/*.test.js"],
  collectCoverageFrom: ["backend/**/*.js", "!backend/**/*.test.js"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  transform: {},
};
