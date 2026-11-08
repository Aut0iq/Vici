const { withPodfile } = require('expo/config-plugins')

// fmt 11.0.2 из RN 0.79 падает под clang из Xcode 26:
// "call to consteval function is not a constant expression" в format-inl.h.
// FMT_USE_CONSTEVAL в base.h переопределяется безусловно, поэтому -D не помогает;
// под C++17 fmt сам выключает consteval. Ставим после react_native_post_install — он выставляет c++20 всем подам.
const FIX = `
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`

module.exports = (config) =>
	withPodfile(config, (config) => {
		const contents = config.modResults.contents
		if (contents.includes("target.name == 'fmt'")) return config
		const anchor = contents.match(/react_native_post_install\([\s\S]*?\n\s*\)\n/)
		if (!anchor) throw new Error('react_native_post_install() не найден в Podfile')
		config.modResults.contents = contents.replace(anchor[0], anchor[0] + FIX)
		return config
	})
