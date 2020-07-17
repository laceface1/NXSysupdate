import SysUpdateHandler from './SysUpdateHandler'
const UpdateHandler = new SysUpdateHandler()
UpdateHandler.init()

import axios from 'axios'
import cheerio from 'cheerio'
import TurndownService from 'turndown'
const turndownService = new TurndownService({ bulletListMarker: '-' })

const { Webhook } = require('discord-webhook-node')
import { webhookUrls } from '../config'
import { majorUpdateEmbed, minorUpdateEmbed, patchUpdateEmbed, changelogEmbed } from './webhookMessages'
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

const getUpdate = async () => {
	try {
		// data.unset('last_SystemUpdate_version')
		const oldVersionInt = data.get('last_SystemUpdate_version') || 0
		const newv = await UpdateHandler.getLatestUpdate()
		const newVersionInt = newv?.title_version
		// const newVersionInt = fakeVersions[22]

		const oldVersion = UpdateHandler.prettyVersion(oldVersionInt)
		const newVersion = UpdateHandler.prettyVersion(newVersionInt)

		data.set('last_checked', new Date())

		if (newVersionInt > oldVersionInt) {
			console.log('Seems to be an update')

			// Download update now
			// UpdateHandler.downloadLatest(newv, `/home/ubuntu/www/html/firmwares`)

			data.set('last_SystemUpdate_version', newVersionInt)
			data.save()
			return { newVersion, oldVersion }
		} else return { newVersion: null, oldVersion }
	} catch (e) {
		console.error(e)
	}
}

const getChangelog = async (versionString) => {
	let changelog = null
	try {
		const res = await axios.get(
			'https://en-americas-support.nintendo.com/app/answers/detail/a_id/22525/kw/nintendo%20switch%20system%20update'
		)
		// const res = await axios.get('https://bonteknaagkever.ga/sysupdatetestpage.html')

		const $ = cheerio.load(res.data)
		const div = $('.update-versions')

		const title = $('h3', div)

		if (title.text().includes(versionString)) {
			var changes = $(div).children(':not(h3)')
			changes.each((i, elem) => {
				var elem = $(elem)
				console.log(turndownService.turndown(elem.html()))
				const parsed = turndownService.turndown(elem.html()) + '\n'
				if (!changelog) {
					changelog = parsed
				} else {
					changelog += parsed
				}
			})

			return changelog.replace(/\n\s{4}/gm, '\n\u2800   ')
		} else return null
	} catch (e) {
		console.error(e)
		console.error('Unable to fetch web page with update details')
	}
}

let updateMonitor, changelogMonitor

const checkUpdate = async () => {
	const { newVersion, oldVersion } = await getUpdate()

	if (newVersion) {
		if (newVersion.major > oldVersion.major) {
			// Major update
			console.log('New major sysupdate detected:', newVersion.pretty, newVersion.revision)

			await sendEmbeds([majorUpdateEmbed(newVersion.pretty, newVersion.revision)])
		} else if (newVersion.minor > oldVersion.minor) {
			// Minor update
			console.log('New minor sysupdate detected:', newVersion.pretty, newVersion.revision)

			await sendEmbeds([minorUpdateEmbed(newVersion.pretty, newVersion.revision)])
		} else if (newVersion.patch > oldVersion.patch) {
			// Patch update
			console.log('New patch sysupdate detected:', newVersion.pretty, newVersion.revision)

			await sendEmbeds([patchUpdateEmbed(newVersion.pretty, newVersion.revision)])
		}

		data.set('last_changelog_sent', false)
		data.save()
		startChangelogMonitor(newVersion.pretty)
	}
}

const checkChangelog = async (versionString) => {
	try {
		const newChangelog = await getChangelog(versionString)
		if (newChangelog) {
			await sendEmbeds([changelogEmbed(versionString, newChangelog)])

			data.set('last_changelog_sent', true)
			data.save()

			clearInterval(changelogMonitor)
		}
	} catch (e) {
		console.error(e)
	}
}

const startUpdateMonitor = () => {
	checkUpdate()
	updateMonitor = setInterval(async () => {
		checkUpdate()
	}, 600000) // 10 min
}

const startChangelogMonitor = (versionString) => {
	checkChangelog(versionString)
	changelogMonitor = setInterval(() => {
		checkChangelog(versionString)
	}, 5000) // 5 min
}

startUpdateMonitor()
if (!data.get('last_changelog_sent')) {
	const newVersion = UpdateHandler.prettyVersion(data.get('last_SystemUpdate_version'))

	startChangelogMonitor(newVersion.pretty)
}
