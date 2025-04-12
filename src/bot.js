require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, REST, Routes } = require('discord.js');
const { exec, execSync } = require('child_process')
const fs = require('fs').promises
const { EmbedBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = [
    {
        name: 'start',
        description: 'Starts the server'
    },
    {
        name: 'stop',
        description: 'Stops the server'
    },
    {
        name: 'stats',
        description: 'See your server statistics',
        options: [
            {
              name: 'username',
              description: 'Minecraft username',
              type: 3, // STRING
              required: true,
            }
        ]
    },
    {
        name: 'leaderboard',
        description: 'Compare your stats',
        options: [
            {
                name: 'stat',
                description: 'the statistic to display',
                type: 3,
                required: true,
                choices: [
                    { name: 'playtime', value: 'play_time' }
                ]
            }
        ]
    }
];

const rest = new REST({ version: '10'}).setToken(process.env.TOKEN);
const cooldownLength = 1 * 20 * 1000; // Cooldown length in milliseconds
let cooldownEndtime = 0;
let configData;
let playerUUIDs = new Map();


client.on('ready', async () => {
    let playerlist;
    // Get config file and player list
    try {
        configData = await getData(process.env.CONFIG);
        playerlist = await getData(configData.serverPath + '/whitelist.json');
    } catch (err) {
        console.log('Config error: ', err);
    }

    playerlist.forEach(player => {
        playerUUIDs.set(player.name, player.uuid);
    })
    
    // Attempts to register command
    console.log('Registering commands...');
    try {
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands}
        );
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.DEV_GUILD_ID),
            { body: commands}
        );
        console.log('Commands registered.');
    } catch (err) {
        console.log('Error registering commands', err);
    };

    console.log(`Logged in as ${client.user.tag}.`);
    client.user.setActivity({
        name: 'Minecraft',
        type: ActivityType.Playing
    });
});

// Handles commands
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) { return; }

    if(interaction.guild.id == process.env.GUILD_ID && !interaction.member.roles.cache.has(process.env.ROLE)){
        return interaction.reply("You do not have permission.")
    }
    
    // Start command
    if (interaction.commandName == 'start') {

        // Cooldown check
        if(Date.now() < cooldownEndtime) {
            return interaction.reply(`The server was recently started/stopped. Please wait ${Math.ceil((cooldownEndtime - currentTime) / 1000)} seconds.`);
        }

        // Checks whether the server is running
        try {
            const status = execSync(`sudo systemctl is-active ${process.env.SERVICE}`).toString().trim();
            if (status === "active") {
                return interaction.reply("Server is already running!");
            }
        } catch (error) {
            // If systemctl fails, assume the service is not running
        }

        exec(`sudo systemctl start ${process.env.SERVICE}`, (error, stdout, stderr) => {
            if(error){
                console.log(error)
                return interaction.reply(`Node error: ${error.message}`);
            }
            if (stderr) {
                console.log(stderr)
                return interaction.reply(`System error: ${stderr}`);
            }
            interaction.reply("Minecraft server started!");
            cooldownEndtime = Date.now() + cooldownLength;
        });
        
    }
    // Stop command
    if (interaction.commandName == 'stop') {

        // Cooldown check
        if(Date.now() < cooldownEndtime) {
            return interaction.reply(`The server was recently started/stopped. Please wait ${Math.ceil((cooldownEndtime - currentTime) / 1000)} seconds.`);
        }

        // Checks whether the server is running
        try {
            const status = execSync(`sudo systemctl is-active ${process.env.SERVICE}`).toString().trim();
            if (status !== "active") {
                return interaction.reply("Server is not running!");
            }
        } catch (error) {
            // If systemctl fails, assume the service is not running
            return interaction.reply("Server is not running!");
        }

        // Reply must be deferred because stopping the server takes
        // 10+ seconds. Discord command timeout is 3 seconds.
        await interaction.deferReply();
        exec(`sudo systemctl stop ${process.env.SERVICE}`, (error, stdout, stderr) => {
            if(error){
                console.log(error)
                return interaction.followUp(`Node error: ${error.message}`);
            }
            if (stderr) {
                console.log(stderr)
                return interaction.followUp(`System error: ${stderr}`);
            }
            interaction.followUp("Minecraft server stopped!");
            cooldownEndtime = Date.now() + cooldownLength;
        });
    }
    if (interaction.commandName == 'stats') {
        const username = interaction.options.getString('username');
        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        
        if(!response.ok) { return interaction.reply("Username not found!") }

        const data = await response.json();
        // Mojang API returns a raw UUID without hyphens
        const uuid = data.id.replace(
            /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
            '$1-$2-$3-$4-$5'
        );

        try {
            const playerStatsPath = configData.serverPath + `/world/stats/${uuid}.json`;
            const playerStatsData = await getData(playerStatsPath);

            const diamondMined = (
                (playerStatsData.stats["minecraft:mined"]["minecraft:diamond_ore"] ?? 0) +
                (playerStatsData.stats["minecraft:mined"]["minecraft:deepslate_diamond_ore"] ?? 0)
            ).toString();
            const copperMined = (
                (playerStatsData.stats["minecraft:mined"]["minecraft:copper_ore"] ?? 0) +
                (playerStatsData.stats["minecraft:mined"]["minecraft:deepslate_copper_ore"] ?? 0)
            ).toString();

            const stoneMined = (playerStatsData.stats["minecraft:mined"]["minecraft:stone"] ?? 0).toString();
            const playtime_ticks = (playerStatsData.stats["minecraft:custom"]["minecraft:play_time"] ?? 0);
            const timeSinceDeath_ticks = (playerStatsData.stats["minecraft:custom"]["minecraft:time_since_death"] ?? 0);
            const playtime = formatTime(playtime_ticks)
            const timeSinceDeath = formatTime(timeSinceDeath_ticks)

            const embed = new EmbedBuilder()
                .setTitle(`${username}'s stats`)
                .addFields(
                    { name: 'Playtime', value: playtime, inline: true },
                    { name: 'Time Since Death', value: timeSinceDeath, inline: true },
                    { name: '\u200B', value: '\u200B', inline: true }
                )
                .addFields(
                    { name: 'Stone', value: stoneMined, inline: true },
                    { name: 'Diamond Ore', value: diamondMined, inline: true },
                    { name: 'Copper Ore', value: copperMined, inline: true }
                );

            interaction.reply({ embeds: [embed]})

        } catch (err) {
            console.error('Could not read config or stats data', err)
            return interaction.reply('Could not read stats data')
        }
    }
    if (interaction.commandName == 'leaderboard') {
        const stat = interaction.options.getString('stat');
        const playerStatsDirectory = configData.serverPath + '/world/stats/';

        let players = [];

        // Retrieves a player's playtime from their statistics file by uuid and pushes it to a new array
        for (const [name, uuid] of playerUUIDs) {
            try {
                const playerStatsData = await getData(playerStatsDirectory + `${uuid}.json`);
                const playtime_ticks = playerStatsData.stats["minecraft:custom"]["minecraft:play_time"] ?? 0;
                players.push({ name: `${name}`, playtime: playtime_ticks})
            } catch (err) {
                console.log(`Error putting ${name} on the leaderboard: `,err);
            }
        }

        // Sort in decending order
        players.sort((a, b) => b.playtime - a.playtime);

        const fields = players.map((player) => ({
            name: player.name,
            value: formatTime(player.playtime)
        }));

        const embed = new EmbedBuilder()
            .setTitle('Leaderboard')
            .addFields(fields);

        interaction.reply({ embeds: [embed]} );
    }
});


client.login(process.env.TOKEN);

async function getData(path) {
    console.log(`Attempting to parse JSON file at ${path}`)
    try {
        const data = await fs.readFile(path, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading file:', err);
        throw err;
    }
}

function formatTime(ticks) {
    if(ticks == 0) { return '0'}
    try {
        const seconds = ticks / 20;
        const hours = Math.floor(seconds / 3600).toString();
        const minutes = Math.floor((seconds % 3600) / 60).toString();
        return `${hours}h ${minutes}m`;
    } catch (err) {
        console.log('Error formatting time', err);
        return 0;
    }
}