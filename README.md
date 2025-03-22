# Pterodactyl Server Discord Bot

A Discord bot for managing your Minecraft server hosted on Bloom Host or any Pterodactyl panel. This bot allows server administrators and users to check server status, resources usage, and perform server restarts through Discord commands.

## Features

- 📊 **Real-time Status Monitoring**: View server status, RAM usage, CPU usage, and player count
- 🔄 **Server Restart Management**: Initiate, vote on, and cancel server restarts
- 🚀 **Force Restart Option**: For admins to quickly restart the server when needed
- 👁️ **Status Display**: Bot status shows current RAM usage

## Prerequisites

- A Minecraft server hosted on Bloom Host or any Pterodactyl-based hosting provider
- A Discord server where you have admin permissions
- Node.js (v16.9.0 or higher)
- npm (Node package manager)

## Setup Instructions

### Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under the "TOKEN" section, click "Copy" to copy your bot token
5. Save this token for later use
6. Under "Privileged Gateway Intents", enable both "SERVER MEMBERS INTENT" and "MESSAGE CONTENT INTENT"
7. Under the "OAuth2" tab, select "bot" in the scopes section
8. In the bot permissions section, select:
   - Read Messages/View Channels
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
9. Copy the generated URL and open it in your browser to add the bot to your server

### Step 2: Get Your Pterodactyl API Key

1. Login to your Pterodactyl panel (e.g., https://mc.bloom.host)
2. Go to Account Management (bottom left corner of your dashboard)
3. Select the "API Credentials" tab
4. Create a new API key
5. Save this API key for later use

### Step 3: Set Up the Bot

1. Clone this repository or download the source code
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following content:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   PTERODACTYL_API_KEY=your_pterodactyl_api_key_here
   ```
4. Update the configuration in `index.js`:
   ```javascript
   // Configuration
   const API_URL = "https://your.pterodactyl.panel/api"; // Update with your panel URL
   const SERVER_ID = "your_server_id"; // Update with your server ID
   const MAX_RAM_GB = 12; // Update with your server's RAM allocation
   ```

### Step 4: Start the Bot

Run the bot using:
```bash
node index.js
```

For production use, consider using a process manager like PM2:
```bash
npm install -g pm2
pm2 start index.js --name "minecraft-discord-bot"
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/status` | Shows current server status, including RAM/CPU usage and player count |
| `/restart` | Initiates a vote to restart the server with a configurable timeout |
| `/cancel` | Cancels an ongoing restart vote |
| `/force-restart` | Forces an immediate server restart (Admin only) |

## Customization

You can customize various settings in the `index.js` file:

- `VOTE_TIMEOUT`: Duration in seconds for restart votes (default: 60)
- `MAX_RAM_GB`: Maximum RAM allocation for your server (default: 12)
- `STATUS_UPDATE_INTERVAL`: How often to update the bot's status (default: 60000ms)

## Troubleshooting

- **API Connection Issues**: Ensure your API URL is correct and your API key has the proper permissions
- **Bot Not Responding**: Check if your Discord token is correct and that the bot has proper permissions in your Discord server
- **Command Registration Failed**: Restart the bot after adding it to a new server

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to improve the bot.

## License

[MIT License](LICENSE)

## Disclaimer

This bot is not officially affiliated with Bloom Host or Pterodactyl. Use at your own risk.
