const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const recipes = require('../../data/recipes');
const { COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recipe')
    .setDescription('Get recipe suggestions filtered by diet or macros')
    .addStringOption(opt =>
      opt.setName('diet').setDescription('Diet filter').addChoices(
        { name: 'High Protein', value: 'high-protein' },
        { name: 'Keto', value: 'keto' },
        { name: 'Vegan', value: 'vegan' },
        { name: 'Vegetarian', value: 'vegetarian' },
        { name: 'Cutting (low cal)', value: 'cutting' },
        { name: 'Bulking (high cal)', value: 'bulking' },
      ))
    .addIntegerOption(opt =>
      opt.setName('max_calories').setDescription('Maximum calories').setMinValue(100))
    .addIntegerOption(opt =>
      opt.setName('min_protein').setDescription('Minimum protein (g)').setMinValue(1)),

  async execute(interaction) {
    const diet = interaction.options.getString('diet');
    const maxCal = interaction.options.getInteger('max_calories');
    const minProtein = interaction.options.getInteger('min_protein');

    let filtered = [...recipes];

    if (diet) filtered = filtered.filter(r => r.diet.includes(diet));
    if (maxCal) filtered = filtered.filter(r => r.calories <= maxCal);
    if (minProtein) filtered = filtered.filter(r => r.protein >= minProtein);

    if (filtered.length === 0) {
      return interaction.reply({ content: 'No recipes match your filters. Try broader criteria!', ephemeral: true });
    }

    // Pick a random one
    const recipe = filtered[Math.floor(Math.random() * filtered.length)];

    const e = new EmbedBuilder()
      .setTitle(`🍳 ${recipe.name}`)
      .addFields(
        { name: 'Calories', value: `${recipe.calories} kcal`, inline: true },
        { name: 'Protein', value: `${recipe.protein}g`, inline: true },
        { name: 'Carbs', value: `${recipe.carbs}g`, inline: true },
        { name: 'Fat', value: `${recipe.fat}g`, inline: true },
        { name: 'Diet Tags', value: recipe.diet.join(', '), inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '🛒 Ingredients', value: recipe.ingredients.map(i => `• ${i}`).join('\n') },
        { name: '📝 Instructions', value: recipe.instructions },
      )
      .setColor(COLORS.success)
      .setFooter({ text: `${filtered.length} recipe(s) matched your filters. Run again for another!` })
      .setTimestamp();

    await interaction.reply({ embeds: [e] });
  },
};
