module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: ["birbcore"],
  settings: {
    "import/resolver": {
      typescript: true,
      node: true,
    },
  },
};
