const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Библиотека butterchurn и наборы пресетов лежат в assets как .txt,
// чтобы попасть в сборку как файлы, а не как код приложения
if (!config.resolver.assetExts.includes('txt')) {
	config.resolver.assetExts.push('txt');
}

module.exports = config;
