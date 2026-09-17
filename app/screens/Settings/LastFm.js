import React from 'react'
import { View, ScrollView, Linking, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import Text from '~/components/Text'
import { useTheme } from '~/contexts/theme'
import { loadAccount, getAccount, requestToken, createSession, disconnect } from '~/utils/lastfm'
import ButtonText from '~/components/settings/ButtonText'
import Header from '~/components/Header'
import mainStyles from '~/styles/main'
import OptionInput from '~/components/settings/OptionInput'
import settingStyles from '~/styles/settings'
import size from '~/styles/size'

const LastFm = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const [apiKey, setApiKey] = React.useState('')
	const [secret, setSecret] = React.useState('')
	const [account, setAccount] = React.useState(null)
	const [token, setToken] = React.useState(null)
	const [status, setStatus] = React.useState(null)
	const [isBusy, setIsBusy] = React.useState(false)

	React.useEffect(() => {
		loadAccount().then((value) => {
			if (!value) return
			setAccount(value)
			setApiKey(value.apiKey || '')
			setSecret(value.secret || '')
		})
	}, [])

	// Шаг 1: получаем токен и открываем страницу Last.fm, где вы разрешаете доступ
	const openAuth = async () => {
		setStatus(null)
		setIsBusy(true)
		try {
			const result = await requestToken(apiKey.trim(), secret.trim())
			setToken(result.token)
			Linking.openURL(result.url)
		} catch (error) {
			setStatus(error.message)
		}
		setIsBusy(false)
	}

	// Шаг 2: после разрешения меняем токен на постоянный ключ сессии
	const finishAuth = async () => {
		setStatus(null)
		setIsBusy(true)
		try {
			const value = await createSession(apiKey.trim(), secret.trim(), token)
			setAccount(value)
			setToken(null)
		} catch (error) {
			setStatus(error.message)
		}
		setIsBusy(false)
	}

	const logout = async () => {
		await disconnect()
		setAccount(null)
		setToken(null)
		setStatus(null)
	}

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={[mainStyles.contentMainContainer(insets), settingStyles.contentMainContainer]}
		>
			<Header title="Last.fm" />

			{account?.sessionKey ? (
				<>
					<View style={settingStyles.optionsContainer(theme)}>
						<View style={settingStyles.optionItem(theme, true)}>
							<Text style={settingStyles.primaryText(theme)}>{t('Connected as')}</Text>
							<Text style={{ color: theme.primaryTouch, fontSize: size.text.medium, fontWeight: 'bold' }}>{account.username}</Text>
						</View>
					</View>
					<Text style={settingStyles.description(theme)}>
						{t('Tracks are sent to Last.fm straight from your phone.')}
					</Text>
					<ButtonText text={t('Disconnect')} onPress={logout} />
				</>
			) : (
				<>
					<Text style={settingStyles.titleContainer(theme)}>{t('Last.fm application')}</Text>
					<View style={settingStyles.optionsContainer(theme, true)}>
						<OptionInput
							title="API key"
							placeholder="0123456789abcdef"
							value={apiKey}
							onChangeText={setApiKey}
						/>
						<OptionInput
							title="Shared secret"
							placeholder="0123456789abcdef"
							value={secret}
							onChangeText={setSecret}
							isPassword
							isLast
						/>
					</View>
					<Text style={settingStyles.description(theme)}>
						{t('Create your own application key at last.fm/api/account/create, then sign in below.')}
					</Text>

					{token ? (
						<>
							<Text style={settingStyles.description(theme)}>
								{t('Allow access in the Last.fm page that just opened, then come back and finish.')}
							</Text>
							<ButtonText text={t('I allowed access')} onPress={finishAuth} disabled={isBusy} />
							<ButtonText text={t('Open Last.fm again')} onPress={openAuth} disabled={isBusy} />
						</>
					) : (
						<ButtonText
							text={t('Sign in to Last.fm')}
							onPress={openAuth}
							disabled={isBusy || apiKey.trim().length < 10 || secret.trim().length < 10}
						/>
					)}

					{isBusy ? <ActivityIndicator size="small" color={theme.primaryTouch} /> : null}
					{status ? (
						<Text style={[settingStyles.description(theme), { color: '#E1322B', fontSize: size.text.small }]}>{status}</Text>
					) : null}
				</>
			)}
		</ScrollView>
	)
}

export default LastFm
