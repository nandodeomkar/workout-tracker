// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle generated Drizzle .sql migration files as inline strings
// (via babel-plugin-inline-import configured in babel.config.js).
config.resolver.sourceExts.push('sql');

module.exports = config;
