// Full pre-built workout library content, loaded via the "Load workout
// library" button in FitnessScreen (client-side bulk insert through the
// signed-in Supabase client — same reasoning as fastFoodSeed.ts: SQL Editor
// sessions aren't authenticated as a user, so auth.uid()-defaulted rows
// can't be seeded via SQL directly).
import type { Exercise, WorkoutCategory } from './types';

export interface WorkoutSeedItem {
  category: WorkoutCategory;
  name: string;
  day_label: string | null;
  exercises: Exercise[];
}

function cardio(name: string, description: string): WorkoutSeedItem {
  return { category: 'running', name, day_label: null, exercises: [{ name: description, sets: 1, reps: '' }] };
}
function ex(name: string, sets: number, reps: string): Exercise {
  return { name, sets, reps };
}

export const WORKOUT_LIBRARY_SEED: WorkoutSeedItem[] = [
  // ── Running / Walking (12) ────────────────────────────────────────────
  cardio('Steady-State Walk', '45-60 min flat pace walk, conversational pace. Base cardio, active recovery.'),
  cardio('Incline Treadmill Walk', '30 min, 8-12% incline, 3.0-3.5 mph. High calorie burn, low joint impact.'),
  cardio('Tempo Run', '20 min: 5 min easy jog warmup, 10 min at a "comfortably hard" sustained pace, 5 min easy jog cooldown.'),
  cardio('Interval Sprints (Track/Treadmill)', '8 rounds: 30 sec all-out sprint / 90 sec walk recovery. Warmup 5 min, cooldown 5 min.'),
  cardio('Hill Repeats', 'Find a hill (or treadmill incline 10-15%). 6-8 rounds: 45 sec hard uphill push / walk back down for recovery.'),
  cardio('Long Slow Distance (LSD) Run', '40-60 min easy-pace continuous run. Builds aerobic base.'),
  cardio('Fartlek Run', '25 min continuous run, randomly surging pace for 1-2 min every 3-5 min (unstructured speed play).'),
  cardio('Stair Climb Intervals', '10 rounds: 1 min stairs (fast) / 1 min walk recovery.'),
  cardio('Power Walk Intervals', '30 min: alternate 3 min brisk walk / 2 min fast-paced walk, repeat.'),
  cardio('Recovery Jog', '20-25 min very easy jog, low heart rate, day-after-leg-day option.'),
  cardio('400m Repeats', '8x400m at hard pace with 2 min walk/jog rest between each.'),
  cardio('Zone 2 Bike or Incline Walk (Cross-Training Cardio)', '40 min steady low-intensity, heart rate kept low for aerobic base building.'),

  // ── Complete Bro Split (5-day weekly split) ────────────────────────────
  {
    category: 'bro_split', name: 'Chest', day_label: 'Day 1',
    exercises: [
      ex('Barbell Bench Press', 4, '6-8'), ex('Incline Dumbbell Press', 3, '8-10'), ex('Flat Dumbbell Fly', 3, '12-15'),
      ex('Cable Crossover (low-to-high)', 3, '12-15'), ex('Dips (chest-focused lean)', 3, 'AMRAP'), ex('Push-ups', 2, 'AMRAP (finisher)'),
    ],
  },
  {
    category: 'bro_split', name: 'Back', day_label: 'Day 2',
    exercises: [
      ex('Deadlift', 4, '5'), ex('Pull-ups (or lat pulldown)', 4, '8-10'), ex('Barbell Bent-Over Row', 3, '8-10'),
      ex('Seated Cable Row', 3, '10-12'), ex('Straight-Arm Lat Pulldown', 3, '12-15'), ex('Face Pulls', 3, '15'),
    ],
  },
  {
    category: 'bro_split', name: 'Legs', day_label: 'Day 3',
    exercises: [
      ex('Barbell Back Squat', 4, '6-8'), ex('Romanian Deadlift', 3, '8-10'), ex('Leg Press', 3, '10-12'),
      ex('Walking Lunges', 3, '12/leg'), ex('Leg Curl (machine)', 3, '12-15'), ex('Standing Calf Raise', 4, '15-20'),
    ],
  },
  {
    category: 'bro_split', name: 'Shoulders', day_label: 'Day 4',
    exercises: [
      ex('Overhead Barbell Press', 4, '6-8'), ex('Dumbbell Lateral Raise', 4, '12-15'), ex('Rear Delt Fly', 3, '12-15'),
      ex('Arnold Press', 3, '10'), ex('Front Plate Raise', 2, '12-15'), ex('Shrugs', 3, '12-15'),
    ],
  },
  {
    category: 'bro_split', name: 'Arms', day_label: 'Day 5',
    exercises: [
      ex('Barbell Curl', 4, '8-10'), ex('Close-Grip Bench Press', 4, '8-10'), ex('Incline Dumbbell Curl', 3, '10-12'),
      ex('Overhead Tricep Extension', 3, '10-12'), ex('Hammer Curl', 3, '12'), ex('Tricep Rope Pushdown', 3, '12-15'),
    ],
  },

  // ── Back and Biceps (5) ─────────────────────────────────────────────
  { category: 'back_biceps', name: 'Heavy Pull Day', day_label: 'BB-1', exercises: [
    ex('Deadlift', 4, '5'), ex('Pull-ups', 4, 'AMRAP'), ex('Barbell Row', 4, '8'), ex('Barbell Curl', 3, '10'), ex('Hammer Curl', 3, '10'),
  ]},
  { category: 'back_biceps', name: 'Width and Detail', day_label: 'BB-2', exercises: [
    ex('Lat Pulldown (wide grip)', 4, '10'), ex('Seated Cable Row', 4, '10'), ex('Single-Arm Dumbbell Row', 3, '10/side'), ex('Preacher Curl', 3, '10'), ex('Cable Curl', 3, '12'),
  ]},
  { category: 'back_biceps', name: 'Volume Pump Day', day_label: 'BB-3', exercises: [
    ex('T-Bar Row', 4, '10'), ex('Straight-Arm Pulldown', 3, '12'), ex('Face Pulls', 3, '15'), ex('Dumbbell Curl', 4, '12'), ex('Concentration Curl', 3, '12/side'),
  ]},
  { category: 'back_biceps', name: 'Strength Focus', day_label: 'BB-4', exercises: [
    ex('Rack Pulls', 4, '5'), ex('Weighted Pull-ups', 4, '6'), ex('Chest-Supported Row', 3, '8'), ex('Close-Grip Barbell Curl', 3, '8'), ex('Reverse Curl', 3, '10'),
  ]},
  { category: 'back_biceps', name: 'Full Back/Bi Burnout', day_label: 'BB-5', exercises: [
    ex('Pull-ups', 3, 'AMRAP'), ex('Seated Row', 3, '12'), ex('Dumbbell Pullover', 3, '12'), ex('21s Barbell Curl', 3, '21'), ex('Cable Hammer Curl', 3, '15'),
  ]},

  // ── Chest and Triceps (5) ───────────────────────────────────────────
  { category: 'chest_triceps', name: 'Heavy Press Day', day_label: 'CT-1', exercises: [
    ex('Barbell Bench Press', 4, '6'), ex('Incline Barbell Press', 3, '8'), ex('Close-Grip Bench Press', 4, '8'), ex('Overhead Tricep Extension', 3, '10'), ex('Tricep Pushdown', 3, '12'),
  ]},
  { category: 'chest_triceps', name: 'Upper Chest Focus', day_label: 'CT-2', exercises: [
    ex('Incline Dumbbell Press', 4, '8'), ex('Incline Cable Fly', 3, '12'), ex('Flat Dumbbell Press', 3, '10'), ex('Dips', 3, 'AMRAP'), ex('Skull Crushers', 3, '10'),
  ]},
  { category: 'chest_triceps', name: 'Volume Pump', day_label: 'CT-3', exercises: [
    ex('Flat Dumbbell Press', 4, '12'), ex('Cable Crossover', 3, '15'), ex('Machine Chest Press', 3, '12'), ex('Diamond Push-ups', 3, 'AMRAP'), ex('Rope Pushdown', 3, '15'),
  ]},
  { category: 'chest_triceps', name: 'Strength Focus', day_label: 'CT-4', exercises: [
    ex('Barbell Bench Press', 5, '5'), ex('Weighted Dips', 4, '6'), ex('Close-Grip Bench Press', 4, '6'), ex('Overhead Dumbbell Extension', 3, '8'), ex('JM Press', 3, '8'),
  ]},
  { category: 'chest_triceps', name: 'Full Chest/Tri Burnout', day_label: 'CT-5', exercises: [
    ex('Push-ups', 3, 'AMRAP (warmup)'), ex('Flat Bench Press', 3, '10'), ex('Incline Dumbbell Fly', 3, '15'), ex('Tricep Dips', 3, 'AMRAP'), ex('Cable Overhead Extension', 3, '15'),
  ]},

  // ── Legs (5) ─────────────────────────────────────────────────────────
  { category: 'legs', name: 'Heavy Squat Day', day_label: 'L-1', exercises: [
    ex('Barbell Back Squat', 5, '5'), ex('Romanian Deadlift', 4, '8'), ex('Leg Press', 3, '10'), ex('Leg Curl', 3, '12'), ex('Standing Calf Raise', 4, '15'),
  ]},
  { category: 'legs', name: 'Quad Focus', day_label: 'L-2', exercises: [
    ex('Front Squat', 4, '6'), ex('Leg Extension', 4, '12'), ex('Walking Lunges', 3, '12/leg'), ex('Bulgarian Split Squat', 3, '10/leg'), ex('Seated Calf Raise', 3, '15'),
  ]},
  { category: 'legs', name: 'Hamstring/Glute Focus', day_label: 'L-3', exercises: [
    ex('Romanian Deadlift', 4, '8'), ex('Hip Thrust', 4, '10'), ex('Leg Curl', 4, '12'), ex('Glute Kickback (cable)', 3, '12/side'), ex('Good Mornings', 3, '10'),
  ]},
  { category: 'legs', name: 'Strength Day', day_label: 'L-4', exercises: [
    ex('Barbell Back Squat', 5, '5'), ex('Deadlift', 3, '5'), ex('Leg Press', 4, '8'), ex('Standing Calf Raise', 4, '12'), ex('Hanging Leg Raise (core crossover)', 3, '12'),
  ]},
  { category: 'legs', name: 'Full Leg Burnout', day_label: 'L-5', exercises: [
    ex('Goblet Squat', 3, '15'), ex('Walking Lunges', 3, '15/leg'), ex('Leg Press', 3, '15'), ex('Leg Curl', 3, '15'), ex('Calf Raise (any variation)', 4, '20'),
  ]},

  // ── Core (8) ───────────────────────────────────────────────────────
  { category: 'core', name: 'Foundation Core', day_label: 'C-1', exercises: [
    ex('Plank', 3, '45 sec'), ex('Bicycle Crunches', 3, '20'), ex('Leg Raises', 3, '15'), ex('Russian Twists', 3, '20'), ex('Side Plank', 2, '30 sec/side'),
  ]},
  { category: 'core', name: 'Weighted Core', day_label: 'C-2', exercises: [
    ex('Weighted Sit-ups', 3, '15'), ex('Cable Woodchopper', 3, '12/side'), ex('Hanging Leg Raise', 3, '12'), ex('Weighted Russian Twist', 3, '20'), ex('Ab Wheel Rollout', 3, '10'),
  ]},
  { category: 'core', name: 'Endurance Core', day_label: 'C-3', exercises: [
    ex('Plank', 3, '60 sec'), ex('Mountain Climbers', 3, '30 sec'), ex('Flutter Kicks', 3, '30 sec'), ex('Hollow Body Hold', 3, '30 sec'), ex('Bicycle Crunches', 3, '25'),
  ]},
  { category: 'core', name: 'Rotational Focus', day_label: 'C-4', exercises: [
    ex('Russian Twists', 4, '20'), ex('Cable Woodchopper (both directions)', 3, '12/side'), ex('Side Plank with Rotation', 3, '12/side'), ex('Standing Oblique Crunch (cable)', 3, '15/side'), ex('Landmine Rotation', 3, '12/side'),
  ]},
  { category: 'core', name: 'Lower Ab Focus', day_label: 'C-5', exercises: [
    ex('Hanging Leg Raise', 4, '12'), ex('Reverse Crunch', 3, '15'), ex('Flutter Kicks', 3, '40 sec'), ex('Leg Raises', 3, '15'), ex('V-Ups', 3, '12'),
  ]},
  { category: 'core', name: 'Upper Ab Focus', day_label: 'C-6', exercises: [
    ex('Crunches', 4, '20'), ex('Cable Crunch', 3, '15'), ex('Sit-ups', 3, '15'), ex('Weighted Decline Crunch', 3, '12'), ex('Toe Touches', 3, '15'),
  ]},
  { category: 'core', name: 'Circuit Core (Timed)', day_label: 'C-7', exercises: [
    ex('Circuit — 30 sec work / 15 sec rest, 3 rounds: Plank', 3, '30 sec'), ex('Bicycle Crunches', 3, '30 sec'), ex('Mountain Climbers', 3, '30 sec'), ex('Russian Twists', 3, '30 sec'), ex('Leg Raises', 3, '30 sec'),
  ]},
  { category: 'core', name: 'Stability/Anti-Rotation Core', day_label: 'C-8', exercises: [
    ex('Plank', 3, '60 sec'), ex('Pallof Press', 3, '12/side'), ex('Side Plank', 3, '30 sec/side'), ex('Bird Dog', 3, '10/side'), ex('Dead Bug', 3, '12/side'),
  ]},
];
