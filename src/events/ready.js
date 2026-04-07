const { Events, REST, Routes } = require('discord.js');
const config = require('../config');

let hasInitialized = false;

module.exports = {
  name: Events.ClientReady,
  once: false,
  async execute(client) {
    if (!hasInitialized) {
      console.log(`Logged in as ${client.user.tag}`);
      console.log(`Serving ${client.guilds.cache.size} guild(s)`);
      console.log(`Loaded ${client.commands.size} command(s)`);

      // Auto-sync slash commands if SYNC_COMMANDS=true
      if (config.syncCommands) {
        try {
          const commands = [...client.commands.values()].map(c => c.data.toJSON());
          const rest = new REST().setToken(config.token);

          if (config.guildId) {
            await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
            console.log(`Synced ${commands.length} guild commands to ${config.guildId}`);
          } else {
            await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
            console.log(`Synced ${commands.length} global commands (may take up to 1 hour to propagate)`);
          }
        } catch (err) {
          console.error('Failed to sync commands:', err);
        }
      }

      hasInitialized = true;
    } else {
      console.log('Gateway reconnected');
    }
  },
};
