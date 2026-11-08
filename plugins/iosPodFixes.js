const { withPodfile } = require('expo/config-plugins')

// fmt 11.0.2 из RN 0.79 падает под clang из Xcode 26:
// "call to consteval function is not a constant expression" в format-inl.h.
// Флаг выключает consteval-проверки строк формата — переносит их в runtime.
// Ставим per-file COMPILER_FLAGS, чтобы не перетирать GCC_PREPROCESSOR_DEFINITIONS из xcconfig подов.
const FIX = `    installer.pods_project.targets.each do |target|
      next unless target.respond_to?(:source_build_phase)
      target.source_build_phase.files.each do |file|
        settings = file.settings || {}
        flags = settings['COMPILER_FLAGS'] || ''
        unless flags.include?('FMT_USE_CONSTEVAL')
          settings['COMPILER_FLAGS'] = "#{flags} -DFMT_USE_CONSTEVAL=0".strip
          file.settings = settings
        end
      end
    end
`

module.exports = (config) =>
	withPodfile(config, (config) => {
		let contents = config.modResults.contents
		if (contents.includes('FMT_USE_CONSTEVAL')) return config
		const anchor = 'post_install do |installer|\n'
		if (contents.includes(anchor)) {
			contents = contents.replace(anchor, anchor + '\n' + FIX + '\n')
		} else {
			contents += `\npost_install do |installer|\n${FIX}end\n`
		}
		config.modResults.contents = contents
		return config
	})
