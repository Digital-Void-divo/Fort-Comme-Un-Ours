const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, embed } = require('../../utils/helpers');
const { registerButton } = require('../../services/buttonHandler');

// Register button handlers
registerButton('join_challenge', async (interaction) => {
  const challengeId = interaction.customId.split('|')[1];
  const db = getDb();

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(challengeId);
  if (!challenge || !challenge.active) {
    return interaction.reply({ content: 'This challenge is no longer active.', ephemeral: true });
  }

  try {
    db.prepare(
      'INSERT INTO challenge_entries (challenge_id, user_id) VALUES (?, ?)'
    ).run(challengeId, interaction.user.id);
    await interaction.reply({ content: `You've joined **${challenge.title}**! Use \`/challenge submit\` to log progress.`, ephemeral: true });
  } catch {
    await interaction.reply({ content: 'You\'re already in this challenge!', ephemeral: true });
  }
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Server fitness challenges')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new challenge')
        .addStringOption(opt =>
          opt.setName('title').setDescription('Challenge title').setRequired(true))
        .addStringOption(opt =>
          opt.setName('type').setDescription('Challenge type').setRequired(true).addChoices(
            { name: 'Total Reps', value: 'reps' },
            { name: 'Total Steps', value: 'steps' },
            { name: 'Total Duration (minutes)', value: 'duration' },
            { name: 'Streak (consecutive days)', value: 'streak' },
          ))
        .addIntegerOption(opt =>
          opt.setName('days').setDescription('Duration in days').setRequired(true).setMinValue(1).setMaxValue(90))
        .addStringOption(opt =>
          opt.setName('exercise').setDescription('Specific exercise (optional)'))
        .addNumberOption(opt =>
          opt.setName('target').setDescription('Target value to hit'))
        .addStringOption(opt =>
          opt.setName('description').setDescription('Challenge description')))
    .addSubcommand(sub =>
      sub.setName('submit')
        .setDescription('Submit progress for an active challenge')
        .addIntegerOption(opt =>
          opt.setName('challenge_id').setDescription('Challenge ID').setRequired(true))
        .addNumberOption(opt =>
          opt.setName('value').setDescription('Value to add').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View active challenges'))
    .addSubcommand(sub =>
      sub.setName('leaderboard')
        .setDescription('View challenge leaderboard')
        .addIntegerOption(opt =>
          opt.setName('challenge_id').setDescription('Challenge ID').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'create') {
      await interaction.deferReply();
      const title = interaction.options.getString('title');
      const type = interaction.options.getString('type');
      const days = interaction.options.getInteger('days');
      const exercise = interaction.options.getString('exercise') || null;
      const target = interaction.options.getNumber('target') || null;
      const description = interaction.options.getString('description') || null;

      const now = Math.floor(Date.now() / 1000);
      const endDate = now + (days * 86400);

      const result = db.prepare(
        'INSERT INTO challenges (guild_id, creator_id, title, description, exercise, challenge_type, target_value, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(interaction.guildId, interaction.user.id, title, description, exercise, type, target, now, endDate);

      const typeLabels = { reps: 'Total Reps', steps: 'Total Steps', duration: 'Total Minutes', streak: 'Streak Days' };

      const e = new EmbedBuilder()
        .setTitle(`🏋️ New Challenge: ${title}`)
        .setDescription(description || 'A new fitness challenge has begun!')
        .addFields(
          { name: 'Type', value: typeLabels[type], inline: true },
          { name: 'Duration', value: `${days} days`, inline: true },
          { name: 'ID', value: `#${result.lastInsertRowid}`, inline: true },
        )
        .setColor(COLORS.fire)
        .setTimestamp();

      if (exercise) e.addFields({ name: 'Exercise', value: exercise, inline: true });
      if (target) e.addFields({ name: 'Target', value: `${target}`, inline: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`join_challenge|${result.lastInsertRowid}`)
          .setLabel('Join Challenge')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🏋️')
      );

      await interaction.editReply({ embeds: [e], components: [row] });

    } else if (sub === 'submit') {
      const challengeId = interaction.options.getInteger('challenge_id');
      const value = interaction.options.getNumber('value');

      const challenge = db.prepare('SELECT * FROM challenges WHERE id = ? AND guild_id = ?').get(challengeId, interaction.guildId);
      if (!challenge || !challenge.active) {
        return interaction.reply({ content: 'Challenge not found or no longer active.', ephemeral: true });
      }

      const entry = db.prepare(
        'SELECT * FROM challenge_entries WHERE challenge_id = ? AND user_id = ?'
      ).get(challengeId, interaction.user.id);

      if (!entry) {
        return interaction.reply({ content: 'You haven\'t joined this challenge. Click the Join button first!', ephemeral: true });
      }

      const newValue = entry.value + value;
      db.prepare(
        'UPDATE challenge_entries SET value = ?, updated_at = strftime(\'%s\',\'now\') WHERE challenge_id = ? AND user_id = ?'
      ).run(newValue, challengeId, interaction.user.id);

      let desc = `Added **${value}** to **${challenge.title}**\nNew total: **${newValue}**`;
      if (challenge.target_value && newValue >= challenge.target_value) {
        desc += '\n\n🎉 **You hit the target!**';
      }

      await interaction.reply({ embeds: [embed('✅ Progress Submitted', desc, COLORS.success)] });

    } else if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const challenges = db.prepare(
        'SELECT c.*, (SELECT COUNT(*) FROM challenge_entries WHERE challenge_id = c.id) as participants FROM challenges c WHERE c.guild_id = ? AND c.active = 1 ORDER BY c.end_date'
      ).all(interaction.guildId);

      if (challenges.length === 0) {
        return interaction.editReply({
          embeds: [embed('Active Challenges', 'No active challenges. Create one with `/challenge create`!', COLORS.warning)]
        });
      }

      const e = new EmbedBuilder()
        .setTitle('🏆 Active Challenges')
        .setColor(COLORS.fire)
        .setTimestamp();

      for (const c of challenges) {
        const endsIn = Math.max(0, Math.ceil((c.end_date - Date.now() / 1000) / 86400));
        e.addFields({
          name: `#${c.id} - ${c.title}`,
          value: `Type: ${c.challenge_type} | ${c.participants} participant(s) | ${endsIn} day(s) left${c.target_value ? ` | Target: ${c.target_value}` : ''}`,
        });
      }

      await interaction.editReply({ embeds: [e] });

    } else if (sub === 'leaderboard') {
      await interaction.deferReply({ ephemeral: true });
      const challengeId = interaction.options.getInteger('challenge_id');

      const challenge = db.prepare('SELECT * FROM challenges WHERE id = ? AND guild_id = ?').get(challengeId, interaction.guildId);
      if (!challenge) {
        return interaction.editReply({ embeds: [embed('Error', 'Challenge not found.', COLORS.error)] });
      }

      const entries = db.prepare(
        'SELECT * FROM challenge_entries WHERE challenge_id = ? ORDER BY value DESC LIMIT 15'
      ).all(challengeId);

      if (entries.length === 0) {
        return interaction.editReply({ embeds: [embed(challenge.title, 'No participants yet!', COLORS.warning)] });
      }

      const medals = ['🥇', '🥈', '🥉'];
      const lines = entries.map((e, i) => {
        const prefix = medals[i] || `\`${i + 1}.\``;
        return `${prefix} <@${e.user_id}> - **${e.value}**`;
      }).join('\n');

      const e = new EmbedBuilder()
        .setTitle(`🏆 Leaderboard: ${challenge.title}`)
        .setDescription(lines)
        .setColor(COLORS.gold)
        .setTimestamp();

      await interaction.editReply({ embeds: [e] });
    }
  },
};
