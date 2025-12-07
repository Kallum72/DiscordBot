const { Client, GatewayIntentBits, Partials } = require("discord.js");

// Create the bot client
const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds // required but we won't use guild events
    ],
    partials: [Partials.Channel] // Needed to receive DMs
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
    // Ignore server messages — DM only
    if (message.guild) return;

    // Commands
    if (message.content.toLowerCase() === "hi") {
        message.channel.send("Hello! I only work in DMs.");
    }

    if (message.content === "!help") {
        message.channel.send("Commands:\n- hi\n- !help");
    }
});

// Load token from environment variable (Render uses this)
client.login(process.env.TOKEN);
