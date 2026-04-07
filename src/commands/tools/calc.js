const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('calc')
    .setDescription('Fitness calculators')
    .addSubcommand(sub =>
      sub.setName('bmi')
        .setDescription('Calculate BMI')
        .addNumberOption(opt =>
          opt.setName('weight').setDescription('Weight').setRequired(true).setMinValue(1))
        .addNumberOption(opt =>
          opt.setName('height').setDescription('Height in cm (or inches if imperial)').setRequired(true).setMinValue(1))
        .addStringOption(opt =>
          opt.setName('unit').setDescription('Unit system').addChoices(
            { name: 'Imperial (lbs, inches)', value: 'imperial' },
            { name: 'Metric (kg, cm)', value: 'metric' },
          )))
    .addSubcommand(sub =>
      sub.setName('tdee')
        .setDescription('Calculate TDEE (Total Daily Energy Expenditure)')
        .addNumberOption(opt =>
          opt.setName('weight').setDescription('Weight').setRequired(true).setMinValue(1))
        .addNumberOption(opt =>
          opt.setName('height').setDescription('Height in cm (or inches if imperial)').setRequired(true).setMinValue(1))
        .addIntegerOption(opt =>
          opt.setName('age').setDescription('Age in years').setRequired(true).setMinValue(10).setMaxValue(120))
        .addStringOption(opt =>
          opt.setName('gender').setDescription('Biological sex').setRequired(true).addChoices(
            { name: 'Male', value: 'male' },
            { name: 'Female', value: 'female' },
          ))
        .addStringOption(opt =>
          opt.setName('activity').setDescription('Activity level').setRequired(true).addChoices(
            { name: 'Sedentary (desk job)', value: 'sedentary' },
            { name: 'Light (1-3 days/week)', value: 'light' },
            { name: 'Moderate (3-5 days/week)', value: 'moderate' },
            { name: 'Active (6-7 days/week)', value: 'active' },
            { name: 'Very Active (2x/day)', value: 'very_active' },
          ))
        .addStringOption(opt =>
          opt.setName('unit').setDescription('Unit system').addChoices(
            { name: 'Imperial (lbs, inches)', value: 'imperial' },
            { name: 'Metric (kg, cm)', value: 'metric' },
          )))
    .addSubcommand(sub =>
      sub.setName('1rm')
        .setDescription('Calculate estimated 1 Rep Max')
        .addNumberOption(opt =>
          opt.setName('weight').setDescription('Weight lifted').setRequired(true).setMinValue(1))
        .addIntegerOption(opt =>
          opt.setName('reps').setDescription('Reps performed').setRequired(true).setMinValue(1).setMaxValue(30))
        .addStringOption(opt =>
          opt.setName('unit').setDescription('Weight unit').addChoices(
            { name: 'lbs', value: 'lbs' },
            { name: 'kg', value: 'kg' },
          ))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'bmi') {
      const weight = interaction.options.getNumber('weight');
      const height = interaction.options.getNumber('height');
      const unit = interaction.options.getString('unit') || 'imperial';

      let weightKg = unit === 'imperial' ? weight * 0.453592 : weight;
      let heightM = unit === 'imperial' ? height * 0.0254 : height / 100;

      const bmi = weightKg / (heightM * heightM);
      let category, color;
      if (bmi < 18.5) { category = 'Underweight'; color = COLORS.warning; }
      else if (bmi < 25) { category = 'Normal'; color = COLORS.success; }
      else if (bmi < 30) { category = 'Overweight'; color = COLORS.warning; }
      else { category = 'Obese'; color = COLORS.error; }

      const e = new EmbedBuilder()
        .setTitle('📊 BMI Calculator')
        .addFields(
          { name: 'BMI', value: `**${bmi.toFixed(1)}**`, inline: true },
          { name: 'Category', value: category, inline: true },
          { name: 'Input', value: `${weight} ${unit === 'imperial' ? 'lbs' : 'kg'}, ${height} ${unit === 'imperial' ? 'in' : 'cm'}`, inline: true },
        )
        .setFooter({ text: 'Note: BMI does not account for muscle mass and is a rough indicator only.' })
        .setColor(color)
        .setTimestamp();

      await interaction.reply({ embeds: [e] });

    } else if (sub === 'tdee') {
      const weight = interaction.options.getNumber('weight');
      const height = interaction.options.getNumber('height');
      const age = interaction.options.getInteger('age');
      const gender = interaction.options.getString('gender');
      const activity = interaction.options.getString('activity');
      const unit = interaction.options.getString('unit') || 'imperial';

      let weightKg = unit === 'imperial' ? weight * 0.453592 : weight;
      let heightCm = unit === 'imperial' ? height * 2.54 : height;

      // Mifflin-St Jeor equation
      let bmr;
      if (gender === 'male') {
        bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
      } else {
        bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
      }

      const multipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        very_active: 1.9,
      };

      const tdee = bmr * multipliers[activity];

      const e = new EmbedBuilder()
        .setTitle('🔥 TDEE Calculator')
        .addFields(
          { name: 'BMR', value: `${Math.round(bmr)} kcal/day`, inline: true },
          { name: 'TDEE', value: `**${Math.round(tdee)} kcal/day**`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: 'Cut (-500)', value: `${Math.round(tdee - 500)} kcal/day`, inline: true },
          { name: 'Maintain', value: `${Math.round(tdee)} kcal/day`, inline: true },
          { name: 'Bulk (+500)', value: `${Math.round(tdee + 500)} kcal/day`, inline: true },
        )
        .addFields(
          { name: 'Suggested Protein', value: `${Math.round(weightKg * 1.6)}–${Math.round(weightKg * 2.2)}g/day` },
        )
        .setColor(COLORS.fire)
        .setTimestamp();

      await interaction.reply({ embeds: [e] });

    } else if (sub === '1rm') {
      const weight = interaction.options.getNumber('weight');
      const reps = interaction.options.getInteger('reps');
      const unit = interaction.options.getString('unit') || 'lbs';

      // Epley formula
      const oneRM = reps === 1 ? weight : weight * (1 + reps / 30);

      const e = new EmbedBuilder()
        .setTitle('💪 1RM Calculator')
        .setDescription(`Based on **${weight} ${unit}** x **${reps} reps**`)
        .addFields(
          { name: 'Estimated 1RM', value: `**${Math.round(oneRM)} ${unit}**`, inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          { name: '95% (2 reps)', value: `${Math.round(oneRM * 0.95)} ${unit}`, inline: true },
          { name: '90% (3 reps)', value: `${Math.round(oneRM * 0.90)} ${unit}`, inline: true },
          { name: '85% (5 reps)', value: `${Math.round(oneRM * 0.85)} ${unit}`, inline: true },
          { name: '80% (6-8 reps)', value: `${Math.round(oneRM * 0.80)} ${unit}`, inline: true },
          { name: '75% (8-10 reps)', value: `${Math.round(oneRM * 0.75)} ${unit}`, inline: true },
          { name: '70% (10-12 reps)', value: `${Math.round(oneRM * 0.70)} ${unit}`, inline: true },
        )
        .setFooter({ text: 'Estimated using Epley formula. Actual 1RM may vary.' })
        .setColor(COLORS.muscle)
        .setTimestamp();

      await interaction.reply({ embeds: [e] });
    }
  },
};
