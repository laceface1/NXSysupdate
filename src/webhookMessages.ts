const { MessageBuilder } = require('discord-webhook-node')

// Totally not stolen from https://github.com/discordjs/discord.js/blob/44ac5fe6dfbab21bb4c16ef580d1101167fd15fd/src/util/Util.js#L65-L80
export const splitMessage = (text, { maxLength = 1000, char = '\n', prepend = '', append = '' } = {}) => {
	if (!text) return
	if (text.length <= maxLength) return [text]
	const splitText = text.split(char)
	if (splitText.some((chunk) => chunk.length > maxLength)) throw new RangeError('SPLIT_MAX_LEN')
	const messages = []
	let msg = ''
	for (const chunk of splitText) {
		if (msg && (msg + char + chunk + append).length > maxLength) {
			messages.push(msg + append)
			msg = prepend
		}
		msg += (msg && msg !== prepend ? char : '') + chunk
	}
	return messages.concat(msg).filter((m) => m)
}

const addChangelogFields = (embed, text) => {
	const messages = splitMessage(text)

	if (messages) {
		for (let i = 0; i < messages.length; i++) {
			if (i === 0) {
				// First block
				embed.addField('Changelog:', messages[i])
			} else {
				embed.addField('\u2800', messages[i])
			}
		}
	} else {
		embed.addField('Changelog:', 'N/A')
	}
}

export const changelogEmbeds = (changelog?: string) => {
	const messages = splitMessage(changelog)

	const embeds = []
	if (messages) {
		for (let i = 0; i < messages.length; i++) {
			const embed = new MessageBuilder().setText('```' + messages[i] + '```')
			delete embed.payload.embeds
			embeds.push(embed)
		}
	} else {
		const embed = new MessageBuilder().setText('N/A')
		delete embed.payload.embeds
		embeds.push(embed)
	}

	return embeds
}

export const majorUpdateEmbed = (
	version: string,
	revision?: number | string,
	has_changelog?: boolean,
	dlUrl?: string
) => {
	const baseEmbed = new MessageBuilder().setTimestamp()
	const embed = baseEmbed
		.setText('New major update detected!')
		.setColor(12910592)
		.setTitle(`FW ${version}`)
		.setDescription(`Revision ${revision}`)
		.addField('Official Changelog:', has_changelog ? '*See below*' : 'N/A')

	if (dlUrl) embed.setURL(dlUrl)

	return embed
}

export const minorUpdateEmbed = (
	version: string,
	revision?: number | string,
	has_changelog?: boolean,
	dlUrl?: string
) => {
	const baseEmbed = new MessageBuilder().setTimestamp()
	const embed = baseEmbed
		.setText('New minor update detected!')
		.setColor(16753920)
		.setTitle(`FW ${version}`)
		.setDescription(`Revision ${revision}`)
		.addField('Official Changelog:', has_changelog ? '*See below*' : 'N/A')

	if (dlUrl) embed.setURL(dlUrl)

	return embed
}

export const patchUpdateEmbed = (
	version: string,
	revision?: number | string,
	has_changelog?: boolean,
	dlUrl?: string
) => {
	const baseEmbed = new MessageBuilder().setTimestamp()
	const embed = baseEmbed
		.setText('New patch detected!')
		.setColor(50432)
		.setTitle(`FW ${version}`)
		.setDescription(`Revision ${revision}`)
		.addField('Official Changelog:', has_changelog ? '*See below*' : 'N/A')

	if (dlUrl) embed.setURL(dlUrl)

	return embed
}
