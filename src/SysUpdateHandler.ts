import axios from 'axios'
import https from 'https'
const axiosCookieJarSupport = require('axios-cookiejar-support').default
const tough = require('tough-cookie')
axiosCookieJarSupport(axios)
const cookieJar = new tough.CookieJar()

import { readFileSync } from 'fs'

export default class SysUpdateHandler {
	SUN_URL: string
	SUN_NAME: string
	SERVER_ENV: string
	DEVICE_ID: string
	FIRMWARE_VERSION: string
	PLATFORM: string

	cert: string
	session: any

	constructor() {
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

		this.session = axios.create({ httpsAgent: agent })
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
			const result = await this.session.get(`${this.SUN_URL}/system_update_meta?device_id=${this.DEVICE_ID}`, {
				jar: cookieJar,
			})
			return result.data.system_update_metas[0].title_version
		} catch (e) {
			console.error(e, '--------ERROR--------')
		}
	}
}
