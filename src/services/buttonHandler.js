const { getGuildConfig } = require('./database');

const handlers = {};

// Store last embeds for publish functionality
const publishCache = new Map();

function registerButton(prefix, handler) {
  handlers[prefix] = handler;
}

function cacheEmbed(key, embeds, guildId, files = null) {
  publishCache.set(key, { embeds, files, guildId, cachedAt: Date.now() });
  // Clean old entries (>30 min)
  for (const [k, v] of publishCache) {
    if (Date.now() - v.cachedAt > 1800000) publishCache.delete(k);
  }
}

function getCachedEmbed(key) {
  return publishCache.get(key);
}

async function handleButton(interaction) {
  const customId = interaction.customId;
  const prefix = customId.split('|')[0];

  // Handle publish button globally
  if (prefix === 'publish') {
    return handlePublish(interaction);
  }

  const handler = handlers[prefix];
  if (handler) {
    await handler(interaction);
  }
}

async function handlePublish(interaction) {
  const key = interaction.customId.split('|').slice(1).join('|');
  const cached = getCachedEmbed(key);

  if (!cached) {
    return interaction.reply({ content: 'This content has expired. Please run the command again.', ephemeral: true });
  }

  try {
    // Get fitness role for mention
    const fitnessRoleId = getGuildConfig(interaction.guildId, 'fitness_role_id');
    let content = null;
    if (fitnessRoleId) {
      const role = interaction.guild.roles.cache.get(fitnessRoleId);
      if (role) content = role.toString();
    }

    const sendPayload = { content, embeds: cached.embeds };
    if (cached.files && cached.files.length) sendPayload.files = cached.files;
    await interaction.channel.send(sendPayload);

    // Disable the button
    try {
      const msg = interaction.message;
      const newComponents = msg.components.map(row => {
        const newRow = require('discord.js').ActionRowBuilder.from(row);
        newRow.components.forEach(c => {
          if (c.data.custom_id === interaction.customId) c.setDisabled(true);
        });
        return newRow;
      });
      await interaction.update({ components: newComponents });
    } catch {
      await interaction.deferUpdate();
    }
  } catch (err) {
    try {
      await interaction.reply({ content: 'Failed to publish. Make sure the bot has permission to send messages here.', ephemeral: true });
    } catch (replyErr) {
      console.error('Publish error reply failed:', replyErr.message);
    }
  }
}

module.exports = { registerButton, handleButton, cacheEmbed, getCachedEmbed };
