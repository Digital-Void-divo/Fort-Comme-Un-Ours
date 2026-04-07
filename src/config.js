const dotenv = require('dotenv');
dotenv.config();

const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  dbPath: process.env.DB_PATH || './fitness.db',
  syncCommands: process.env.SYNC_COMMANDS === 'true',
};
