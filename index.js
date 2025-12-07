// ------------------------------
// Discord + Unity Integration Bot
// DM-only bot with Express API
// ------------------------------

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
const app = express();

// Allow JSON request bodies (Unity uses this)
app.use(express.json());

// ---------- DISCORD BOT ----------
const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds // Required by Discord for basic operation
    ],
    partials: [Partials.Channel] // Needed to receive DMs
});

// When the bot logs in:
client.on("ready", () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

// DM-only listener
client.on("messageCreate", (message) => {
    if (message.guild) return; // Ignore messages in servers

    const content = message.content.toLowerCase();

    if (content === "hi") {
        message.channel.send("Hello! I only respond in DMs.");
    }

    if (content === "!help") {
        message.channel.send("Commands:\n- hi\n- !help\n\nUnity can also make me message you!");
    }
});

// ---------- UNITY API ENDPOINT ----------
// Unity can POST JSON:
// { "userId": "123456...", "message": "Hello from Unity" }

app.post("/send", async (req, res) => {
    const { userId, message } = req.body;

    if (!userId || !message) {
        return res.status(400).send("Missing 'userId' or 'message'");
    }

    try {
        const user = await client.users.fetch(userId);
        await user.send(message);
        console.log(`Sent Unity message to ${user.tag}: ${message}`);
        res.send("Message sent successfully!");
    } catch (err) {
        console.error("Error sending DM:", err);
        res.status(500).send("Failed to send message");
    }
});

// ---------- START EXPRESS SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Unity API listening on port ${PORT}`));

// ---------- LOGIN BOT ----------
client.login(process.env.TOKEN);
