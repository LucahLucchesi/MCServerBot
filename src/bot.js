require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}.`);
})

// Handles commands
client.on('interactionCreate', (interaction) => {
    if (!interaction.isChatInputCommand()) { return; }
    
    if (interaction.commandName == 'ping') {
        interaction.reply("pong!");
    }
    // Server start script here
    if (interaction.commandName == 'start') {
        interaction.reply("Server started");
    }
    // Server stop script here
    if (interaction.commandName == 'stop') {
        interaction.reply("Server stopped");
    }
})

client.login(process.env.TOKEN);