require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, REST, Routes } = require('discord.js');
const { exec } = require('child_process')
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});
// Command cooldown in milliseconds (m * s * ms)
const cooldownLength = 1 * 20 * 1000;

const commands = [
{
        name: 'start',
        description: 'Starts the server'
    },
    {
        name: 'stop',
        description: 'Stops the server'
    }
];

const rest = new REST({ version: '10'}).setToken(process.env.TOKEN);

client.on('ready', () => {
    // Attempts to register command
    (async () => {
        try {
            console.log('Registering commands...');
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands}
            );
            console.log('Commands registered.');
        } catch (error) {
            console.log(`Error: ${error}`);
        };
    })();
    console.log(`Logged in as ${client.user.tag}.`);
    client.user.setActivity({
        name: 'Minecraft',
        type: ActivityType.Playing
    });
});

// Stores when the cooldown is over
let cooldownEndtime = 0;

// Handles commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) { return; }
    
    // Start command
    if (interaction.commandName == 'start') {
        const currentTime = Date.now();
        if(currentTime < cooldownEndtime) {
            interaction.reply(`The server was recently started/stopped. Please wait ${Math.ceil((cooldownEndtime - currentTime) / 1000)} seconds.`);
        } else {
            exec(`sudo systemctl start ${process.env.SERVICE}`, (error, stderr) => {
                if(error){
                    return interaction.reply(`Node error: ${error.message}`);
                }
                if (stderr) {
                    return interaction.reply(`System error: ${stderr}`);
                }
                interaction.reply("Minecraft server started!");
                cooldownEndtime = currentTime + cooldownLength;
            });
        }
    }
    // Stop command
    if (interaction.commandName == 'stop') {
        const currentTime = Date.now();
        if(currentTime < cooldownEndtime) {
            interaction.reply(`The server was recently started/stopped. Please wait ${Math.ceil((cooldownEndtime - currentTime) / 1000)} seconds.`);
        } else {
            // Reply must be deferred because stopping the server takes
            // 10+ seconds. Discord command timeout is 3 seconds.
            await interaction.deferReply();
            exec(`sudo systemctl stop ${process.env.SERVICE}`, (error, stderr) => {
                if(error){
                    return interaction.followUp(`Node error: ${error.message}`);
                }
                if (stderr) {
                    return interaction.followUp(`System error: ${stderr}`);
                }
                interaction.followUp("Minecraft server stopped!");
                cooldownEndtime = currentTime + cooldownLength;
            });
        }
    }
});

client.login(process.env.TOKEN);