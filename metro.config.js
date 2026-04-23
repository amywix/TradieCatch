const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const config = getDefaultConfig(__dirname);
const root = escapeRegExp(__dirname);

config.watchFolders = [__dirname];
config.resolver = config.resolver || {};
config.resolver.blockList = [
  new RegExp(`^${root}/\\.local/.*`),
  new RegExp(`^${root}/\\.git/.*`),
  new RegExp(`^${root}/server_dist/.*`),
  new RegExp(`^${root}/dist/.*`),
  new RegExp(`^${root}/web-build/.*`),
];

module.exports = config;
