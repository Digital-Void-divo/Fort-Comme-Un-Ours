const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const exercises = require('../../data/exercises');
const { COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('exercise')
    .setDescription('Look up an exercise with form tips and muscle groups')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Exercise name').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const matches = Object.keys(exercises)
      .filter(e => e.includes(focused))
      .slice(0, 25)
      .map(e => ({ name: e.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), value: e }));
    await interaction.respond(matches);
  },

  async execute(interaction) {
    const name = interaction.options.getString('name').toLowerCase().trim();
    const ex = exercises[name];

    if (!ex) {
      return interaction.reply({
        content: `Exercise **${name}** not found in the library. Try using autocomplete!`,
        ephemeral: true,
      });
    }

    const title = name.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    const e = new EmbedBuilder()
      .setTitle(`📖 ${title}`)
      .setColor(COLORS.muscle)
      .addFields(
        { name: '💪 Muscles Targeted', value: ex.muscles.join(', '), inline: true },
        { name: '🏷️ Category', value: ex.category.toUpperCase(), inline: true },
        { name: '🔧 Equipment', value: ex.equipment.charAt(0).toUpperCase() + ex.equipment.slice(1), inline: true },
        { name: '📝 Form Tips', value: ex.tips.map((t, i) => `${i + 1}. ${t}`).join('\n') },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [e] });
  },
};
