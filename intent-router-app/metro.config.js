const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const nativeWindConfig = withNativeWind(config, { input: './global.css' });

nativeWindConfig.transformerPath = require.resolve(
  'react-native-css-interop/dist/metro/transformer'
);

module.exports = nativeWindConfig;
