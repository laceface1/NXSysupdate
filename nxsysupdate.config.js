module.exports = {
	apps: [
		{
			name: 'nxsysupdate',
			script: 'cd /home/ubuntu/NXSysupdate && yarn run start',
			env: {
				NODE_ENV: 'production',
			},
		},
	],
};
