const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../services/database');
const { COLORS, progressBar, todayEpoch, embed } = require('../../utils/helpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nutrition')
    .setDescription('Track calories and macros')
    .addSubcommand(sub =>
      sub.setName('log')
        .setDescription('Log food intake')
        .addStringOption(opt =>
          opt.setName('food').setDescription('Food name').setRequired(true))
        .addNumberOption(opt =>
          opt.setName('calories').setDescription('Calories').setRequired(true).setMinValue(0))
        .addNumberOption(opt =>
          opt.setName('protein').setDescription('Protein (g)').setMinValue(0))
        .addNumberOption(opt =>
          opt.setName('carbs').setDescription('Carbs (g)').setMinValue(0))
        .addNumberOption(opt =>
          opt.setName('fat').setDescription('Fat (g)').setMinValue(0))
        .addStringOption(opt =>
          opt.setName('serving').setDescription('Serving size (e.g., "1 cup", "200g")')))
    .addSubcommand(sub =>
      sub.setName('today')
        .setDescription('View today\'s nutrition summary'))
    .addSubcommand(sub =>
      sub.setName('goal')
        .setDescription('Set daily nutrition goals')
        .addNumberOption(opt =>
          opt.setName('calories').setDescription('Daily calorie goal').setRequired(true).setMinValue(500))
        .addNumberOption(opt =>
          opt.setName('protein').setDescription('Daily protein goal (g)').setMinValue(0))
        .addNumberOption(opt =>
          opt.setName('carbs').setDescription('Daily carb goal (g)').setMinValue(0))
        .addNumberOption(opt =>
          opt.setName('fat').setDescription('Daily fat goal (g)').setMinValue(0))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const db = getDb();

    if (sub === 'log') {
      const food = interaction.options.getString('food');
      const calories = interaction.options.getNumber('calories');
      const protein = interaction.options.getNumber('protein') || 0;
      const carbs = interaction.options.getNumber('carbs') || 0;
      const fat = interaction.options.getNumber('fat') || 0;
      const serving = interaction.options.getString('serving') || null;

      db.prepare(
        'INSERT INTO nutrition_logs (user_id, guild_id, food_name, calories, protein, carbs, fat, serving_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(interaction.user.id, interaction.guildId, food, calories, protein, carbs, fat, serving);

      const today = todayEpoch();
      const totals = db.prepare(
        'SELECT COALESCE(SUM(calories),0) as cal, COALESCE(SUM(protein),0) as pro, COALESCE(SUM(carbs),0) as carb, COALESCE(SUM(fat),0) as f FROM nutrition_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(interaction.user.id, interaction.guildId, today);

      const e = new EmbedBuilder()
        .setTitle('🍽️ Food Logged')
        .setDescription(`**${food}**${serving ? ` (${serving})` : ''}`)
        .addFields(
          { name: 'Calories', value: `${calories} kcal`, inline: true },
          { name: 'Protein', value: `${protein}g`, inline: true },
          { name: 'Carbs', value: `${carbs}g`, inline: true },
          { name: 'Fat', value: `${fat}g`, inline: true },
          { name: 'Today\'s Totals', value: `${totals.cal.toFixed(0)} kcal | ${totals.pro.toFixed(0)}g P | ${totals.carb.toFixed(0)}g C | ${totals.f.toFixed(0)}g F` },
        )
        .setColor(COLORS.success)
        .setTimestamp();

      await interaction.reply({ embeds: [e], ephemeral: true });

    } else if (sub === 'today') {
      await interaction.deferReply({ ephemeral: true });
      const today = todayEpoch();

      const entries = db.prepare(
        'SELECT food_name, calories, protein, carbs, fat, serving_size, created_at FROM nutrition_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ? ORDER BY created_at'
      ).all(interaction.user.id, interaction.guildId, today);

      const totals = db.prepare(
        'SELECT COALESCE(SUM(calories),0) as cal, COALESCE(SUM(protein),0) as pro, COALESCE(SUM(carbs),0) as carb, COALESCE(SUM(fat),0) as f FROM nutrition_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(interaction.user.id, interaction.guildId, today);

      const profile = db.prepare(
        'SELECT calorie_goal, protein_goal, carb_goal, fat_goal FROM user_profiles WHERE user_id = ? AND guild_id = ?'
      ).get(interaction.user.id, interaction.guildId);

      const foodList = entries.length > 0
        ? entries.map(e => {
            const time = new Date(e.created_at * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            return `\`${time}\` **${e.food_name}** — ${e.calories} kcal`;
          }).join('\n')
        : 'No food logged today.';

      const e = new EmbedBuilder()
        .setTitle('🍽️ Nutrition — Today')
        .setDescription(foodList)
        .setColor(COLORS.primary)
        .setTimestamp();

      const calGoal = profile?.calorie_goal || 2000;
      e.addFields(
        { name: 'Calories', value: `${totals.cal.toFixed(0)} / ${calGoal} kcal\n${progressBar(totals.cal, calGoal)}`, inline: true },
        { name: 'Protein', value: `${totals.pro.toFixed(0)}g${profile?.protein_goal ? ` / ${profile.protein_goal}g` : ''}`, inline: true },
        { name: 'Carbs', value: `${totals.carb.toFixed(0)}g${profile?.carb_goal ? ` / ${profile.carb_goal}g` : ''}`, inline: true },
        { name: 'Fat', value: `${totals.f.toFixed(0)}g${profile?.fat_goal ? ` / ${profile.fat_goal}g` : ''}`, inline: true },
      );

      await interaction.editReply({ embeds: [e] });

    } else if (sub === 'goal') {
      const calories = interaction.options.getNumber('calories');
      const protein = interaction.options.getNumber('protein');
      const carbs = interaction.options.getNumber('carbs');
      const fat = interaction.options.getNumber('fat');

      db.prepare(`
        INSERT INTO user_profiles (user_id, guild_id, calorie_goal, protein_goal, carb_goal, fat_goal)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, guild_id) DO UPDATE SET
          calorie_goal = excluded.calorie_goal,
          protein_goal = COALESCE(excluded.protein_goal, user_profiles.protein_goal),
          carb_goal = COALESCE(excluded.carb_goal, user_profiles.carb_goal),
          fat_goal = COALESCE(excluded.fat_goal, user_profiles.fat_goal)
      `).run(interaction.user.id, interaction.guildId, calories, protein, carbs, fat);

      const goals = [`**Calories:** ${calories} kcal`];
      if (protein) goals.push(`**Protein:** ${protein}g`);
      if (carbs) goals.push(`**Carbs:** ${carbs}g`);
      if (fat) goals.push(`**Fat:** ${fat}g`);

      await interaction.reply({
        embeds: [embed('🎯 Nutrition Goals Set', goals.join('\n'), COLORS.success)],
        ephemeral: true,
      });
    }
  },
};
