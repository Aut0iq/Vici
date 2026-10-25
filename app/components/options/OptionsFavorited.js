import React from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { urlStream } from '~/utils/url'
import { downloadSong } from '~/utils/player'
import { downloadSongs } from '~/utils/download'
import { useSettings } from '~/contexts/settings'
import OptionsPopup from '~/components/popup/OptionsPopup'

const OptionsFavorited = ({ favorited, isOpen, onClose }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const refOption = React.useRef()
	const settings = useSettings()

	if (!favorited) return null
	return (
		<OptionsPopup
			ref={refOption}
			visible={isOpen}
			close={() => {
				onClose()
				refOption.current.clearVirtualOptions()
			}}
			options={[
				{
					name: t('Cache all songs'),
					icon: 'cloud-download',
					onPress: async () => {
						refOption.current.close()
						for (const song of favorited) {
							await downloadSong(urlStream(config, song.id, settings.streamFormat, settings.maxBitRate), song.id)
						}
					}
				},
				{
					name: t('Download to Music'),
					icon: 'download',
					onPress: () => {
						refOption.current.close()
						downloadSongs(config, favorited, t)
					},
					hidden: Platform.OS === 'web' || !favorited?.length
				},
			]}
		/>
	)
}

export default OptionsFavorited