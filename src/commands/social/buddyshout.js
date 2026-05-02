const { SlashCommandBuilder } = require('discord.js');
const buddies = require('../../services/buddyService');
const privacy = require('../../services/privacyService');
const audit = require('../../services/auditService');
const { embed, COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buddyshout')
    .setDescription('Post a message that auto-tags your accountability buddies')
    .addStringOption(opt =>
      opt.setName('message').setDescription('What do you want to say?').setRequired(true).setMaxLength(1500))
    .addStringOption(opt =>
      opt.setName('prefix').setDescription('Override the prefix (default: "Accountability Buddies:")').setMaxLength(60)),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    const prefix = (interaction.options.getString('prefix') || 'Accountability Buddies:').trim();

    const list = buddies.getActiveBuddies(interaction.user.id, interaction.guildId);
    if (list.length === 0) {
      return interaction.reply({
        embeds: [embed('No Buddies Yet',
          'You don\'t have any active accountability buddies to tag. Use `/partner request` first.',
          COLORS.warning)],
        ephemeral: true,
      });
    }

    // Honor each buddy's "tag_in_messages" preference.
    const taggable = [];
    const skipped = [];
    for (const b of list) {
      const settings = privacy.getSettings(b.partner_id, interaction.guildId);
      if (settings.tagInMessages) taggable.push(b.partner_id);
      else skipped.push(b.partner_id);
    }

    if (taggable.length === 0) {
      return interaction.reply({
        embeds: [embed('No Tags Sent',
          'All of your buddies have opted out of being tagged in shout messages.',
          COLORS.warning)],
        ephemeral: true,
      });
    }

    const mentions = taggable.map(id => `<@${id}>`).join(' ');
    const content = `${message}\n\n${prefix} ${mentions}`;

    audit.log(interaction.guildId, interaction.user.id, 'buddyshout', { tagged: taggable.length, skipped: skipped.length });

    await interaction.reply({
      content,
      allowedMentions: { users: taggable },
    });
  },
};
