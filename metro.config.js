const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const nativeWindConfig = withNativeWind(config, {
  input: "./global.css",
});

const originalResolveRequest = nativeWindConfig.resolver.resolveRequest;

nativeWindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  return originalResolveRequest(
    {
      ...context,
      // Expo SDK 55 + Metro 0.83 can attempt haste package resolution even when
      // no haste package map is present, which crashes on some imports.
      allowHaste: false,
    },
    moduleName,
    platform,
  );
};

module.exports = nativeWindConfig;
