require("dotenv").config();
const {
	Client,
	GatewayIntentBits,
	REST,
	Routes,
	EmbedBuilder,
} = require("discord.js");
const axios = require("axios");

// Configuration
const API_URL = "https://mc.bloom.host/api";
const SERVER_ID = "0b2bfe5d";
const API_KEY = process.env.PTERODACTYL_API_KEY;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const VOTE_TIMEOUT = 60; // seconds

// Client setup
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

// Restart state
let restartInProgress = false;
let cancelVoteTimer = null;

// API helper functions
async function sendServerCommand(command) {
	try {
		await axios({
			method: "POST",
			url: `${API_URL}/client/servers/${SERVER_ID}/command`,
			headers: {
				Authorization: `Bearer ${API_KEY}`,
				Accept: "Application/vnd.pterodactyl.v1+json",
				"Content-Type": "application/json",
			},
			data: { command },
		});
		return true;
	} catch (error) {
		console.error("Error sending command:", error.message);
		return false;
	}
}

async function getServerStatus() {
	try {
		const response = await axios({
			method: "GET",
			url: `${API_URL}/client/servers/${SERVER_ID}/resources`,
			headers: {
				Authorization: `Bearer ${API_KEY}`,
				Accept: "Application/vnd.pterodactyl.v1+json",
			},
		});
		return response.data.attributes.current_state;
	} catch (error) {
		console.error("Error getting server status:", error.message);
		return "unknown";
	}
}

async function setPowerState(state) {
	try {
		await axios({
			method: "POST",
			url: `${API_URL}/client/servers/${SERVER_ID}/power`,
			headers: {
				Authorization: `Bearer ${API_KEY}`,
				Accept: "Application/vnd.pterodactyl.v1+json",
				"Content-Type": "application/json",
			},
			data: { signal: state },
		});
		return true;
	} catch (error) {
		console.error(`Error setting power state to ${state}:`, error.message);
		return false;
	}
}

// Restart server process
async function performRestart(interaction) {
	try {
		// Announce restart
		await sendServerCommand("say Server will restart in 10 seconds!");

		// Save the world
		await interaction.editReply("Saving the world...");
		await sendServerCommand("save-all");

		// Wait 10 seconds
		await new Promise((resolve) => setTimeout(resolve, 10000));

		// Stop the server
		await interaction.editReply("Stopping the server...");
		await setPowerState("stop");

		// Wait for server to stop
		await interaction.editReply("Waiting for server to stop...");
		let status;
		do {
			status = await getServerStatus();
			await new Promise((resolve) => setTimeout(resolve, 2000));
		} while (status !== "offline" && status !== "stopping");

		// Start the server
		await interaction.editReply("Starting the server back up...");
		await setPowerState("start");

		await interaction.editReply("Server has been restarted successfully!");
	} catch (error) {
		await interaction.editReply(`Error during restart: ${error.message}`);
	} finally {
		restartInProgress = false;
	}
}

// Register slash commands
async function registerCommands() {
	const commands = [
		{
			name: "restart",
			description: "Start a vote to restart the Minecraft server",
		},
		{
			name: "cancel",
			description: "Cancel an ongoing restart vote",
		},
		{
			name: "force-restart",
			description: "Force restart the Minecraft server (Admin only)",
		},
	];

	try {
		const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
		console.log("Registering slash commands...");

		await rest.put(Routes.applicationCommands(client.user.id), {
			body: commands,
		});

		console.log("Slash commands registered successfully!");
	} catch (error) {
		console.error("Error registering slash commands:", error);
	}
}

// Event handlers
client.once("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
	registerCommands();
});

client.on("interactionCreate", async (interaction) => {
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;

	if (commandName === "restart") {
		if (restartInProgress) {
			return interaction.reply("A restart is already in progress!");
		}

		restartInProgress = true;

		const embed = new EmbedBuilder()
			.setTitle("Server Restart Vote")
			.setDescription(
				`Server restart initiated.\nThe server will restart in ${VOTE_TIMEOUT} seconds unless canceled with \`/cancel\`.`,
			)
			.setColor("#ff9900")
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });

		// Set a timer to restart the server after the timeout
		cancelVoteTimer = setTimeout(async () => {
			const statusEmbed = new EmbedBuilder()
				.setTitle("Server Restart")
				.setDescription("Restart vote passed! Restarting server now...")
				.setColor("#00ff00")
				.setTimestamp();

			await interaction.editReply({ embeds: [statusEmbed] });

			// Perform the actual restart
			await performRestart(interaction);
		}, VOTE_TIMEOUT * 1000);
	} else if (commandName === "cancel") {
		if (!restartInProgress) {
			return interaction.reply("There is no restart in progress to cancel!");
		}

		// Clear the restart timer
		clearTimeout(cancelVoteTimer);
		restartInProgress = false;

		const embed = new EmbedBuilder()
			.setTitle("Restart Canceled")
			.setDescription("The server restart has been canceled.")
			.setColor("#00ff00")
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });
		await sendServerCommand("say Server restart has been canceled.");
	} else if (commandName === "force-restart") {
		// You might want to add permission checks here

		const embed = new EmbedBuilder()
			.setTitle("Force Restart")
			.setDescription("Force restarting the server...")
			.setColor("#ff0000")
			.setTimestamp();

		await interaction.reply({ embeds: [embed] });

		// Kill and restart the server
		await sendServerCommand("say SERVER IS BEING FORCE RESTARTED!");
		await setPowerState("kill");

		// Wait a bit for the kill to take effect
		await new Promise((resolve) => setTimeout(resolve, 5000));

		// Start the server
		await setPowerState("start");

		await interaction.editReply("Server has been force restarted!");
	}
});

// Login
client.login(DISCORD_TOKEN);
