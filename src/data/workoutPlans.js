module.exports = {
  ppl: {
    name: 'Push / Pull / Legs (PPL)',
    description: '6-day split targeting push muscles, pull muscles, and legs in rotation.',
    days: {
      'Push Day': [
        { exercise: 'Bench Press', sets: 4, reps: '6-8' },
        { exercise: 'Overhead Press', sets: 3, reps: '8-10' },
        { exercise: 'Incline Bench Press', sets: 3, reps: '8-10' },
        { exercise: 'Lateral Raise', sets: 3, reps: '12-15' },
        { exercise: 'Skull Crusher', sets: 3, reps: '10-12' },
        { exercise: 'Cable Crossover', sets: 3, reps: '12-15' },
      ],
      'Pull Day': [
        { exercise: 'Deadlift', sets: 4, reps: '5-6' },
        { exercise: 'Pull-Up', sets: 3, reps: '6-10' },
        { exercise: 'Barbell Row', sets: 3, reps: '8-10' },
        { exercise: 'Face Pull', sets: 3, reps: '15-20' },
        { exercise: 'Barbell Curl', sets: 3, reps: '10-12' },
        { exercise: 'Hammer Curl', sets: 3, reps: '10-12' },
      ],
      'Leg Day': [
        { exercise: 'Squat', sets: 4, reps: '6-8' },
        { exercise: 'Romanian Deadlift', sets: 3, reps: '8-10' },
        { exercise: 'Leg Press', sets: 3, reps: '10-12' },
        { exercise: 'Leg Curl', sets: 3, reps: '10-12' },
        { exercise: 'Leg Extension', sets: 3, reps: '12-15' },
        { exercise: 'Calf Raise', sets: 4, reps: '15-20' },
      ],
    },
  },

  upper_lower: {
    name: 'Upper / Lower Split',
    description: '4-day split alternating upper and lower body days.',
    days: {
      'Upper Day A (Strength)': [
        { exercise: 'Bench Press', sets: 4, reps: '5-6' },
        { exercise: 'Barbell Row', sets: 4, reps: '5-6' },
        { exercise: 'Overhead Press', sets: 3, reps: '6-8' },
        { exercise: 'Lat Pulldown', sets: 3, reps: '8-10' },
        { exercise: 'Barbell Curl', sets: 2, reps: '10-12' },
        { exercise: 'Skull Crusher', sets: 2, reps: '10-12' },
      ],
      'Lower Day A (Strength)': [
        { exercise: 'Squat', sets: 4, reps: '5-6' },
        { exercise: 'Romanian Deadlift', sets: 3, reps: '8-10' },
        { exercise: 'Leg Press', sets: 3, reps: '8-10' },
        { exercise: 'Leg Curl', sets: 3, reps: '10-12' },
        { exercise: 'Calf Raise', sets: 3, reps: '15-20' },
        { exercise: 'Plank', sets: 3, reps: '60s hold' },
      ],
      'Upper Day B (Volume)': [
        { exercise: 'Incline Bench Press', sets: 3, reps: '10-12' },
        { exercise: 'Seated Cable Row', sets: 3, reps: '10-12' },
        { exercise: 'Lateral Raise', sets: 3, reps: '12-15' },
        { exercise: 'Face Pull', sets: 3, reps: '15-20' },
        { exercise: 'Dumbbell Fly', sets: 3, reps: '12-15' },
        { exercise: 'Hammer Curl', sets: 2, reps: '12-15' },
      ],
      'Lower Day B (Volume)': [
        { exercise: 'Lunge', sets: 3, reps: '10-12 each' },
        { exercise: 'Hip Thrust', sets: 3, reps: '10-12' },
        { exercise: 'Leg Extension', sets: 3, reps: '12-15' },
        { exercise: 'Leg Curl', sets: 3, reps: '12-15' },
        { exercise: 'Calf Raise', sets: 3, reps: '15-20' },
        { exercise: 'Hanging Leg Raise', sets: 3, reps: '10-15' },
      ],
    },
  },

  full_body: {
    name: 'Full Body (3-Day)',
    description: '3-day full body program, ideal for beginners or busy schedules.',
    days: {
      'Day A': [
        { exercise: 'Squat', sets: 3, reps: '8-10' },
        { exercise: 'Bench Press', sets: 3, reps: '8-10' },
        { exercise: 'Barbell Row', sets: 3, reps: '8-10' },
        { exercise: 'Overhead Press', sets: 2, reps: '10-12' },
        { exercise: 'Barbell Curl', sets: 2, reps: '10-12' },
        { exercise: 'Plank', sets: 3, reps: '45s hold' },
      ],
      'Day B': [
        { exercise: 'Deadlift', sets: 3, reps: '6-8' },
        { exercise: 'Incline Bench Press', sets: 3, reps: '8-10' },
        { exercise: 'Pull-Up', sets: 3, reps: '6-10' },
        { exercise: 'Lateral Raise', sets: 3, reps: '12-15' },
        { exercise: 'Skull Crusher', sets: 2, reps: '10-12' },
        { exercise: 'Hanging Leg Raise', sets: 3, reps: '10-15' },
      ],
      'Day C': [
        { exercise: 'Leg Press', sets: 3, reps: '10-12' },
        { exercise: 'Dumbbell Fly', sets: 3, reps: '10-12' },
        { exercise: 'Seated Cable Row', sets: 3, reps: '10-12' },
        { exercise: 'Face Pull', sets: 3, reps: '15-20' },
        { exercise: 'Lunge', sets: 3, reps: '10-12 each' },
        { exercise: 'Russian Twist', sets: 3, reps: '20 total' },
      ],
    },
  },

  bro_split: {
    name: '5-Day Bro Split',
    description: 'Classic bodybuilding split - one major muscle group per day.',
    days: {
      'Chest Day': [
        { exercise: 'Bench Press', sets: 4, reps: '6-8' },
        { exercise: 'Incline Bench Press', sets: 3, reps: '8-10' },
        { exercise: 'Dumbbell Fly', sets: 3, reps: '10-12' },
        { exercise: 'Cable Crossover', sets: 3, reps: '12-15' },
        { exercise: 'Push-Up', sets: 3, reps: 'to failure' },
      ],
      'Back Day': [
        { exercise: 'Deadlift', sets: 4, reps: '5-6' },
        { exercise: 'Pull-Up', sets: 4, reps: '6-10' },
        { exercise: 'Barbell Row', sets: 3, reps: '8-10' },
        { exercise: 'Lat Pulldown', sets: 3, reps: '10-12' },
        { exercise: 'Seated Cable Row', sets: 3, reps: '10-12' },
      ],
      'Shoulder Day': [
        { exercise: 'Overhead Press', sets: 4, reps: '6-8' },
        { exercise: 'Lateral Raise', sets: 4, reps: '12-15' },
        { exercise: 'Face Pull', sets: 3, reps: '15-20' },
      ],
      'Leg Day': [
        { exercise: 'Squat', sets: 4, reps: '6-8' },
        { exercise: 'Romanian Deadlift', sets: 3, reps: '8-10' },
        { exercise: 'Leg Press', sets: 3, reps: '10-12' },
        { exercise: 'Leg Curl', sets: 3, reps: '10-12' },
        { exercise: 'Calf Raise', sets: 4, reps: '15-20' },
        { exercise: 'Hip Thrust', sets: 3, reps: '10-12' },
      ],
      'Arms Day': [
        { exercise: 'Barbell Curl', sets: 3, reps: '8-10' },
        { exercise: 'Skull Crusher', sets: 3, reps: '8-10' },
        { exercise: 'Hammer Curl', sets: 3, reps: '10-12' },
        { exercise: 'Tricep Dip', sets: 3, reps: '10-12' },
      ],
    },
  },
};
