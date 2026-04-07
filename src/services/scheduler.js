const cron = require('node-cron');
const { getDb } = require('./database');
const { safeDM, embed, COLORS } = require('../utils/helpers');

const jobs = [];

function loadScheduledJobs(client) {
  // Motivational quote of the day at 8 AM UTC
  jobs.push(cron.schedule('0 8 * * *', () => sendMotivationalQuote(client)));

  // Check for water reminders every 2 hours
  jobs.push(cron.schedule('0 */2 * * *', () => sendWaterReminders(client)));

  // Process custom reminders every minute
  jobs.push(cron.schedule('* * * * *', () => processCustomReminders(client)));

  // End expired challenges daily
  jobs.push(cron.schedule('0 0 * * *', () => endExpiredChallenges(client)));

  // Weekly summary on Sunday at 9 AM UTC
  jobs.push(cron.schedule('0 9 * * 0', () => sendWeeklySummaries(client)));

  console.log('Scheduled jobs loaded');

  // Process anything that expired while offline
  endExpiredChallenges(client);
}

async function sendMotivationalQuote(client) {
  const quotes = require('../data/quotes');
  const quote = quotes[Math.floor(Math.random() * quotes.length)];
  const db = getDb();
  const guilds = client.guilds.cache;

  for (const [, guild] of guilds) {
    const channels = guild.channels.cache.filter(
      ch => ch.isTextBased() && ch.name.includes('fitness') || ch.name.includes('motivation')
    );
    const channel = channels.first();
    if (channel) {
      try {
        await channel.send({ embeds: [embed('Quote of the Day', `*"${quote.text}"*\n\n— ${quote.author}`, COLORS.gold)] });
      } catch {}
    }
  }
}

async function sendWaterReminders(client) {
  const db = getDb();
  const reminders = db.prepare(
    "SELECT DISTINCT user_id, guild_id, channel_id FROM reminders WHERE reminder_type = 'water' AND active = 1"
  ).all();

  for (const r of reminders) {
    try {
      const guild = await client.guilds.fetch(r.guild_id);
      const channel = await guild.channels.fetch(r.channel_id);
      await channel.send(`<@${r.user_id}> Don't forget to drink water! Use \`/water add\` to log your intake.`);
    } catch {}
  }
}

async function processCustomReminders(client) {
  const db = getDb();
  const reminders = db.prepare(
    "SELECT * FROM reminders WHERE reminder_type = 'workout' AND active = 1"
  ).all();

  const now = new Date();
  for (const r of reminders) {
    if (cron.validate(r.cron_expression)) {
      const task = cron.schedule(r.cron_expression, async () => {
        try {
          const guild = await client.guilds.fetch(r.guild_id);
          const channel = await guild.channels.fetch(r.channel_id);
          const msg = r.message || 'Time for your workout!';
          await channel.send(`<@${r.user_id}> ${msg}`);
        } catch {}
        task.stop();
      });
    }
  }
}

async function endExpiredChallenges(client) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const expired = db.prepare(
    'SELECT * FROM challenges WHERE active = 1 AND end_date <= ?'
  ).all(now);

  for (const challenge of expired) {
    db.prepare('UPDATE challenges SET active = 0 WHERE id = ?').run(challenge.id);

    const entries = db.prepare(
      'SELECT * FROM challenge_entries WHERE challenge_id = ? ORDER BY value DESC LIMIT 3'
    ).all(challenge.id);

    if (entries.length > 0) {
      try {
        const guild = await client.guilds.fetch(challenge.guild_id);
        const channels = guild.channels.cache.filter(ch => ch.isTextBased());
        const channel = channels.first();
        if (channel) {
          const medals = ['first_place', 'second_place', 'third_place'];
          let results = entries.map((e, i) => `:${medals[i] || 'medal'}: <@${e.user_id}> — ${e.value}`).join('\n');
          await channel.send({
            embeds: [embed(`Challenge Complete: ${challenge.title}`, `Results:\n${results}`, COLORS.gold)]
          });
        }
      } catch {}
    }
  }
}

async function sendWeeklySummaries(client) {
  const db = getDb();
  const weekAgo = Math.floor(Date.now() / 1000) - 604800;

  const users = db.prepare(
    'SELECT DISTINCT user_id, guild_id FROM workouts WHERE created_at >= ?'
  ).all(weekAgo);

  for (const { user_id, guild_id } of users) {
    try {
      const workouts = db.prepare(
        'SELECT COUNT(*) as count, COUNT(DISTINCT exercise) as exercises FROM workouts WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(user_id, guild_id, weekAgo);

      const streak = db.prepare(
        'SELECT current_streak FROM streaks WHERE user_id = ? AND guild_id = ?'
      ).get(user_id, guild_id);

      const water = db.prepare(
        'SELECT SUM(amount_ml) as total FROM water_logs WHERE user_id = ? AND guild_id = ? AND created_at >= ?'
      ).get(user_id, guild_id, weekAgo);

      const guild = await client.guilds.fetch(guild_id);
      const member = await guild.members.fetch(user_id);

      const summary = [
        `**Workouts:** ${workouts.count} sessions, ${workouts.exercises} different exercises`,
        `**Current Streak:** ${streak?.current_streak || 0} days`,
        `**Water Intake:** ${((water?.total || 0) / 1000).toFixed(1)}L total`,
      ].join('\n');

      await safeDM(member.user, {
        embeds: [embed('Your Weekly Fitness Summary', summary, COLORS.primary)]
      });
    } catch {}
  }
}

module.exports = { loadScheduledJobs };
