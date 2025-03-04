require("dotenv").config();
const {
	Client,
	GatewayIntentBits,
	REST,
	Routes,
	EmbedBuilder,
	ActivityType,
} = require("discord.js");
const axios = require("axios");

// Configuration
const API_URL = "https://mc.bloom.host/api";
const SERVER_ID = "0b2bfe5d";
const API_KEY = process.env.PTERODACTYL_API_KEY;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const VOTE_TIMEOUT = 60; // seconds
const MAX_RAM_GB = 12; // Maximum RAM in GB
const STATUS_UPDATE_INTERVAL = 60000; // Update status every minute (60000ms)

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

async function getServerResources() {
	try {
		const response = await axios({
			method: "GET",
			url: `${API_URL}/client/servers/${SERVER_ID}/resources`,
			headers: {
				Authorization: `Bearer ${API_KEY}`,
				Accept: "Application/vnd.pterodactyl.v1+json",
			},
		});
		return response.data.attributes;
	} catch (error) {
		console.error("Error getting server resources:", error.message);
		return null;
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

// Update bot status with RAM usage
async function updateBotStatus() {
	try {
		const resources = await getServerResources();

		if (!resources) {
			client.user.setActivity("Server Offline", {
				type: ActivityType.Watching,
			});
			return;
		}

		const { current_state, resources: serverResources } = resources;

		if (current_state !== "running") {
			client.user.setActivity(`Server ${current_state}`, {
				type: ActivityType.Watching,
			});
			return;
		}

		// Calculate RAM usage in GB (with 2 decimal places)
		const ramUsageGB = (
			serverResources.memory_bytes /
			1024 /
			1024 /
			1024
		).toFixed(2);
		const ramPercentage = ((ramUsageGB / MAX_RAM_GB) * 100).toFixed(0);

		// Set bot status showing RAM usage
		client.user.setActivity(
			`RAM: ${ramUsageGB}GB/${MAX_RAM_GB}GB (${ramPercentage}%)`,
			{
				type: ActivityType.Watching,
			},
		);

		console.log(
			`Updated status: RAM usage ${ramUsageGB}GB/${MAX_RAM_GB}GB (${ramPercentage}%)`,
		);
	} catch (error) {
		console.error("Error updating bot status:", error);
		client.user.setActivity("Status Error", { type: ActivityType.Watching });
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
		let resources;
		do {
			resources = await getServerResources();
			await new Promise((resolve) => setTimeout(resolve, 2000));
		} while (
			resources &&
			resources.current_state !== "offline" &&
			resources.current_state !== "stopping"
		);

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
		{
			name: "status",
			description: "Show current server status and resource usage",
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

	// Initial status update
	updateBotStatus();

	// Set up regular status updates
	setInterval(updateBotStatus, STATUS_UPDATE_INTERVAL);
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
	} else if (commandName === "status") {
		await interaction.deferReply();

		try {
			const resources = await getServerResources();

			if (!resources) {
				return interaction.editReply(
					"Failed to get server status. The server might be offline.",
				);
			}

			const {
				current_state,
				resources: serverResources,
				is_suspended,
			} = resources;

			// Calculate RAM and CPU values
			const ramUsageGB = (
				serverResources.memory_bytes /
				1024 /
				1024 /
				1024
			).toFixed(2);
			const ramPercentage = ((ramUsageGB / MAX_RAM_GB) * 100).toFixed(0);
			const diskUsageGB = (
				serverResources.disk_bytes /
				1024 /
				1024 /
				1024
			).toFixed(2);

			// Format network usage
			const networkRx = (
				serverResources.network_rx_bytes /
				1024 /
				1024
			).toFixed(2);
			const networkTx = (
				serverResources.network_tx_bytes /
				1024 /
				1024
			).toFixed(2);

			// Create a status embed
			const statusEmbed = new EmbedBuilder()
				.setTitle("Minecraft Server Status")
				.setDescription(
					`Current State: **${current_state}**${is_suspended ? " (SUSPENDED)" : ""}`,
				)
				.addFields(
					{
						name: "RAM Usage",
						value: `${ramUsageGB} GB / ${MAX_RAM_GB} GB (${ramPercentage}%)`,
						inline: true,
					},
					{
						name: "CPU Usage",
						value: `${serverResources.cpu_absolute.toFixed(1)}%`,
						inline: true,
					},
					{ name: "Disk Usage", value: `${diskUsageGB} GB`, inline: true },
					{
						name: "Network",
						value: `↓ ${networkRx} MB / ↑ ${networkTx} MB`,
						inline: true,
					},
				)
				.setColor(current_state === "running" ? "#00ff00" : "#ff9900")
				.setTimestamp();

			// Add player count if server is running
			if (
				current_state === "running" &&
				serverResources.online_players !== undefined
			) {
				statusEmbed.addFields({
					name: "Players",
					value: `${serverResources.online_players} / ${serverResources.max_players || "Unknown"}`,
					inline: true,
				});
			}

			await interaction.editReply({ embeds: [statusEmbed] });
		} catch (error) {
			console.error("Error getting status:", error);
			await interaction.editReply(
				"Failed to get server status due to an error.",
			);
		}
	}
});

// Login
client.login(DISCORD_TOKEN);
