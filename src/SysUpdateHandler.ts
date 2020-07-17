import { readFileSync, createWriteStream, renameSync } from 'fs'
import { execFileSync } from 'child_process'
import { hactoolPath, prodKeysPath } from '../config'

import axios from 'axios'
import https from 'https'

const tmp = require('tmp')
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const tough = require('tough-cookie')
axiosCookieJarSupport(axios)
const cookieJar = new tough.CookieJar()

export default class SysUpdateHandler {
	CDN_URL: string
	SUN_URL: string
	SUN_NAME: string
	SERVER_ENV: string
	DEVICE_ID: string
	FIRMWARE_VERSION: string
	PLATFORM: string

	cert: string
	session: any

	constructor() {
		this.CDN_URL = 'https://atumn.hac.lp1.d4c.nintendo.net'
		this.SUN_URL = 'https://sun.hac.lp1.d4c.nintendo.net/v1'
		this.SUN_NAME = 'sun'
		this.SERVER_ENV = 'lp1'
		this.DEVICE_ID = 'DEVUNIT000072992'
		this.FIRMWARE_VERSION = '5.1.0-3'
		this.PLATFORM = 'NX'
	}

	init(
		cert_loc: string = `${__dirname}/../../nx_tls_client_cert.pem`,
		device_id: string = null,
		server: string = null,
		env: string = null,
		fw_ver: string = null,
		platform: string = null
	) {
		this.cert = cert_loc
		this.initSession()
	}

	initSession() {
		const cert = readFileSync(this.cert)

		var agent = new https.Agent({
			cert: cert,
			key: cert,
			rejectUnauthorized: false,
		})

		this.session = axios.create({ httpsAgent: agent, jar: cookieJar } as any)
		this.session.defaults.headers.common[
			'User-Agent'
		] = `NintendoSDK Firmware/${this.FIRMWARE_VERSION} (platform:${this.PLATFORM}; did:${this.DEVICE_ID}; eid:${this.SERVER_ENV})`
	}

	prettyVersion(intVersion) {
		// Versions prior to 3.0.0 had hard coded version strings. (1.0.0 is 0.0.0-450, which is 0.0.0-revision 45, 2.0.0 is 0.0.1-revision 26)
		const major = (intVersion >> 26) & 0x3f
		const minor = (intVersion >> 20) & 0x3f
		const patch = (intVersion >> 16) & 0xf
		const revision = (intVersion & 0xffff) / 10

		return {
			pretty: `${major}.${minor}.${patch}`,
			major,
			minor,
			patch,
			revision,
		}
	}

	async getLatestUpdate() {
		try {
			const response = await this.session.get(`${this.SUN_URL}/system_update_meta?device_id=${this.DEVICE_ID}`)
			return response.data.system_update_metas[0]
		} catch (e) {
			console.error(e, '--------ERROR--------')
		}
	}

	async streamFile(url, path) {
		console.log(url)
		const response = await this.session.get(url, {
			responseType: 'stream',
		})

		await response.data.pipe(createWriteStream(path))
		const contentID = response.headers['x-nintendo-content-id']

		return contentID
	}

	async streamFromCDN(titleID: string, intVersion: number, path: string, magic: string = 'c') {
		return this.streamFile(`${this.CDN_URL}/t/${magic}/${titleID}/${intVersion}?device_id=${this.DEVICE_ID}`, path)
	}

	async downloadLatest(version, saveDir: string) {
		const tmpobj = tmp.dirSync()
		const tmpDir = 'C:/Users/ihave/AppData/Local/Temp/tmp-19624-wDD7FpYM6nCt'
		// const tmpDir = tmpobj.name

		const contentID = await this.streamFromCDN(version.title_id, version.title_version, `${tmpDir}/meta.nca`, 's')
		renameSync(`${tmpDir}/meta.nca`, `${tmpDir}/${contentID}.nca`)

		setTimeout(() => {
			const stdout = execFileSync(hactoolPath, [
				'-k',
				prodKeysPath,
				`${tmpDir}/${contentID}.nca`,
				`--section0dir=${tmpDir}/meta_nca_exefs`,
				'--disablekeywarns',
			])
			console.log(stdout)
		}, 5000)

		// tmpobj.removeCallback()
	}
}
