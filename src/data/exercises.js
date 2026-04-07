module.exports = {
  // CHEST
  'bench press': {
    muscles: ['Chest', 'Triceps', 'Shoulders'],
    tips: [
      'Keep your feet flat on the floor',
      'Retract your shoulder blades and arch slightly',
      'Lower the bar to mid-chest, not your neck',
      'Drive through your feet as you press up',
    ],
    category: 'push',
    equipment: 'barbell',
  },
  'incline bench press': {
    muscles: ['Upper Chest', 'Shoulders', 'Triceps'],
    tips: [
      'Set the bench to 30-45 degrees',
      'Keep elbows at about 45 degrees from your body',
      'Touch the bar to your upper chest',
    ],
    category: 'push',
    equipment: 'barbell',
  },
  'dumbbell fly': {
    muscles: ['Chest', 'Shoulders'],
    tips: [
      'Keep a slight bend in your elbows throughout',
      'Lower the weights to chest level, not below',
      'Squeeze your chest at the top',
    ],
    category: 'push',
    equipment: 'dumbbell',
  },
  'push-up': {
    muscles: ['Chest', 'Triceps', 'Shoulders', 'Core'],
    tips: [
      'Keep your body in a straight line from head to heels',
      'Lower until your chest nearly touches the floor',
      'Keep elbows at about 45 degrees',
    ],
    category: 'push',
    equipment: 'bodyweight',
  },
  'cable crossover': {
    muscles: ['Chest'],
    tips: [
      'Step forward slightly for a stretch at the top',
      'Bring hands together at mid-chest height',
      'Control the weight on the way back',
    ],
    category: 'push',
    equipment: 'cable',
  },

  // BACK
  'deadlift': {
    muscles: ['Back', 'Hamstrings', 'Glutes', 'Core'],
    tips: [
      'Keep the bar close to your body throughout',
      'Hinge at the hips, don\'t squat the weight up',
      'Maintain a neutral spine - no rounding',
      'Lock out by squeezing your glutes at the top',
    ],
    category: 'pull',
    equipment: 'barbell',
  },
  'barbell row': {
    muscles: ['Back', 'Biceps', 'Rear Delts'],
    tips: [
      'Bend at roughly 45 degrees',
      'Pull the bar to your lower chest/upper belly',
      'Squeeze your shoulder blades at the top',
    ],
    category: 'pull',
    equipment: 'barbell',
  },
  'pull-up': {
    muscles: ['Lats', 'Biceps', 'Rear Delts'],
    tips: [
      'Start from a dead hang with arms fully extended',
      'Pull your chest to the bar, not your chin',
      'Control the descent - no dropping',
    ],
    category: 'pull',
    equipment: 'bodyweight',
  },
  'lat pulldown': {
    muscles: ['Lats', 'Biceps'],
    tips: [
      'Pull the bar to your upper chest',
      'Lean back slightly and squeeze your lats',
      'Don\'t pull behind the neck',
    ],
    category: 'pull',
    equipment: 'cable',
  },
  'seated cable row': {
    muscles: ['Back', 'Biceps'],
    tips: [
      'Keep your torso upright - don\'t lean too far back',
      'Squeeze shoulder blades together at contraction',
      'Control the return phase',
    ],
    category: 'pull',
    equipment: 'cable',
  },

  // SHOULDERS
  'overhead press': {
    muscles: ['Shoulders', 'Triceps', 'Upper Chest'],
    tips: [
      'Start with the bar at collarbone height',
      'Press straight up, moving your head through at the top',
      'Brace your core to protect your lower back',
    ],
    category: 'push',
    equipment: 'barbell',
  },
  'lateral raise': {
    muscles: ['Side Delts'],
    tips: [
      'Keep a slight bend in your elbows',
      'Raise to shoulder height, no higher',
      'Lead with your elbows, not your hands',
      'Use light weight with control',
    ],
    category: 'push',
    equipment: 'dumbbell',
  },
  'face pull': {
    muscles: ['Rear Delts', 'Upper Back', 'Rotator Cuff'],
    tips: [
      'Set the cable at face height',
      'Pull to your face, separating the rope at the end',
      'Externally rotate your shoulders',
    ],
    category: 'pull',
    equipment: 'cable',
  },

  // ARMS
  'barbell curl': {
    muscles: ['Biceps'],
    tips: [
      'Keep your elbows pinned at your sides',
      'Don\'t swing or use momentum',
      'Squeeze at the top and control the descent',
    ],
    category: 'pull',
    equipment: 'barbell',
  },
  'tricep dip': {
    muscles: ['Triceps', 'Chest', 'Shoulders'],
    tips: [
      'Lean slightly forward for chest emphasis, stay upright for triceps',
      'Lower until your elbows are at 90 degrees',
      'Don\'t go too deep if you feel shoulder discomfort',
    ],
    category: 'push',
    equipment: 'bodyweight',
  },
  'skull crusher': {
    muscles: ['Triceps'],
    tips: [
      'Keep your upper arms perpendicular to the floor',
      'Lower the bar to your forehead or just behind your head',
      'Don\'t flare your elbows out',
    ],
    category: 'push',
    equipment: 'barbell',
  },
  'hammer curl': {
    muscles: ['Biceps', 'Brachialis', 'Forearms'],
    tips: [
      'Keep palms facing each other throughout',
      'Don\'t swing - strict form',
    ],
    category: 'pull',
    equipment: 'dumbbell',
  },

  // LEGS
  'squat': {
    muscles: ['Quads', 'Glutes', 'Hamstrings', 'Core'],
    tips: [
      'Keep your chest up and core braced',
      'Push your knees out in line with your toes',
      'Aim for parallel or below - hip crease below knee',
      'Drive through your whole foot, not just toes',
    ],
    category: 'legs',
    equipment: 'barbell',
  },
  'leg press': {
    muscles: ['Quads', 'Glutes', 'Hamstrings'],
    tips: [
      'Place feet shoulder-width on the platform',
      'Don\'t lock your knees at the top',
      'Lower until knees reach 90 degrees',
      'Keep your lower back pressed against the pad',
    ],
    category: 'legs',
    equipment: 'machine',
  },
  'romanian deadlift': {
    muscles: ['Hamstrings', 'Glutes', 'Lower Back'],
    tips: [
      'Push your hips back as far as possible',
      'Keep the bar close to your legs',
      'Feel the stretch in your hamstrings',
      'Don\'t round your back',
    ],
    category: 'pull',
    equipment: 'barbell',
  },
  'leg curl': {
    muscles: ['Hamstrings'],
    tips: [
      'Control the weight - don\'t let it snap back',
      'Full range of motion: fully extend and fully curl',
    ],
    category: 'legs',
    equipment: 'machine',
  },
  'leg extension': {
    muscles: ['Quads'],
    tips: [
      'Squeeze at the top for a second',
      'Control the weight on the way down',
      'Don\'t use heavy weight - protect your knees',
    ],
    category: 'legs',
    equipment: 'machine',
  },
  'calf raise': {
    muscles: ['Calves'],
    tips: [
      'Full range of motion: stretch at the bottom, squeeze at the top',
      'Hold at the top for 1-2 seconds',
      'Go slow - calves respond to time under tension',
    ],
    category: 'legs',
    equipment: 'machine',
  },
  'lunge': {
    muscles: ['Quads', 'Glutes', 'Hamstrings'],
    tips: [
      'Step far enough so both knees reach 90 degrees',
      'Keep your torso upright',
      'Don\'t let your front knee go past your toes',
    ],
    category: 'legs',
    equipment: 'bodyweight',
  },
  'hip thrust': {
    muscles: ['Glutes', 'Hamstrings'],
    tips: [
      'Drive through your heels',
      'Squeeze glutes hard at the top',
      'Keep your chin tucked to maintain neutral spine',
    ],
    category: 'legs',
    equipment: 'barbell',
  },

  // CORE
  'plank': {
    muscles: ['Core', 'Shoulders'],
    tips: [
      'Keep your body in a straight line',
      'Don\'t let your hips sag or pike up',
      'Breathe normally - don\'t hold your breath',
    ],
    category: 'core',
    equipment: 'bodyweight',
  },
  'crunch': {
    muscles: ['Abs'],
    tips: [
      'Curl your shoulders off the floor, not your lower back',
      'Don\'t pull on your neck',
      'Exhale as you crunch up',
    ],
    category: 'core',
    equipment: 'bodyweight',
  },
  'hanging leg raise': {
    muscles: ['Lower Abs', 'Hip Flexors'],
    tips: [
      'Minimize swinging - control the movement',
      'Raise legs to at least parallel',
      'Slow descent is key',
    ],
    category: 'core',
    equipment: 'bodyweight',
  },
  'russian twist': {
    muscles: ['Obliques', 'Core'],
    tips: [
      'Lean back at about 45 degrees',
      'Rotate your torso, not just your arms',
      'Keep your feet off the ground for extra challenge',
    ],
    category: 'core',
    equipment: 'bodyweight',
  },
  'ab wheel rollout': {
    muscles: ['Abs', 'Core', 'Lats'],
    tips: [
      'Start from your knees until you build strength',
      'Roll out as far as you can control',
      'Squeeze your abs to pull back - don\'t use your hips',
    ],
    category: 'core',
    equipment: 'bodyweight',
  },
};
