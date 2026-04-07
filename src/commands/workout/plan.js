const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const workoutPlans = require('../../data/workoutPlans');
const { COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plan')
    .setDescription('Get a workout plan')
    .addStringOption(opt =>
      opt.setName('type').setDescription('Plan type').setRequired(true).addChoices(
        { name: 'Push/Pull/Legs (PPL)', value: 'ppl' },
        { name: 'Upper/Lower Split', value: 'upper_lower' },
        { name: 'Full Body (3-Day)', value: 'full_body' },
        { name: 'Bro Split (5-Day)', value: 'bro_split' },
      )),

  async execute(interaction) {
    await interaction.deferReply();

    const type = interaction.options.getString('type');
    const plan = workoutPlans[type];

    const e = new EmbedBuilder()
      .setTitle(`📋 ${plan.name}`)
      .setDescription(plan.description)
      .setColor(COLORS.primary)
      .setTimestamp();

    for (const [dayName, exercises] of Object.entries(plan.days)) {
      const lines = exercises.map(ex =>
        `• **${ex.exercise}** - ${ex.sets} x ${ex.reps}`
      ).join('\n');
      e.addFields({ name: dayName, value: lines });
    }

    await interaction.editReply({ embeds: [e] });
  },
};
