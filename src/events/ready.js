const { Events } = require('discord.js');

let hasInitialized = false;

module.exports = {
  name: Events.ClientReady,
  once: false,
  execute(client) {
    if (!hasInitialized) {
      console.log(`Logged in as ${client.user.tag}`);
      console.log(`Serving ${client.guilds.cache.size} guild(s)`);
      console.log(`Loaded ${client.commands.size} command(s)`);
      hasInitialized = true;
    } else {
      console.log('Gateway reconnected');
    }
  },
};
