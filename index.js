// ======================================================
//  DISCORD BOT + EXPRESS SERVER + UNITY ENDPOINT + OAUTH2
// ======================================================

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json()); // allow JSON input (Unity uses this)

// In-memory database for linked accounts
let linkedAccounts = {};  // { playerId: discordId }


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
// OAUTH2 LOGIN SYSTEM (FULLY FIXED + PLAYER ID SUPPORT)
// ======================================================

// STEP 1 — Unity calls this:
// https://yourserver/auth/discord?playerId=PLAYER123
app.get("/auth/discord", (req, res) => {
    const playerId = req.query.playerId;
    if (!playerId)
        return res.status(400).send("Missing playerId");

    const redirectUriBase = process.env.DISCORD_REDIRECT_URI;
    const redirectUri = `${redirectUriBase}?playerId=${encodeURIComponent(playerId)}`;

    const authUrl =
        `https://discord.com/oauth2/authorize` +
        `?client_id=${process.env.DISCORD_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=identify`;

    console.log("OAuth request redirect:", authUrl);
    res.redirect(authUrl);
});



// STEP 2 — Discord redirects here with ?code= & ?playerId=
app.get("/auth/discord/callback", async (req, res) => {
    const code = req.query.code;
    const playerId = req.query.playerId;

    if (!code || !playerId)
        return res.status(400).send("Missing code or playerId");

    const redirectUriBase = process.env.DISCORD_REDIRECT_URI;
    const redirectUri = `${redirectUriBase}?playerId=${encodeURIComponent(playerId)}`;

    try {
        const tokenResponse = await axios.post(
            "https://discord.com/api/oauth2/token",
            new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get(
            "https://discord.com/api/users/@me",
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const discordUser = userResponse.data;

        linkedAccounts[playerId] = discordUser.id;

        res.send(`
            <h1>Discord Linked Successfully!</h1>
            <p>Your Discord ID: ${discordUser.id}</p>
            <p>You may now close this window and return to the game.</p>
        `);

        console.log(`Linked Unity Player ${playerId} -> Discord ${discordUser.id}`);

    } catch (err) {
        console.error("OAuth ERROR:", err.response?.data || err);
        res.status(500).send("OAuth2 Authentication Failed.");
    }
});



// ======================================================
// STEP 6 — UNITY CHECKS IF PLAYER IS LINKED
// ======================================================
app.get("/linked/:playerId", (req, res) => {
    const playerId = req.params.playerId;

    const discordId = linkedAccounts[playerId];

    res.json({
        playerId,
        discordId: discordId || null,
        linked: !!discordId
    });
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
