const { Events } = require('discord.js');
const { errorEmbed } = require('../utils/helpers');
const { handleButton } = require('../services/buttonHandler');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ── Slash commands & autocomplete ──
    if (interaction.isChatInputCommand() || interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        if (interaction.isAutocomplete()) {
          if (command.autocomplete) await command.autocomplete(interaction);
          return;
        }
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error in command ${interaction.commandName}:`, error);
        try {
          const reply = { embeds: [errorEmbed('Something went wrong. Please try again.')], ephemeral: true };
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        } catch (replyError) {
          console.error('Failed to send error reply:', replyError.message);
        }
      }

    // ── Buttons ──
    } else if (interaction.isButton()) {
      try {
        await handleButton(interaction);
      } catch (error) {
        console.error('Error handling button:', error);
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ embeds: [errorEmbed('Button action failed.')], ephemeral: true });
          }
        } catch (replyErr) {
          console.error('Button error reply also failed:', replyErr.message);
        }
      }

    // ── Select menus (string selects used by hub) ──
    } else if (interaction.isStringSelectMenu()) {
      try {
        await handleButton(interaction);
      } catch (error) {
        console.error('Error handling select menu:', error);
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ embeds: [errorEmbed('Selection failed.')], ephemeral: true });
          }
        } catch (replyErr) {
          console.error('Select menu error reply also failed:', replyErr.message);
        }
      }
    }
  },
};
