// Catalog of validated personal-record types. Each entry tells the bot which
// numeric inputs to expect and how to compare entries to find a new PR.
//
//   measurement: 'weight' (heaviest) | 'duration' (longest hold) |
//                'distance' (longest) | 'time' (fastest) | 'reps' (most reps)
//   compare:     'higher' | 'lower' (lower for fastest-time records)
//   defaultUnit: shown in UI placeholders only
//
// Free-form records can still be submitted via /pr submit with a custom name.

module.exports = {
  // Strength
  'bench press':        { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Bench Press (1RM)' },
  'back squat':         { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Back Squat (1RM)' },
  'front squat':        { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Front Squat (1RM)' },
  'deadlift':           { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Deadlift (1RM)' },
  'overhead press':     { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Overhead Press (1RM)' },
  'barbell row':        { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Barbell Row (1RM)' },
  'power clean':        { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Power Clean (1RM)' },
  'snatch':             { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Snatch (1RM)' },
  'farmer carry':       { measurement: 'weight', compare: 'higher', defaultUnit: 'lbs', label: 'Farmer\'s Carry (per hand)' },

  // Bodyweight reps
  'pull-ups':           { measurement: 'reps', compare: 'higher', defaultUnit: 'reps', label: 'Max Pull-Ups (unbroken)' },
  'push-ups':           { measurement: 'reps', compare: 'higher', defaultUnit: 'reps', label: 'Max Push-Ups (unbroken)' },
  'dips':               { measurement: 'reps', compare: 'higher', defaultUnit: 'reps', label: 'Max Dips (unbroken)' },
  'pistol squats':      { measurement: 'reps', compare: 'higher', defaultUnit: 'reps', label: 'Max Pistol Squats (per leg)' },
  'muscle-ups':         { measurement: 'reps', compare: 'higher', defaultUnit: 'reps', label: 'Max Muscle-Ups' },
  'handstand push-ups': { measurement: 'reps', compare: 'higher', defaultUnit: 'reps', label: 'Max HSPU (unbroken)' },

  // Holds / time
  'plank':              { measurement: 'duration', compare: 'higher', defaultUnit: 'sec', label: 'Plank Hold' },
  'side plank':         { measurement: 'duration', compare: 'higher', defaultUnit: 'sec', label: 'Side Plank Hold' },
  'wall sit':           { measurement: 'duration', compare: 'higher', defaultUnit: 'sec', label: 'Wall Sit' },
  'dead hang':          { measurement: 'duration', compare: 'higher', defaultUnit: 'sec', label: 'Dead Hang' },
  'l-sit':              { measurement: 'duration', compare: 'higher', defaultUnit: 'sec', label: 'L-Sit Hold' },
  'hollow hold':        { measurement: 'duration', compare: 'higher', defaultUnit: 'sec', label: 'Hollow Body Hold' },

  // Cardio distance
  'longest run':        { measurement: 'distance', compare: 'higher', defaultUnit: 'km', label: 'Longest Run' },
  'longest ride':       { measurement: 'distance', compare: 'higher', defaultUnit: 'km', label: 'Longest Bike Ride' },
  'longest swim':       { measurement: 'distance', compare: 'higher', defaultUnit: 'm', label: 'Longest Swim' },
  'longest row':        { measurement: 'distance', compare: 'higher', defaultUnit: 'm', label: 'Longest Row' },

  // Cardio time (fastest)
  '1k run':             { measurement: 'time', compare: 'lower',  defaultUnit: 'sec', label: 'Fastest 1K Run' },
  '5k run':             { measurement: 'time', compare: 'lower',  defaultUnit: 'sec', label: 'Fastest 5K Run' },
  '10k run':            { measurement: 'time', compare: 'lower',  defaultUnit: 'sec', label: 'Fastest 10K Run' },
  'half marathon':      { measurement: 'time', compare: 'lower',  defaultUnit: 'sec', label: 'Fastest Half Marathon' },
  'marathon':           { measurement: 'time', compare: 'lower',  defaultUnit: 'sec', label: 'Fastest Marathon' },
  'mile run':           { measurement: 'time', compare: 'lower',  defaultUnit: 'sec', label: 'Fastest Mile' },
  '500m row':           { measurement: 'time', compare: 'lower',  defaultUnit: 'sec', label: 'Fastest 500m Row' },
  '2k row':             { measurement: 'time', compare: 'lower',  defaultUnit: 'sec', label: 'Fastest 2K Row' },

  // Jumps / explosive
  'vertical jump':      { measurement: 'distance', compare: 'higher', defaultUnit: 'in', label: 'Vertical Jump Height' },
  'broad jump':         { measurement: 'distance', compare: 'higher', defaultUnit: 'in', label: 'Standing Broad Jump' },
  'box jump':           { measurement: 'distance', compare: 'higher', defaultUnit: 'in', label: 'Max Box Jump Height' },
};
