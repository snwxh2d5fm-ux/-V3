const js = require("@eslint/js");
module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: { require: "readonly", module: "readonly", process: "readonly", console: "readonly", Promise: "readonly", setTimeout: "readonly", Date: "readonly", Math: "readonly", Buffer: "readonly", __dirname: "readonly", wx: "readonly", getApp: "readonly", Page: "readonly", App: "readonly" }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-redeclare": "warn",
      "no-undef": "warn"
    }
  }
];
