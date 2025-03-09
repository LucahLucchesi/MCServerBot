require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});
// Cooldown time in milliseconds
const cooldownLength = 5 * 60 * 1000;
// Stores when the cooldown is over
let cooldownEndtime = 0;


// Handles commands
client.on('interactionCreate', (interaction) => {
    if (!interaction.isChatInputCommand()) { return; }
    
    if (interaction.commandName == 'ping') {
        interaction.reply("pong!");
    }
    // Server start script here
    if (interaction.commandName == 'start') {
        const currentTime = Date.now()
        if(currentTime < cooldownEndtime) {
            interaction.reply(`The server was recently started. Please wait ${Math.ceil((cooldownEndtime - currentTime) / 1000)} seconds.`);
        } else {
            // Start server script
            cooldownEndtime = currentTime + cooldownLength;
            interaction.reply("Server started");
        }
    }
    // Server stop script here
    if (interaction.commandName == 'stop') {
        interaction.reply("Server stopped");
    }
})

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}.`);
    client.user.setActivity({
        name: 'Minecraft',
        type: ActivityType.Playing
    })
})

client.login(process.env.TOKEN);