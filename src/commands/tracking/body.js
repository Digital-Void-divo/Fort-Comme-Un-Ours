const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed, publishButton } = require('../../utils/helpers');
const { cacheEmbed } = require('../../services/buttonHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('body')
    .setDescription('Track body measurements')
    .addSubcommand(sub =>
      sub.setName('log')
        .setDescription('Log a body measurement')
        .addStringOption(opt =>
          opt.setName('type').setDescription('Measurement type').setRequired(true).addChoices(
            { name: 'Body Weight', value: 'weight' },
            { name: 'Chest', value: 'chest' },
            { name: 'Waist', value: 'waist' },
            { name: 'Hips', value: 'hips' },
            { name: 'Arms', value: 'arms' },
            { name: 'Thighs', value: 'thighs' },
          ))
        .addNumberOption(opt =>
          opt.setName('value').setDescription('Measurement value').setRequired(true))
        .addStringOption(opt =>
          opt.setName('unit').setDescription('Unit').addChoices(
            { name: 'lbs', value: 'lbs' },
            { name: 'kg', value: 'kg' },
            { name: 'inches', value: 'in' },
            { name: 'cm', value: 'cm' },
          )))
    .addSubcommand(sub =>
      sub.setName('progress')
        .setDescription('View body measurement progress')
        .addStringOption(opt =>
          opt.setName('type').setDescription('Measurement type').setRequired(true).addChoices(
            { name: 'Body Weight', value: 'weight' },
            { name: 'Chest', value: 'chest' },
            { name: 'Waist', value: 'waist' },
            { name: 'Hips', value: 'hips' },
            { name: 'Arms', value: 'arms' },
            { name: 'Thighs', value: 'thighs' },
          ))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'log') {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.options.getString('type');
      const value = interaction.options.getNumber('value');
      const unit = interaction.options.getString('unit') || (type === 'weight' ? 'lbs' : 'in');

      const db = getDb();
      db.prepare(
        'INSERT INTO body_stats (user_id, guild_id, type, value, unit) VALUES (?, ?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, type, value, unit);

      // Get previous entry for comparison
      const prev = db.prepare(
        'SELECT value, unit FROM body_stats WHERE user_id = ? AND guild_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1 OFFSET 1'
      ).get(interaction.user.id, interaction.guildId, type);

      let change = '';
      if (prev) {
        const diff = value - prev.value;
        const sign = diff > 0 ? '+' : '';
        change = `\n**Change:** ${sign}${diff.toFixed(1)} ${unit} from last entry`;
      }

      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      const logEmbed = embed(`${typeLabel} Logged`, `**${typeLabel}:** ${value} ${unit}${change}`, COLORS.success);
      const key = `body|${interaction.user.id}|${Date.now()}`;
      cacheEmbed(key, [logEmbed], interaction.guildId);
      await interaction.editReply({
        embeds: [logEmbed],
        components: [publishButton(key)],
      });

    } else if (sub === 'progress') {
      await interaction.deferReply({ ephemeral: true });
      const type = interaction.options.getString('type');
      const db = getDb();

      const entries = db.prepare(
        'SELECT value, unit, created_at FROM body_stats WHERE user_id = ? AND guild_id = ? AND type = ? ORDER BY created_at DESC LIMIT 20'
      ).all(interaction.user.id, interaction.guildId, type);

      if (entries.length === 0) {
        return interaction.editReply({
          embeds: [embed('No Data', `No ${type} measurements found. Use \`/body log\` to start tracking!`, COLORS.warning)]
        });
      }

      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      const latest = entries[0];
      const oldest = entries[entries.length - 1];
      const totalChange = latest.value - oldest.value;
      const sign = totalChange > 0 ? '+' : '';

      // Create text-based chart
      const maxVal = Math.max(...entries.map(e => e.value));
      const minVal = Math.min(...entries.map(e => e.value));
      const range = maxVal - minVal || 1;

      const chart = entries.slice().reverse().map(e => {
        const date = new Date(e.created_at * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const barLen = Math.round(((e.value - minVal) / range) * 15) + 1;
        return `\`${date.padStart(6)}\` ${'█'.repeat(barLen)} ${e.value} ${e.unit}`;
      }).join('\n');

      const e = new EmbedBuilder()
        .setTitle(`📊 ${typeLabel} Progress`)
        .setDescription(chart)
        .addFields(
          { name: 'Current', value: `${latest.value} ${latest.unit}`, inline: true },
          { name: 'Starting', value: `${oldest.value} ${oldest.unit}`, inline: true },
          { name: 'Total Change', value: `${sign}${totalChange.toFixed(1)} ${latest.unit}`, inline: true },
        )
        .setColor(COLORS.primary)
        .setTimestamp();

      const pKey = `bodyp|${interaction.user.id}|${Date.now()}`;
      cacheEmbed(pKey, [e], interaction.guildId);
      await interaction.editReply({ embeds: [e], components: [publishButton(pKey)] });
    }
  },
};
