import SysUpdateHandler from './SysUpdateHandler'

import axios from 'axios'
import cheerio from 'cheerio'

const { Webhook } = require('discord-webhook-node')
import { webhookUrls } from '../config'
import { changelogEmbeds, majorUpdateEmbed, minorUpdateEmbed, patchUpdateEmbed } from './webhookMessages'
const Hooks = webhookUrls.map((url) => new Webhook(url))

import editJsonFile from 'edit-json-file'
const data = editJsonFile(`${__dirname}/../../data.json`)

const fakeVersions = [
	450,
	65796,
	131162,
	196628,
	262164,
	201327002,
	201392178,
	201457684,
	268435656,
	268501002,
	269484082,
	335544750,
	335609886,
	335675432,
	336592976,
	402653544,
	402718730,
	403701850,
	404750376,
	469762248,
	469827614,
	536871502,
	536936528,
	537919608,
	537985054,
	603980216,
	604045412,
	605028592,
	606076948,
	671089000,
	671154196,
	671219752,
	671285268,
	671350804,
	672137336,
]

const sendEmbeds = (embeds) => {
	return new Promise(async (resolve) => {
		for (const Hook of Hooks) {
			for (const embed of embeds) {
				await Hook.send(embed)
			}
		}

		resolve()
	})
}

const main = async () => {
	const UpdateHandler = new SysUpdateHandler()
	UpdateHandler.init()

	// setInterval(async () => {
	try {
		// data.unset('last_SystemUpdate_version')
		const oldVersionInt = data.get('last_SystemUpdate_version') || 0
		// const newVersionInt = await UpdateHandler.getLatestUpdate()
		const newVersionInt = fakeVersions[21]

		if (newVersionInt > oldVersionInt) {
			// New update detected

			const oldVersion = UpdateHandler.prettyVersion(oldVersionInt)
			const newVersion = UpdateHandler.prettyVersion(newVersionInt)

			let changelog = null
			try {
				// const res = await axios.get(
				// 	'https://en-americas-support.nintendo.com/app/answers/detail/a_id/22525/kw/nintendo%20switch%20system%20update'
				// )
				const res = await axios.get('https://bonteknaagkever.ga/sysupdatetestpage.html')

				const $ = cheerio.load(res.data)
				const div = $('.update-versions')

				const title = $('h3', div)

				if (title.text().includes(newVersion.pretty)) {
					const all = $(div).children(':not(h3)')

					changelog = all.text()
				}
			} catch (e) {
				console.error(e)
				console.error('Unable to fetch web page with update details')
			}

			if (newVersion.major > oldVersion.major) {
				// Major update
				console.log('New major sysupdate detected:', newVersion.pretty, newVersion.revision)

				await sendEmbeds([minorUpdateEmbed(newVersion.pretty, newVersion.revision, !!changelog)])
			} else if (newVersion.minor > oldVersion.minor) {
				// Minor update
				console.log('New minor sysupdate detected:', newVersion.pretty, newVersion.revision)

				await sendEmbeds([minorUpdateEmbed(newVersion.pretty, newVersion.revision, !!changelog)])
			} else if (newVersion.patch > oldVersion.patch) {
				// Patch update
				console.log('New patch sysupdate detected:', newVersion.pretty, newVersion.revision)

				await sendEmbeds([minorUpdateEmbed(newVersion.pretty, newVersion.revision, !!changelog)])
			}
			sendEmbeds(changelogEmbeds(changelog))

			data.set('last_SystemUpdate_version', newVersionInt)
		}

		data.set('last_checked', new Date())
		// data.save()
	} catch (e) {
		console.error(e)
	}
	// }, 600000) //10 min
}

main()
