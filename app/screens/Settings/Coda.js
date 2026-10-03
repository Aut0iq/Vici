import React from 'react'
import { View, ScrollView, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import Text from '~/components/Text'
import { useSettings, useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import { codaInfo, isCodaReady, normalizeCodaUrl } from '~/utils/coda'
import ButtonText from '~/components/settings/ButtonText'
import Header from '~/components/Header'
import mainStyles from '~/styles/main'
import OptionInput from '~/components/settings/OptionInput'
import settingStyles from '~/styles/settings'
import size from '~/styles/size'

const ERRORS = {
	auth: 'The token does not match',
	locked: 'Too many attempts, try again in a few minutes',
	network: 'Could not reach the Coda server',
	outdated: 'This server is not Coda',
}

const Coda = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const [url, setUrl] = React.useState(settings.coda?.url || '')
	const [token, setToken] = React.useState('')
	const [status, setStatus] = React.useState(null)
	const [isBusy, setIsBusy] = React.useState(false)
	const connected = isCodaReady(settings.coda)

	const connect = async () => {
		const coda = { url: normalizeCodaUrl(url), token: token.trim() }
		if (!isCodaReady(coda)) return
		setStatus(null)
		setIsBusy(true)
		try {
			await codaInfo(coda)
			setSettings({ ...settings, coda })
			setToken('')
		} catch (error) {
			setStatus(t(ERRORS[error.code] || 'Could not reach the Coda server'))
		}
		setIsBusy(false)
	}

	const disconnect = () => {
		setSettings({ ...settings, coda: { url: '', token: '' } })
		setStatus(null)
	}

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={[mainStyles.contentMainContainer(insets), settingStyles.contentMainContainer]}
		>
			<Header title="Coda" />

			{connected ? (
				<>
					<View style={settingStyles.optionsContainer(theme)}>
						<View style={settingStyles.optionItem(theme, true)}>
							<Text style={settingStyles.primaryText(theme)}>{t('Connected to')}</Text>
							<Text numberOfLines={1} style={{ flex: 1, textAlign: 'right', color: theme.primaryTouch, fontSize: size.text.medium, fontWeight: 'bold' }}>
								{settings.coda.url.replace(/^https?:\/\//, '')}
							</Text>
						</View>
					</View>
					<Text style={settingStyles.description(theme)}>
						{t('Search shows songs and albums that are not on your server yet. Tap one to download it with Coda.')}
					</Text>
					<ButtonText text={t('Disconnect')} onPress={disconnect} />
				</>
			) : (
				<>
					<View style={settingStyles.optionsContainer(theme, true)}>
						<OptionInput
							title={t('Address')}
							placeholder="https://coda.example.com"
							value={url}
							onChangeText={setUrl}
							inputMode="url"
						/>
						<OptionInput
							title={t('Token')}
							placeholder="••••••••"
							value={token}
							onChangeText={setToken}
							isPassword
							isLast
						/>
					</View>
					<Text style={settingStyles.description(theme)}>
						{t('Coda is your own download server for Navidrome. Open the Coda app, tap “Connect vici” in the server menu, or copy the address and token from there.')}
					</Text>
					{isBusy
						? <ActivityIndicator size="large" color={theme.primaryTouch} style={{ marginBottom: 20 }} />
						: <ButtonText text={t('Connect')} onPress={connect} disabled={!url.trim() || !token.trim()} />}
				</>
			)}

			{status ? (
				<Text style={[settingStyles.description(theme), { color: theme.primaryTouch }]}>{status}</Text>
			) : null}
		</ScrollView>
	)
}

export default Coda
