import {
    checkFrequency,
    downloadLocation,
    downloadPassword,
    downloadUrlBase,
    downloadUsername,
    keysetPath,
    webhooks,
    yuiPath,
} from "../config";
import SysUpdateScheduler from "./SysUpdateScheduler";
import Discord from "discord.js";
import {
    changelogEmbed,
    failedDownloadUpdateEmbed,
    pendingChangelogEmbed,
    pendingUpdateEmbed,
    updateEmbed,
    updateRemovedEmbed,
} from "./webhookMessages";
import path from "path";

const hooks = webhooks.map(({id, token}) => new Discord.WebhookClient(id, token));

const sendEmbeds = (embeds) => {
    return new Promise(async (resolve) => {
        for (const hook of hooks) {
            for (const embed of embeds) {
                await hook.send(embed);
            }
        }

        resolve();
    });
};

const updateEmbeds = (embeds) => {
    return new Promise(async (resolve) => {
        for (const hook of hooks) {
            for (const embed of embeds) {
                await hook.send(embed);
            }
        }

        resolve();
    });
};

const pendingEmbed: [{ updateEmbed, changelogEmbed }] | [] = [];
const completePending = (versionString, updateEmbedObj, changelogEmbedObj) => {
    if (!updateEmbedObj) updateEmbedObj = pendingUpdateEmbed({versionString});
    if (!changelogEmbedObj) changelogEmbedObj = pendingChangelogEmbed({versionString});

    if (pendingEmbed.length !== 0) {
        updateEmbeds([updateEmbedObj, changelogEmbedObj]).then();
    } else {
        sendEmbeds([updateEmbedObj, changelogEmbedObj]).then();
    }
};

const scheduler = new SysUpdateScheduler({yuiPath, keysetPath, checkFrequency});

scheduler.on("start", () => {
    console.log("Scheduler service started!");
});

scheduler.on("update", async ({version, versionString, buildNumber}) => {
    try {
        console.log("Update Found, initiating download");

        const downloadDir = path.join(downloadLocation, `${versionString}-${version}-bn_${buildNumber}`);
        const {fileName, md5} = await scheduler.handler.downloadLatest(downloadDir);

        const embed = updateEmbed({
            version,
            versionString,
            buildNumber,
            downloadUrl: downloadUrlBase + fileName,
            fileMd5: md5,
            downloadUsername,
            downloadPassword,
        });
        sendEmbeds([embed]).then();
        // completePending(versionString, embed, null);
    } catch (e) {
        console.error(e);
        const embed = failedDownloadUpdateEmbed({version, versionString, buildNumber});
        sendEmbeds([embed]).then();
    }
});

scheduler.on("updateRemoved", ({version, versionString, buildNumber}) => {
    console.log("Update Removed");

    const embed = updateRemovedEmbed({version, versionString, buildNumber});
    sendEmbeds([embed]).then();
});

scheduler.on("changelogUpdate", ({versionString, changelog}) => {
    console.log("Changelog was updated");

    const embed = changelogEmbed({versionString, changelog});
    sendEmbeds([embed]).then();
    // completePending(versionString, null, embed);
});

scheduler.start();