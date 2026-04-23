const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];
config.resolver = config.resolver || {};
config.resolver.blockList = [
  /\.local\/.*/,
  /\.git\/.*/,
  /server_dist\/.*/,
  /dist\/.*/,
];

module.exports = config;
