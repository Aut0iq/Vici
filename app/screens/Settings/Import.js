import React from 'react'
import { View, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import Icon from 'react-native-vector-icons/FontAwesome'

import Text from '~/components/Text'
import { useSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import { confirmAlert } from '~/utils/alert'
import { isCodaReady } from '~/utils/coda'
import { parseImport } from '~/utils/importParse'
import { STATUS, startImport, stopImport, useImport } from '~/utils/importer'
import ButtonMenu from '~/components/settings/ButtonMenu'
import ButtonText from '~/components/settings/ButtonText'
import Header from '~/components/Header'
import mainStyles from '~/styles/main'
import settingStyles from '~/styles/settings'
import size from '~/styles/size'

const ERRORS = {
	auth: 'The Coda token no longer works. Connect Coda again in the settings.',
	outdated: 'Update the Coda server to search from vici',
	network: 'Could not reach the Coda server',
}

const StatusIcon = ({ status }) => {
	const theme = useTheme()
	if (status === STATUS.searching) return <ActivityIndicator size="small" color={theme.primaryTouch} style={styles.icon} />
	const icons = {
		[STATUS.waiting]: ['clock-o', theme.secondaryText],
		[STATUS.owned]: ['check', theme.secondaryText],
		[STATUS.queued]: ['cloud-download', theme.primaryTouch],
		[STATUS.notFound]: ['question-circle', theme.secondaryText],
		[STATUS.error]: ['exclamation-circle', theme.primaryTouch],
	}
	const [name, color] = icons[status] || icons[STATUS.waiting]
	return <Icon name={name} size={16} color={color} style={styles.icon} />
}

const Import = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const navigation = useNavigation()
	const theme = useTheme()
	const settings = useSettings()
	const job = useImport()
	const [message, setMessage] = React.useState(null)
	const ready = isCodaReady(settings.coda)

	const statusText = (item) => {
		if (item.status === STATUS.owned) return t('Already on the server')
		if (item.status === STATUS.queued) return `${t('Sent to Coda')}: ${item.found.artist} — ${item.found.title}`
		if (item.status === STATUS.notFound) return t('Not found in Coda')
		if (item.status === STATUS.error) return t('Error, see Logs')
		return null
	}

	const chooseFile = async () => {
		setMessage(null)
		const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false }).catch(() => null)
		const file = result?.canceled ? null : result?.assets?.[0]
		if (!file) return
		try {
			const tracks = parseImport(await FileSystem.readAsStringAsync(file.uri), file.name)
			if (!tracks.length) {
				setMessage(t('No songs found in this file'))
				return
			}
			confirmAlert(
				t('Import'),
				`${file.name}\n${t('Songs in the file')}: ${tracks.length}\n\n${t('Songs that are not on your server yet will be downloaded with Coda.')}`,
				() => startImport(settings.coda, tracks, file.name)
			)
		} catch (error) {
			setMessage(`${t('Could not read the file')}: ${error?.message || error}`)
		} finally {
			FileSystem.deleteAsync(file.uri, { idempotent: true }).catch(() => { })
		}
	}

	const counts = [
		[t('Sent to Coda'), job.counts.queued],
		[t('Already on the server'), job.counts.owned],
		[t('Not found in Coda'), job.counts.notFound],
		[t('Errors'), job.counts.error],
	]

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={[mainStyles.contentMainContainer(insets), settingStyles.contentMainContainer]}
		>
			<Header title={t('Import')} />

			{ready ? (
				<>
					<ButtonText text={t('Choose a file')} onPress={chooseFile} disabled={job.running} />
					<Text style={settingStyles.description(theme)}>{t('Import description')}</Text>
				</>
			) : (
				<>
					<Text style={settingStyles.description(theme)}>{t('Import works through Coda. Connect Coda first.')}</Text>
					<ButtonText text={t('Connect Coda')} onPress={() => navigation.navigate('Settings/Coda')} />
				</>
			)}

			{message ? <Text style={[settingStyles.description(theme), { color: theme.primaryTouch }]}>{message}</Text> : null}
			{job.error ? <Text style={[settingStyles.description(theme), { color: theme.primaryTouch }]}>{t(ERRORS[job.error] || job.error)}</Text> : null}

			{job.items.length ? (
				<>
					<Text style={settingStyles.titleContainer(theme)}>{job.fileName}</Text>
					<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
						<View style={settingStyles.optionItem(theme)}>
							{job.running ? <ActivityIndicator size="small" color={theme.primaryTouch} style={{ marginRight: 12 }} /> : null}
							<Text style={[settingStyles.primaryText(theme), { flex: 1 }]}>{job.running ? t('Importing') : t(job.done < job.items.length ? 'Import stopped' : 'Import finished')}</Text>
							<Text style={styles.value(theme)}>{`${job.done} / ${job.items.length}`}</Text>
						</View>
						{counts.map(([title, value], index) => (
							<View key={title} style={settingStyles.optionItem(theme, !job.running && index === counts.length - 1)}>
								<Text style={[settingStyles.primaryText(theme), { flex: 1 }]}>{title}</Text>
								<Text style={styles.value(theme)}>{value}</Text>
							</View>
						))}
						{job.running ? <ButtonMenu title={t('Stop import')} icon="stop" onPress={() => stopImport()} isLast /> : null}
					</View>
					<Text style={settingStyles.description(theme)}>{t('Coda downloads in the background. New songs appear on the server after it finishes.')}</Text>

					<View style={[settingStyles.optionsContainer(theme), { paddingVertical: 4 }]}>
						{job.items.map((item, index) => (
							<View key={index} style={styles.row}>
								<StatusIcon status={item.status} />
								<View style={{ flex: 1 }}>
									<Text numberOfLines={1} style={{ color: theme.primaryText, fontSize: size.text.medium }}>{item.title}</Text>
									<Text numberOfLines={1} style={{ color: theme.secondaryText, fontSize: size.text.small }}>
										{statusText(item) || item.artists.join(', ')}
									</Text>
								</View>
							</View>
						))}
					</View>
				</>
			) : null}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	icon: {
		width: 22,
		marginRight: 12,
		textAlign: 'center',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
	},
	value: theme => ({
		color: theme.secondaryText,
		fontSize: size.text.medium,
	}),
})

export default Import
