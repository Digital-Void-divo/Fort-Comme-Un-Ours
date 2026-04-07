const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const exercises = require('../../data/exercises');
const { COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('random-workout')
    .setDescription('Generate a random workout')
    .addStringOption(opt =>
      opt.setName('focus').setDescription('Muscle group focus').addChoices(
        { name: 'Full Body', value: 'all' },
        { name: 'Upper Body', value: 'upper' },
        { name: 'Lower Body', value: 'lower' },
        { name: 'Push', value: 'push' },
        { name: 'Pull', value: 'pull' },
        { name: 'Core / Abs', value: 'core' },
      ))
    .addIntegerOption(opt =>
      opt.setName('minutes').setDescription('Target duration in minutes (default 20)').setMinValue(5).setMaxValue(60)),

  async execute(interaction) {
    const focus = interaction.options.getString('focus') || 'all';
    const minutes = interaction.options.getInteger('minutes') || 20;

    const allExercises = Object.entries(exercises);
    let filtered;

    switch (focus) {
      case 'upper':
        filtered = allExercises.filter(([, e]) => ['push', 'pull'].includes(e.category));
        break;
      case 'lower':
        filtered = allExercises.filter(([, e]) => e.category === 'legs');
        break;
      case 'push':
        filtered = allExercises.filter(([, e]) => e.category === 'push');
        break;
      case 'pull':
        filtered = allExercises.filter(([, e]) => e.category === 'pull');
        break;
      case 'core':
        filtered = allExercises.filter(([, e]) => e.category === 'core');
        break;
      default:
        filtered = allExercises;
    }

    // ~3 minutes per exercise (including rest)
    const count = Math.min(Math.max(Math.round(minutes / 3), 3), filtered.length);
    const shuffled = filtered.sort(() => Math.random() - 0.5).slice(0, count);

    const e = new EmbedBuilder()
      .setTitle(`🎲 Random ${focus === 'all' ? 'Full Body' : focus.charAt(0).toUpperCase() + focus.slice(1)} Workout`)
      .setDescription(`~${minutes} minute workout • ${count} exercises`)
      .setColor(COLORS.fire)
      .setTimestamp();

    for (const [name, ex] of shuffled) {
      const title = name.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const sets = ex.equipment === 'bodyweight' ? 3 : Math.floor(Math.random() * 2) + 3;
      const reps = ex.equipment === 'bodyweight'
        ? `${Math.floor(Math.random() * 6 + 10)}-${Math.floor(Math.random() * 6 + 15)}`
        : `${Math.floor(Math.random() * 4 + 6)}-${Math.floor(Math.random() * 4 + 10)}`;

      e.addFields({
        name: title,
        value: `${sets} sets x ${reps} reps\n*${ex.muscles.join(', ')}*`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [e] });
  },
};
