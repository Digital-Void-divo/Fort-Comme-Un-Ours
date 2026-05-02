const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { getDb } = require('../../services/database');
const buddies = require('../../services/buddyService');
const audit = require('../../services/auditService');
const { COLORS, embed, successEmbed, safeDM } = require('../../utils/helpers');
const { registerButton } = require('../../services/buttonHandler');

const ACCEPT_EMOJI = '✅';
const DECLINE_EMOJI = '❌';

function requestEmbed(requesterTag, label, guildName) {
  const reasonLine = label ? `\n**Note:** ${label}` : '';
  return new EmbedBuilder()
    .setTitle('🤝 Accountability Buddy Request')
    .setDescription(
      `**${requesterTag}** wants you as an accountability buddy in **${guildName}**.${reasonLine}\n\n` +
      `React ${ACCEPT_EMOJI} to **accept** or ${DECLINE_EMOJI} to **decline**.\n` +
      'You can also reply with `/partner accept` or `/partner decline` in the server.'
    )
    .setColor(COLORS.primary)
    .setFooter({ text: 'Requests expire in 7 days.' })
    .setTimestamp();
}

// Button-based accept/decline as a fallback when reactions can't be used.
registerButton('buddy_accept', async (interaction) => {
  const id = parseInt(interaction.customId.split('|')[1], 10);
  await respondToRequest(interaction, id, true);
});
registerButton('buddy_decline', async (interaction) => {
  const id = parseInt(interaction.customId.split('|')[1], 10);
  await respondToRequest(interaction, id, false);
});

async function respondToRequest(interaction, pairId, accept) {
  const pair = buddies.getById(pairId);
  if (!pair || pair.status !== 'pending' || !pair.active) {
    return interaction.reply({ content: 'This request is no longer pending.', ephemeral: true });
  }
  if (pair.user2_id !== interaction.user.id) {
    return interaction.reply({ content: 'Only the recipient can respond to this request.', ephemeral: true });
  }
  const ok = accept ? buddies.accept(pairId) : buddies.decline(pairId);
  if (!ok) {
    return interaction.reply({ content: 'Could not update the request.', ephemeral: true });
  }
  audit.log(pair.guild_id, interaction.user.id, accept ? 'buddy.accept' : 'buddy.decline', { pairId });

  const e = accept
    ? successEmbed('Buddy Accepted', `You and <@${pair.user1_id}> are now accountability buddies.`)
    : embed('Buddy Declined', `You declined <@${pair.user1_id}>'s request.`, COLORS.warning);
  try { await interaction.update({ embeds: [e], components: [] }); }
  catch { try { await interaction.reply({ embeds: [e], ephemeral: true }); } catch { /* ignore */ } }

  // Notify requester
  try {
    const requester = await interaction.client.users.fetch(pair.user1_id);
    await safeDM(requester, {
      embeds: [accept
        ? successEmbed('Buddy Request Accepted', `<@${pair.user2_id}> accepted your buddy request!`)
        : embed('Buddy Request Declined', `<@${pair.user2_id}> declined your buddy request.`, COLORS.warning)],
    });
  } catch { /* ignore */ }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Accountability buddy system (multi-buddy supported)')
    .addSubcommand(sub =>
      sub.setName('request').setDescription('Request someone to be your accountability buddy')
        .addUserOption(opt => opt.setName('user').setDescription('User to ask').setRequired(true))
        .addStringOption(opt => opt.setName('label').setDescription('What kind of buddy? (lifting, running, nutrition...)').setMaxLength(60)))
    .addSubcommand(sub =>
      sub.setName('accept').setDescription('Accept a pending buddy request')
        .addUserOption(opt => opt.setName('user').setDescription('Requester').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('decline').setDescription('Decline a pending buddy request')
        .addUserOption(opt => opt.setName('user').setDescription('Requester').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List your accountability buddies'))
    .addSubcommand(sub =>
      sub.setName('pending').setDescription('Show your pending requests (incoming + outgoing)'))
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Show buddy activity summary')
        .addUserOption(opt => opt.setName('user').setDescription('A specific buddy (optional)')))
    .addSubcommand(sub =>
      sub.setName('remove').setDescription('Remove a buddy partnership')
        .addUserOption(opt => opt.setName('user').setDescription('Buddy to remove').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'request') {
      const target = interaction.options.getUser('user');
      const label = interaction.options.getString('label') || null;

      if (target.id === interaction.user.id) {
        return interaction.reply({ content: 'You can\'t partner with yourself.', ephemeral: true });
      }
      if (target.bot) {
        return interaction.reply({ content: 'You can\'t partner with a bot.', ephemeral: true });
      }

      const created = buddies.createRequest(interaction.guildId, interaction.user.id, target.id, label);
      if (!created.ok) {
        if (created.reason === 'already_active') {
          return interaction.reply({ content: 'You are already buddies with this user.', ephemeral: true });
        }
        if (created.reason === 'already_pending') {
          return interaction.reply({ content: 'There is already a pending request with this user.', ephemeral: true });
        }
        return interaction.reply({ content: 'Could not create the request.', ephemeral: true });
      }

      // DM the target with reactions + buttons
      const dmEmbed = requestEmbed(`<@${interaction.user.id}>`, label, interaction.guild.name);
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`buddy_accept|${created.id}`).setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji(ACCEPT_EMOJI),
        new ButtonBuilder().setCustomId(`buddy_decline|${created.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji(DECLINE_EMOJI),
      );
      let dmFailed = false;
      try {
        const dm = await target.createDM();
        const msg = await dm.send({ embeds: [dmEmbed], components: [buttons] });
        try { await msg.react(ACCEPT_EMOJI); await msg.react(DECLINE_EMOJI); } catch { /* reactions optional */ }
        buddies.attachDmInfo(created.id, dm.id, msg.id);
      } catch {
        dmFailed = true;
      }
      audit.log(interaction.guildId, interaction.user.id, 'buddy.request', { pairId: created.id, target: target.id });

      const reply = dmFailed
        ? `Couldn't DM ${target.username} (their DMs may be off). They can still accept with \`/partner accept user:@${interaction.user.username}\`.`
        : `Request sent to ${target.username} via DM. They have 7 days to respond.`;
      return interaction.reply({ embeds: [embed('Buddy Request Sent', reply, COLORS.success)], ephemeral: true });
    }

    if (sub === 'accept' || sub === 'decline') {
      const requester = interaction.options.getUser('user');
      const pair = db.prepare(
        `SELECT * FROM accountability_pairs
          WHERE guild_id = ? AND user1_id = ? AND user2_id = ? AND status = 'pending' AND active = 1
          ORDER BY id DESC LIMIT 1`
      ).get(interaction.guildId, requester.id, interaction.user.id);
      if (!pair) {
        return interaction.reply({ content: `No pending request from ${requester.username}.`, ephemeral: true });
      }
      const ok = sub === 'accept' ? buddies.accept(pair.id) : buddies.decline(pair.id);
      audit.log(interaction.guildId, interaction.user.id, sub === 'accept' ? 'buddy.accept' : 'buddy.decline', { pairId: pair.id });
      if (!ok) return interaction.reply({ content: 'Could not update the request.', ephemeral: true });

      try {
        await safeDM(requester, {
          embeds: [sub === 'accept'
            ? successEmbed('Buddy Request Accepted', `<@${interaction.user.id}> accepted your buddy request!`)
            : embed('Buddy Request Declined', `<@${interaction.user.id}> declined your buddy request.`, COLORS.warning)],
        });
      } catch { /* ignore */ }

      return interaction.reply({
        embeds: [sub === 'accept'
          ? successEmbed('Buddy Accepted', `You and <@${requester.id}> are now accountability buddies.`)
          : embed('Buddy Declined', `You declined <@${requester.id}>'s request.`, COLORS.warning)],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const list = buddies.getActiveBuddies(interaction.user.id, interaction.guildId);
      if (list.length === 0) {
        return interaction.reply({ embeds: [embed('Buddies', 'You don\'t have any accountability buddies yet. Use `/partner request`.', COLORS.warning)], ephemeral: true });
      }
      const e = new EmbedBuilder()
        .setTitle(`🤝 Your Accountability Buddies (${list.length})`)
        .setColor(COLORS.primary).setTimestamp();
      for (const b of list) {
        const labelLine = b.relationship_label ? ` · ${b.relationship_label}` : '';
        e.addFields({ name: `<@${b.partner_id}>${labelLine}`, value: `Since <t:${b.created_at}:R>` });
      }
      return interaction.reply({ embeds: [e], ephemeral: true });
    }

    if (sub === 'pending') {
      const incoming = buddies.getPendingIncoming(interaction.user.id, interaction.guildId);
      const outgoing = buddies.getPendingOutgoing(interaction.user.id, interaction.guildId);
      if (incoming.length === 0 && outgoing.length === 0) {
        return interaction.reply({ content: 'No pending buddy requests.', ephemeral: true });
      }
      const e = new EmbedBuilder().setTitle('⏳ Pending Buddy Requests').setColor(COLORS.warning).setTimestamp();
      if (incoming.length) {
        e.addFields({
          name: `Incoming (${incoming.length})`,
          value: incoming.map(p => `From <@${p.user1_id}>${p.relationship_label ? ` (${p.relationship_label})` : ''} — sent <t:${p.requested_at}:R>`).join('\n'),
        });
      }
      if (outgoing.length) {
        e.addFields({
          name: `Outgoing (${outgoing.length})`,
          value: outgoing.map(p => `To <@${p.user2_id}>${p.relationship_label ? ` (${p.relationship_label})` : ''} — sent <t:${p.requested_at}:R>`).join('\n'),
        });
      }
      return interaction.reply({ embeds: [e], ephemeral: true });
    }

    if (sub === 'status') {
      const specific = interaction.options.getUser('user');
      const list = buddies.getActiveBuddies(interaction.user.id, interaction.guildId);
      const filtered = specific ? list.filter(b => b.partner_id === specific.id) : list;
      if (filtered.length === 0) {
        return interaction.reply({ content: 'No matching buddy.', ephemeral: true });
      }
      const weekAgo = Math.floor(Date.now() / 1000) - 604800;
      const e = new EmbedBuilder().setTitle('🤝 Buddy Status (last 7d)').setColor(COLORS.primary).setTimestamp();
      const myCount = db.prepare(
        'SELECT COUNT(*) as count FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(interaction.user.id, interaction.guildId, weekAgo).count;
      e.setDescription(`Your workouts: **${myCount}**`);
      for (const b of filtered) {
        const c = db.prepare(
          'SELECT COUNT(*) as count FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
        ).get(b.partner_id, interaction.guildId, weekAgo).count;
        e.addFields({ name: `<@${b.partner_id}>${b.relationship_label ? ` · ${b.relationship_label}` : ''}`, value: `${c} workouts · since <t:${b.created_at}:R>` });
      }
      return interaction.reply({ embeds: [e], ephemeral: true });
    }

    if (sub === 'remove') {
      const target = interaction.options.getUser('user');
      const changes = buddies.remove(interaction.guildId, interaction.user.id, target.id);
      if (changes === 0) {
        return interaction.reply({ content: `No active buddy partnership with ${target.username}.`, ephemeral: true });
      }
      audit.log(interaction.guildId, interaction.user.id, 'buddy.remove', { target: target.id });
      return interaction.reply({
        embeds: [embed('Partnership Ended', `You and <@${target.id}> are no longer buddies.`, COLORS.warning)],
        ephemeral: true,
      });
    }
  },
};
