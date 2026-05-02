const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const audit = require('../../services/auditService');
const privacy = require('../../services/privacyService');
const { embed, COLORS } = require('../../utils/helpers');

const MOOD_LABELS = {
  1: '😩 Awful',
  2: '😐 Meh',
  3: '🙂 OK',
  4: '💪 Good',
  5: '🔥 Great',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mood')
    .setDescription('Log your mood / energy')
    .addSubcommand(sub =>
      sub.setName('log').setDescription('Log a mood entry')
        .addIntegerOption(opt => opt.setName('rating').setDescription('1 (awful) to 5 (great)').setRequired(true).setMinValue(1).setMaxValue(5))
        .addIntegerOption(opt => opt.setName('energy').setDescription('Energy 1-10'))
        .addStringOption(opt => opt.setName('notes').setDescription('What\'s going on?').setMaxLength(300)))
    .addSubcommand(sub =>
      sub.setName('history').setDescription('See recent mood entries')
        .addUserOption(opt => opt.setName('user').setDescription('Whose history?'))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'log') {
      const rating = interaction.options.getInteger('rating');
      const energy = interaction.options.getInteger('energy');
      const notes = interaction.options.getString('notes') || null;

      db.prepare(
        'INSERT INTO metric_logs (user_id, guild_id, metric_key, value, unit, notes) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, 'mood', rating, '1-5', notes);
      if (energy != null) {
        db.prepare(
          'INSERT INTO metric_logs (user_id, guild_id, metric_key, value, unit) VALUES (?, ?, ?, ?, ?)'
        ).run(interaction.user.id, interaction.guildId, 'energy', energy, '1-10');
      }
      audit.log(interaction.guildId, interaction.user.id, 'mood.log', { rating, energy });

      return interaction.reply({
        embeds: [embed('Mood Logged',
          `${MOOD_LABELS[rating]}${energy ? ` · Energy ${energy}/10` : ''}${notes ? `\n${notes}` : ''}`,
          COLORS.primary)],
        ephemeral: true,
      });
    }

    if (sub === 'history') {
      const target = interaction.options.getUser('user') || interaction.user;
      if (!privacy.canViewer(interaction.user.id, target.id, interaction.guildId, 'metrics')) {
        return interaction.reply({ content: privacy.denyMessage(), ephemeral: true });
      }
      const rows = db.prepare(
        `SELECT * FROM metric_logs
          WHERE user_id = ? AND guild_id = ? AND metric_key = 'mood'
          ORDER BY recorded_at DESC LIMIT 10`
      ).all(target.id, interaction.guildId);
      if (rows.length === 0) {
        return interaction.reply({ content: `${target.displayName} hasn't logged any mood entries.`, ephemeral: true });
      }
      const e = new EmbedBuilder()
        .setTitle(`Mood History — ${target.displayName}`)
        .setColor(COLORS.primary).setTimestamp();
      for (const r of rows) {
        const date = new Date(r.recorded_at * 1000).toLocaleDateString();
        e.addFields({ name: date, value: `${MOOD_LABELS[r.value] || r.value}${r.notes ? ` — ${r.notes}` : ''}`, inline: true });
      }
      return interaction.reply({ embeds: [e], ephemeral: true });
    }
  },
};
