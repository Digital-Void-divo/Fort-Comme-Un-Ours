const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../utils/helpers');

const CONVERSIONS = {
  // Weight
  lbs_kg:  { from: 'lbs', to: 'kg', factor: 0.453592, category: 'Weight' },
  kg_lbs:  { from: 'kg', to: 'lbs', factor: 2.20462, category: 'Weight' },
  // Distance
  mi_km:   { from: 'mi', to: 'km', factor: 1.60934, category: 'Distance' },
  km_mi:   { from: 'km', to: 'mi', factor: 0.621371, category: 'Distance' },
  // Height
  in_cm:   { from: 'in', to: 'cm', factor: 2.54, category: 'Height' },
  cm_in:   { from: 'cm', to: 'in', factor: 0.393701, category: 'Height' },
  ft_cm:   { from: 'ft', to: 'cm', factor: 30.48, category: 'Height' },
  cm_ft:   { from: 'cm', to: 'ft', factor: 0.0328084, category: 'Height' },
  // Volume
  oz_ml:   { from: 'oz', to: 'ml', factor: 29.5735, category: 'Volume' },
  ml_oz:   { from: 'ml', to: 'oz', factor: 0.033814, category: 'Volume' },
  cups_ml: { from: 'cups', to: 'ml', factor: 236.588, category: 'Volume' },
  ml_cups: { from: 'ml', to: 'cups', factor: 0.00422675, category: 'Volume' },
  gal_l:   { from: 'gal', to: 'L', factor: 3.78541, category: 'Volume' },
  l_gal:   { from: 'L', to: 'gal', factor: 0.264172, category: 'Volume' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('convert')
    .setDescription('Convert fitness units (weight, distance, height, volume)')
    .addNumberOption(opt =>
      opt.setName('value').setDescription('Value to convert').setRequired(true))
    .addStringOption(opt =>
      opt.setName('from').setDescription('Convert from').setRequired(true).addChoices(
        { name: 'lbs (pounds)', value: 'lbs' },
        { name: 'kg (kilograms)', value: 'kg' },
        { name: 'mi (miles)', value: 'mi' },
        { name: 'km (kilometers)', value: 'km' },
        { name: 'in (inches)', value: 'in' },
        { name: 'cm (centimeters)', value: 'cm' },
        { name: 'ft (feet)', value: 'ft' },
        { name: 'oz (fluid ounces)', value: 'oz' },
        { name: 'ml (milliliters)', value: 'ml' },
        { name: 'cups', value: 'cups' },
        { name: 'gal (gallons)', value: 'gal' },
        { name: 'L (liters)', value: 'L' },
      )),

  async execute(interaction) {
    const value = interaction.options.getNumber('value');
    const from = interaction.options.getString('from');

    // Find all valid conversions from this unit
    const results = [];
    for (const [, conv] of Object.entries(CONVERSIONS)) {
      if (conv.from === from) {
        const converted = value * conv.factor;
        results.push({
          to: conv.to,
          value: converted,
          category: conv.category,
        });
      }
    }

    if (results.length === 0) {
      return interaction.reply({ content: `No conversions available from **${from}**.`, ephemeral: true });
    }

    const lines = results.map(r =>
      `**${r.value < 0.01 ? r.value.toExponential(2) : r.value.toFixed(2)} ${r.to}**`
    ).join('\n');

    const e = new EmbedBuilder()
      .setTitle(`🔄 ${value} ${from}`)
      .setDescription(lines)
      .setColor(COLORS.primary)
      .setFooter({ text: results[0].category })
      .setTimestamp();

    // Add common plate math for weight conversions
    if (from === 'lbs' || from === 'kg') {
      const weightLbs = from === 'lbs' ? value : value * 2.20462;
      if (weightLbs >= 45) {
        const perSide = (weightLbs - 45) / 2;
        const plates = [];
        let remaining = perSide;
        for (const plate of [45, 35, 25, 10, 5, 2.5]) {
          while (remaining >= plate) {
            plates.push(plate);
            remaining -= plate;
          }
        }
        if (plates.length > 0) {
          e.addFields({
            name: '🏋️ Plate Math (per side, 45lb bar)',
            value: plates.map(p => `${p}lb`).join(' + ') + (remaining > 0.1 ? ` (+${remaining.toFixed(1)}lb unloaded)` : ''),
          });
        }
      }
    }

    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
