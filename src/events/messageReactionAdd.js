const { Events, EmbedBuilder } = require('discord.js');
const buddies = require('../services/buddyService');
const audit = require('../services/auditService');
const { COLORS, successEmbed, embed, safeDM } = require('../utils/helpers');

const ACCEPT_EMOJI = '✅';
const DECLINE_EMOJI = '❌';

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    try {
      if (user.bot) return;

      // Hydrate partials.
      if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
      }
      if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
      }

      const emoji = reaction.emoji.name;
      if (emoji !== ACCEPT_EMOJI && emoji !== DECLINE_EMOJI) return;

      const pair = buddies.findByDmMessage(reaction.message.id);
      if (!pair) return;
      if (pair.user2_id !== user.id) return; // only recipient can respond

      const accept = emoji === ACCEPT_EMOJI;
      const ok = accept ? buddies.accept(pair.id) : buddies.decline(pair.id);
      if (!ok) return;
      audit.log(pair.guild_id, user.id, accept ? 'buddy.accept_reaction' : 'buddy.decline_reaction', { pairId: pair.id });

      // Update the DM
      try {
        const updated = accept
          ? successEmbed('Buddy Accepted', `You and <@${pair.user1_id}> are now accountability buddies.`)
          : embed('Buddy Declined', `You declined <@${pair.user1_id}>'s request.`, COLORS.warning);
        await reaction.message.edit({ embeds: [updated], components: [] });
      } catch { /* ignore */ }

      // Notify the requester
      try {
        const requester = await reaction.client.users.fetch(pair.user1_id);
        await safeDM(requester, {
          embeds: [accept
            ? successEmbed('Buddy Request Accepted', `<@${pair.user2_id}> accepted your buddy request!`)
            : embed('Buddy Request Declined', `<@${pair.user2_id}> declined your buddy request.`, COLORS.warning)],
        });
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Reaction handler failed:', err.message);
    }
  },
};
