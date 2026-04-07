const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Accountability partner system')
    .addSubcommand(sub =>
      sub.setName('request')
        .setDescription('Request an accountability partner')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to partner with').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('View your accountability partner'))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove your accountability partner')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'request') {
      const target = interaction.options.getUser('user');

      if (target.id === interaction.user.id) {
        return interaction.reply({ content: 'You can\'t partner with yourself!', ephemeral: true });
      }

      if (target.bot) {
        return interaction.reply({ content: 'You can\'t partner with a bot!', ephemeral: true });
      }

      // Check if either user already has a partner
      const existing = db.prepare(
        'SELECT * FROM accountability_pairs WHERE guild_id = ? AND (user1_id = ? OR user2_id = ? OR user1_id = ? OR user2_id = ?) AND active = 1'
      ).get(interaction.guildId, interaction.user.id, interaction.user.id, target.id, target.id);

      if (existing) {
        return interaction.reply({ content: 'One of you already has an active accountability partner in this server.', ephemeral: true });
      }

      try {
        db.prepare(
          'INSERT INTO accountability_pairs (guild_id, user1_id, user2_id) VALUES (?, ?, ?)'
        ).run(interaction.guildId, interaction.user.id, target.id);
      } catch {
        return interaction.reply({ content: 'Partnership already exists.', ephemeral: true });
      }

      await interaction.reply({
        embeds: [embed(
          '🤝 Accountability Partnership',
          `<@${interaction.user.id}> and <@${target.id}> are now accountability partners!\n\nYou'll be notified when your partner logs a workout. Stay consistent together!`,
          COLORS.success
        )]
      });

    } else if (sub === 'status') {
      const pair = db.prepare(
        'SELECT * FROM accountability_pairs WHERE guild_id = ? AND (user1_id = ? OR user2_id = ?) AND active = 1'
      ).get(interaction.guildId, interaction.user.id, interaction.user.id);

      if (!pair) {
        return interaction.reply({
          embeds: [embed('Accountability Partner', 'You don\'t have a partner yet. Use `/partner request` to find one!', COLORS.warning)],
          ephemeral: true,
        });
      }

      const partnerId = pair.user1_id === interaction.user.id ? pair.user2_id : pair.user1_id;

      // Get partner's recent activity
      const weekAgo = Math.floor(Date.now() / 1000) - 604800;
      const partnerWorkouts = db.prepare(
        'SELECT COUNT(*) as count FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(partnerId, interaction.guildId, weekAgo);

      const myWorkouts = db.prepare(
        'SELECT COUNT(*) as count FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(interaction.user.id, interaction.guildId, weekAgo);

      const e = new EmbedBuilder()
        .setTitle('🤝 Accountability Partnership')
        .addFields(
          { name: 'Your Partner', value: `<@${partnerId}>` },
          { name: 'Your Workouts (7d)', value: `${myWorkouts.count}`, inline: true },
          { name: 'Partner\'s Workouts (7d)', value: `${partnerWorkouts.count}`, inline: true },
          { name: 'Since', value: `<t:${pair.created_at}:R>`, inline: true },
        )
        .setColor(COLORS.primary)
        .setTimestamp();

      await interaction.reply({ embeds: [e], ephemeral: true });

    } else if (sub === 'remove') {
      const result = db.prepare(
        'UPDATE accountability_pairs SET active = 0 WHERE guild_id = ? AND (user1_id = ? OR user2_id = ?) AND active = 1'
      ).run(interaction.guildId, interaction.user.id, interaction.user.id);

      if (result.changes === 0) {
        return interaction.reply({ content: 'No active partnership found.', ephemeral: true });
      }

      await interaction.reply({
        embeds: [embed('Partnership Ended', 'Your accountability partnership has been dissolved.', COLORS.warning)],
        ephemeral: true,
      });
    }
  },
};
