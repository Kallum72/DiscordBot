// ======================================================
//  DISCORD BOT + EXPRESS SERVER + UNITY ENDPOINT + OAUTH2
// ======================================================

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json()); // allow JSON input (Unity uses this)


// -------------------------------------
// DISCORD BOT SETUP
// -------------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.Guilds
    ],
    partials: [Partials.Channel]
});

client.on("ready", () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});

// DM-only responses for debugging
client.on("messageCreate", (message) => {
    if (message.guild) return; // ignore server messages

    if (message.content.toLowerCase() === "hi") {
        message.channel.send("Hello! I only respond in DMs.");
    }
    if (message.content === "!help") {
        message.channel.send("Commands: hi, !help\nUnity integration is active.");
    }
});


// -------------------------------------
// UNITY API ENDPOINT: Send DM to a user
// -------------------------------------
app.post("/send", async (req, res) => {
    const { userId, message } = req.body;

    if (!userId || !message)
        return res.status(400).send("Missing userId or message");

    try {
        const user = await client.users.fetch(userId);
        await user.send(message);

        console.log(`DM sent to ${user.tag}: ${message}`);
        res.send("Message sent successfully!");
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to send message.");
    }
});


// ======================================================
// OAUTH2 LOGIN SYSTEM (STEP 3 INTEGRATED)
// ======================================================

// STEP 1 — Redirect user to Discord login
app.get("/auth/discord", (req, res) => {
    const redirect = 
        "https://discord.com/oauth2/authorize" +
        `?client_id=${process.env.DISCORD_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=identify`;

    res.redirect(redirect);
});


// STEP 2 — Discord redirects user here with ?code=
app.get("/auth/discord/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send("Missing OAuth2 code.");

    try {
        // Exchange code for access token
        const tokenResponse = await axios.post(
            "https://discord.com/api/oauth2/token",
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const accessToken = tokenResponse.data.access_token;

        // Get user info
        const userResponse = await axios.get(
            "https://discord.com/api/users/@me",
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const discordUser = userResponse.data;

        console.log("OAuth2 login:", discordUser);

        // You will want to store this mapping permanently.
        // Save: yourGamePlayerId -> discordUser.id

        res.send(`
            <h1>Discord Linked Successfully!</h1>
            <p>Your Discord ID: ${discordUser.id}</p>
            <p>You may now close this window and return to the game.</p>
        `);

    } catch (err) {
        console.error(err.response?.data || err);
        res.status(500).send("OAuth2 Authentication Failed.");
    }
});


// -------------------------------------
// START EXPRESS WEB SERVER
// -------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server online on port ${PORT}`));


// -------------------------------------
// LOGIN DISCORD BOT
// -------------------------------------
client.login(process.env.TOKEN);
