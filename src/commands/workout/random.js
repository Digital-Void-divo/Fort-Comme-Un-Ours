const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const exercises = require('../../data/exercises');
const { COLORS } = require('../../utils/helpers');

// Structured slot templates for coherent workouts
const TEMPLATES = {
  all: [
    { label: 'Compound Lower', filter: e => e.category === 'legs' && ['barbell', 'bodyweight'].includes(e.equipment) },
    { label: 'Compound Upper Push', filter: e => e.category === 'push' && ['barbell', 'bodyweight'].includes(e.equipment) },
    { label: 'Compound Upper Pull', filter: e => e.category === 'pull' && ['barbell', 'bodyweight'].includes(e.equipment) },
    { label: 'Accessory Push', filter: e => e.category === 'push' },
    { label: 'Accessory Pull', filter: e => e.category === 'pull' },
    { label: 'Core Finisher', filter: e => e.category === 'core' },
  ],
  upper: [
    { label: 'Compound Push', filter: e => e.category === 'push' && ['barbell', 'bodyweight'].includes(e.equipment) },
    { label: 'Compound Pull', filter: e => e.category === 'pull' && ['barbell', 'bodyweight'].includes(e.equipment) },
    { label: 'Shoulder', filter: e => e.category === 'push' && e.muscles.some(m => m.includes('Delt') || m.includes('Shoulder')) },
    { label: 'Accessory Push', filter: e => e.category === 'push' },
    { label: 'Accessory Pull', filter: e => e.category === 'pull' },
    { label: 'Core', filter: e => e.category === 'core' },
  ],
  lower: [
    { label: 'Compound Quad', filter: e => e.category === 'legs' && e.muscles.some(m => m.includes('Quad') || m.includes('Glute')) },
    { label: 'Compound Hinge', filter: e => e.category === 'legs' || (e.category === 'pull' && e.muscles.some(m => m.includes('Hamstring'))) },
    { label: 'Unilateral', filter: e => e.category === 'legs' && e.equipment !== 'machine' },
    { label: 'Isolation', filter: e => e.category === 'legs' && e.equipment === 'machine' },
    { label: 'Calves', filter: e => e.muscles.some(m => m.includes('Calv')) },
    { label: 'Core', filter: e => e.category === 'core' },
  ],
  push: [
    { label: 'Compound Press', filter: e => e.category === 'push' && e.equipment === 'barbell' },
    { label: 'Incline/Overhead', filter: e => e.category === 'push' && e.muscles.some(m => m.includes('Upper') || m.includes('Shoulder')) },
    { label: 'Fly/Isolation', filter: e => e.category === 'push' && ['cable', 'dumbbell'].includes(e.equipment) },
    { label: 'Lateral Work', filter: e => e.muscles.some(m => m.includes('Delt')) },
    { label: 'Triceps', filter: e => e.muscles.some(m => m.includes('Tricep')) },
  ],
  pull: [
    { label: 'Compound Pull', filter: e => e.category === 'pull' && ['barbell', 'bodyweight'].includes(e.equipment) },
    { label: 'Horizontal Pull', filter: e => e.category === 'pull' && e.muscles.some(m => m.includes('Back') || m.includes('Rear')) },
    { label: 'Vertical Pull', filter: e => e.category === 'pull' && e.muscles.some(m => m.includes('Lat')) },
    { label: 'Rear Delts', filter: e => e.muscles.some(m => m.includes('Rear')) },
    { label: 'Biceps', filter: e => e.muscles.some(m => m.includes('Bicep')) },
  ],
  core: [
    { label: 'Anti-Extension', filter: e => e.category === 'core' && e.muscles.some(m => m.includes('Abs') || m.includes('Core')) },
    { label: 'Rotation', filter: e => e.category === 'core' && e.muscles.some(m => m.includes('Oblique')) },
    { label: 'Hip Flexion', filter: e => e.category === 'core' },
    { label: 'Stability', filter: e => e.category === 'core' && e.equipment === 'bodyweight' },
  ],
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('random-workout')
    .setDescription('Generate a structured random workout')
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
      opt.setName('minutes').setDescription('Target duration in minutes (default 30)').setMinValue(10).setMaxValue(60)),

  async execute(interaction) {
    const focus = interaction.options.getString('focus') || 'all';
    const minutes = interaction.options.getInteger('minutes') || 30;

    const allExercises = Object.entries(exercises);
    const template = TEMPLATES[focus] || TEMPLATES.all;

    // Scale exercise count to time (~4 min per exercise including rest)
    const count = Math.min(Math.max(Math.round(minutes / 4), 3), template.length);
    const slots = template.slice(0, count);

    const used = new Set();
    const selected = [];

    for (const slot of slots) {
      const candidates = allExercises.filter(([name, e]) => slot.filter(e) && !used.has(name));
      if (candidates.length === 0) continue;
      const [name, ex] = pickRandom(candidates);
      used.add(name);
      selected.push({ name, ex, slot: slot.label });
    }

    if (selected.length === 0) {
      return interaction.reply({ content: 'Could not generate a workout for that focus. Try a different option.', ephemeral: true });
    }

    const focusLabel = {
      all: 'Full Body', upper: 'Upper Body', lower: 'Lower Body',
      push: 'Push', pull: 'Pull', core: 'Core',
    }[focus];

    const e = new EmbedBuilder()
      .setTitle(`🎲 ${focusLabel} Workout`)
      .setDescription(`~${minutes} min · ${selected.length} exercises · structured for balance`)
      .setColor(COLORS.fire)
      .setTimestamp();

    for (const { name, ex, slot } of selected) {
      const title = name.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const isBodyweight = ex.equipment === 'bodyweight';
      const sets = isBodyweight ? 3 : Math.floor(Math.random() * 2) + 3;
      const reps = isBodyweight ? '10-15' : `${Math.floor(Math.random() * 3) + 6}-${Math.floor(Math.random() * 3) + 9}`;

      e.addFields({
        name: `${title}  ·  ${slot}`,
        value: `${sets} sets x ${reps} reps\n*${ex.muscles.join(', ')}* · ${ex.equipment}`,
        inline: true,
      });
    }

    e.setFooter({ text: 'Tip: Use /exercise <name> for form tips on any exercise' });

    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
