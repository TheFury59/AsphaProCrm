module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "react" }]],
    plugins: [
      // expo-router/babel is included in babel-preset-expo since SDK 50+,
      // so it's no longer required as a standalone plugin.
      "react-native-reanimated/plugin",
    ],
  };
};
