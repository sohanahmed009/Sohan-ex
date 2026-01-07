const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");

const { client } = global;
const { configCommands } = global.GoatBot;
const { log } = global.utils;

/* ================= HELPER FUNCTIONS ================= */

function getDomain(url) {
	const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
	const match = url.match(regex);
	return match ? match[1] : null;
}

function isURL(str) {
	try {
		new URL(str);
		return true;
	} catch {
		return false;
	}
}

/* ================= COMMAND EXPORT ================= */

module.exports = {
	config: {
		name: "cmd",
		version: "1.17",
		author: "Badhon",
		countDown: 5,
		role: 2,
		description: {
			en: "Manage your command files"
		},
		category: "Owner",
		guide: {
			en:
				"   {pn} load <command file name>" +
				"\n   {pn} loadAll" +
				"\n   {pn} unload <command file name>" +
				"\n   {pn} install <url> <command file name>" +
				"\n   {pn} install <command file name> <code>"
		}
	},

	langs: {
		en: {
			missingFileName: "⚠️ | Please enter the command name you want to reload",
			loaded: "✅ | CMD LOAD (%1) SUCCESSFULLY IN TANISHA'S SYSTEM",
			loadedError: "❌ | Load command \"%1\" failed with error\n%2: %3",
			loadedSuccess:
				"✅ | LOADED ALL COMMAND'S SUCCESSFULLY IN TANISHA'S SYSTEM\n━━━━━━━━━━━━━━━━━━━━\n📊 TOTAL COMMANDS: %1\n✅ SUCCESSFULLY LOADED: %2\n❌ FAILED TO LOAD: %3\n━━━━━━━━━━━━━━━━━━━━",
			missingCommandNameUnload: "⚠️ | Please enter the command name you want to unload",
			unloaded: "✅ | Unloaded command \"%1\" successfully",
			unloadedError: "❌ | Unload command \"%1\" failed with error\n%2: %3",
			missingUrlCodeOrFileName: "⚠️ | Please enter the url or code and command file name you want to install",
			missingFileNameInstall: "⚠️ | Please enter the file name to save the command (with .js extension)",
			invalidUrl: "⚠️ | Please enter a valid url",
			invalidUrlOrCode: "⚠️ | Unable to get command code",
			alreadExist:
				"⚠️ | The command file already exists.\nReact to this message to overwrite",
			installed: "✅ | CMD INSTALLATION (%1) IS DONE IN TANISHA'S SYSTEM",
			installedError: "❌ | Failed to install command \"%1\" with error\n%2: %3",
			loadSingle: "✅ | CMD LOAD (%1) SUCCESSFULLY IN TANISHA'S SYSTEM",
			batchLoadResult:
				"🔰 | BATCH LOAD COMPLETED IN TANISHA'S SYSTEM\n━━━━━━━━━━━━━━━━━━━━\n📁 TOTAL COMMANDS: %1\n✅ SUCCESSFULLY LOADED: %2\n❌ FAILED TO LOAD: %3\n📋 FAILED COMMANDS:\n%4\n━━━━━━━━━━━━━━━━━━━━"
		}
	},

	/* ================= onStart ================= */

	onStart: async function ({
		args,
		message,
		api,
		threadModel,
		userModel,
		dashBoardModel,
		globalModel,
		threadsData,
		usersData,
		dashBoardData,
		globalData,
		event,
		commandName,
		getLang
	}) {

		// ✅ USE GOATBOT CORE UTILS
		const { loadScripts, unloadScripts } = global.utils;

		/* ===== LOAD SINGLE ===== */
		if (args[0] === "load" && args[1]) {
			const info = loadScripts(
				"cmds",
				args[1],
				log,
				configCommands,
				api,
				threadModel,
				userModel,
				dashBoardModel,
				globalModel,
				threadsData,
				usersData,
				dashBoardData,
				globalData,
				getLang
			);

			return info.status === "success"
				? message.reply(getLang("loadSingle", info.name))
				: message.reply(getLang("loadedError", info.name, info.error.name, info.error.message));
		}

		/* ===== LOAD ALL ===== */
		if (args[0]?.toLowerCase() === "loadall") {
			const files = fs.readdirSync(__dirname)
				.filter(f => f.endsWith(".js") && !f.endsWith(".dev.js"))
				.map(f => f.replace(".js", ""));

			let success = [];
			let fail = [];

			for (const file of files) {
				const res = loadScripts(
					"cmds",
					file,
					log,
					configCommands,
					api,
					threadModel,
					userModel,
					dashBoardModel,
					globalModel,
					threadsData,
					usersData,
					dashBoardData,
					globalData,
					getLang
				);

				res.status === "success"
					? success.push(file)
					: fail.push(`• ${file} → ${res.error.message}`);
			}

			return message.reply(
				getLang(
					"batchLoadResult",
					files.length,
					success.length,
					fail.length,
					fail.join("\n")
				)
			);
		}

		/* ===== UNLOAD ===== */
		if (args[0] === "unload") {
			if (!args[1])
				return message.reply(getLang("missingCommandNameUnload"));

			const info = unloadScripts("cmds", args[1], configCommands, getLang);
			return message.reply(getLang("unloaded", info.name));
		}

		/* ===== INSTALL ===== */
		if (args[0] === "install") {
			let url = args[1];
			let fileName = args[2];
			let rawCode;

			if (!url || !fileName)
				return message.reply(getLang("missingUrlCodeOrFileName"));

			if (url.endsWith(".js") && !isURL(url)) {
				const tmp = fileName;
				fileName = url;
				url = tmp;
			}

			
			if (isURL(url)) {
				if (!fileName.endsWith(".js"))
					return message.reply(getLang("missingFileNameInstall"));

				const domain = getDomain(url);
				if (!domain) return message.reply(getLang("invalidUrl"));

				if (domain === "github.com")
					url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");

				rawCode = (await axios.get(url)).data;

				if (domain === "savetext.net") {
					const $ = cheerio.load(rawCode);
					rawCode = $("#content").text();
				}
			}
				
			else {
				if (!fileName.endsWith(".js"))
					return message.reply(getLang("missingFileNameInstall"));

				rawCode = event.body.slice(event.body.indexOf(fileName) + fileName.length + 1);
			}

			if (!rawCode)
				return message.reply(getLang("invalidUrlOrCode"));

			const fullPath = path.join(__dirname, fileName);

			if (fs.existsSync(fullPath)) {
				return message.reply(getLang("alreadExist"), (err, info) => {
					global.GoatBot.onReaction.set(info.messageID, {
						commandName,
						author: event.senderID,
						data: { fileName, rawCode }
					});
				});
			}

			const info = loadScripts(
				"cmds",
				fileName,
				log,
				configCommands,
				api,
				threadModel,
				userModel,
				dashBoardModel,
				globalModel,
				threadsData,
				usersData,
				dashBoardData,
				globalData,
				getLang,
				rawCode
			);

			return info.status === "success"
				? message.reply(getLang("installed", info.name))
				: message.reply(getLang("installedError", info.name, info.error.name, info.error.message));
		}

		return message.SyntaxError();
	},

	onReaction: async function ({ Reaction, event, message, api, getLang }) {
		const { loadScripts } = global.utils;
		if (event.userID !== Reaction.author) return;

		const { fileName, rawCode } = Reaction.data;

		const info = loadScripts(
			"cmds",
			fileName,
			log,
			configCommands,
			api,
			null, null, null, null,
			null, null, null, null,
			getLang,
			rawCode
		);

		return info.status === "success"
			? message.reply(getLang("installed", info.name))
			: message.reply(getLang("installedError", info.name, info.error.name, info.error.message));
	}
};
