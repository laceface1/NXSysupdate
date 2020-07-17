const { MessageBuilder } = require('discord-webhook-node')
const defaultEmbed = (version?: string, revision?: number | string, dlUrl?: string) => {
	const base = new MessageBuilder()
		// .setAuthor('FW Updates Monitor')
		.setTitle(`Firmware version ${version}`)
		.setDescription(`Revision ${revision}`)
		.addField('Official Changelog', '*Coming later*')
		.setTimestamp()

	if (dlUrl) base.setURL(dlUrl)

	return base
}

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
				embed.addField('Official Changelog:', messages[i])
			} else {
				embed.addField('\u2800', messages[i])
			}
		}
	} else {
		embed.addField('Official Changelog:', 'N/A')
	}
}

export const majorUpdateEmbed = (...args) => {
	const baseEmbed = defaultEmbed(...args)
	const embed = baseEmbed.setText('**----- New major update detected! -----**').setColor(12910592)

	return embed
}

export const minorUpdateEmbed = (...args) => {
	const baseEmbed = defaultEmbed(...args)
	const embed = baseEmbed.setText('**----- New minor update detected! -----**').setColor(16753920)

	return embed
}

export const patchUpdateEmbed = (...args) => {
	const baseEmbed = defaultEmbed(...args)
	const embed = baseEmbed.setText('**----- New patch detected!** -----').setColor(50432)

	return embed
}

export const changelogEmbed = (versionString, changelog) => {
	const embed = new MessageBuilder()
		// .setAuthor('FW Updates Monitor')
		.setTitle(`FW ${versionString}`)

	addChangelogFields(embed, changelog)

	return embed
}
