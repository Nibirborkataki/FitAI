import type { ProfileInput } from '../../lib/types'
import type { AthleteGesture, AthleteLoop } from '../../components/Athlete'

export type Answers = Partial<Record<keyof ProfileInput, string | number | null>>

export interface ChoiceOption {
  value: string | number
  label: string
  description?: string
  icon?: string // lucide icon name, see ICONS in Onboarding.tsx
}

interface BaseQuestion {
  id: keyof ProfileInput
  /** Short label for the review screen. */
  label: string
  title: string
  subtitle: string
  optional?: boolean
  athlete?: { loop?: AthleteLoop; gesture?: AthleteGesture }
  /** Hide this question based on earlier answers. */
  skipIf?: (answers: Answers) => boolean
}

export interface ChoiceQuestion extends BaseQuestion {
  type: 'choice'
  options: ChoiceOption[]
  columns?: number
}

export interface NumberQuestion extends BaseQuestion {
  type: 'number'
  min: number
  max: number
  step: number
  unit: string
  defaultValue: number | ((answers: Answers) => number)
  /** Small helper text under the value, e.g. imperial conversion. */
  hint?: (value: number, answers: Answers) => string
}

export interface TextQuestion extends BaseQuestion {
  type: 'text'
  placeholder: string
  suggestions: string[]
}

export type Question = ChoiceQuestion | NumberQuestion | TextQuestion

const toFeetInches = (cm: number) => {
  const totalInches = cm / 2.54
  const feet = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches - feet * 12)
  return inches === 12 ? `${feet + 1}′0″` : `${feet}′${inches}″`
}

export const QUESTIONS: Question[] = [
  {
    id: 'gender',
    label: 'Gender',
    type: 'choice',
    title: 'First, how do you identify?',
    subtitle: 'We use this to estimate your metabolic rate more accurately.',
    athlete: { gesture: 'Jump' },
    columns: 3,
    options: [
      { value: 'male', label: 'Male', icon: 'User' },
      { value: 'female', label: 'Female', icon: 'User' },
      { value: 'other', label: 'Other', icon: 'Users' },
    ],
  },
  {
    id: 'age',
    label: 'Age',
    type: 'number',
    title: 'How old are you?',
    subtitle: 'Age affects your calorie needs and heart-rate zones.',
    min: 13,
    max: 100,
    step: 1,
    unit: 'years',
    defaultValue: 28,
  },
  {
    id: 'height_cm',
    label: 'Height',
    type: 'number',
    title: 'How tall are you?',
    subtitle: 'Drag the slider or type a value.',
    min: 120,
    max: 230,
    step: 1,
    unit: 'cm',
    defaultValue: 172,
    hint: (v) => `≈ ${toFeetInches(v)}`,
  },
  {
    id: 'weight_kg',
    label: 'Weight',
    type: 'number',
    title: 'What do you weigh right now?',
    subtitle: "An estimate is fine. You can update it any time.",
    min: 30,
    max: 250,
    step: 0.5,
    unit: 'kg',
    defaultValue: 72,
    hint: (v, a) => {
      const h = Number(a.height_cm) / 100
      const bmi = h ? (v / (h * h)).toFixed(1) : '-'
      return `≈ ${Math.round(v * 2.2046)} lb · BMI ${bmi}`
    },
  },
  {
    id: 'goal',
    label: 'Main goal',
    type: 'choice',
    title: "What's your main goal?",
    subtitle: 'This shapes your calories, rep ranges and how the plan is built.',
    athlete: { gesture: 'Clapping' },
    columns: 2,
    options: [
      { value: 'fat_loss', label: 'Lose fat', description: 'Lean out while keeping muscle', icon: 'Flame' },
      { value: 'muscle_gain', label: 'Build muscle', description: 'Get stronger and add size', icon: 'Dumbbell' },
      { value: 'endurance', label: 'Improve endurance', description: 'Go longer, recover faster', icon: 'Timer' },
      { value: 'general_fitness', label: 'Get fitter overall', description: 'Feel better day to day', icon: 'Sparkles' },
      { value: 'maintenance', label: 'Maintain', description: 'Keep what you have built', icon: 'Scale' },
    ],
  },
  {
    id: 'target_weight_kg',
    label: 'Target weight',
    type: 'number',
    title: 'Do you have a target weight?',
    subtitle: "Optional. We'll estimate a realistic timeline for it.",
    optional: true,
    min: 30,
    max: 250,
    step: 0.5,
    unit: 'kg',
    defaultValue: (a) => {
      const w = Number(a.weight_kg) || 72
      if (a.goal === 'fat_loss') return Math.round(w * 0.92)
      if (a.goal === 'muscle_gain') return Math.round(w * 1.05)
      return w
    },
    hint: (v, a) => {
      const diff = v - Number(a.weight_kg)
      if (Math.abs(diff) < 0.5) return 'Same as your current weight'
      return `${diff > 0 ? '+' : ''}${diff.toFixed(1)} kg from now`
    },
    skipIf: (a) => a.goal === 'maintenance',
  },
  {
    id: 'experience_level',
    label: 'Fitness level',
    type: 'choice',
    title: "What's your current fitness level?",
    subtitle: 'Be honest. The plan should push you without burning you out.',
    columns: 3,
    options: [
      { value: 'beginner', label: 'Beginner', description: 'New or returning after a long break', icon: 'Sprout' },
      { value: 'intermediate', label: 'Intermediate', description: '6+ months of consistent training', icon: 'TrendingUp' },
      { value: 'advanced', label: 'Advanced', description: 'Years of structured training', icon: 'Trophy' },
    ],
  },
  {
    id: 'activity_level',
    label: 'Daily activity',
    type: 'choice',
    title: 'How active are you outside workouts?',
    subtitle: 'Think about your job and daily steps.',
    columns: 1,
    options: [
      { value: 'sedentary', label: 'Mostly sitting', description: 'Desk job, under 5k steps' },
      { value: 'light', label: 'Lightly active', description: 'Some walking, 5-7k steps' },
      { value: 'moderate', label: 'Moderately active', description: 'On your feet often, 7-10k steps' },
      { value: 'active', label: 'Very active', description: 'Physical job or 10k+ steps' },
      { value: 'very_active', label: 'Athlete level', description: 'Hard physical work plus training' },
    ],
  },
  {
    id: 'sleep_hours',
    label: 'Sleep',
    type: 'number',
    title: 'How many hours do you usually sleep?',
    subtitle: 'Recovery is where progress happens. An average night is fine.',
    min: 4,
    max: 12,
    step: 0.5,
    unit: 'hours',
    defaultValue: 7,
    hint: (v) => (v < 7 ? 'Below the 7–9 h target' : v > 9 ? 'Above the usual range' : 'In the 7–9 h sweet spot'),
  },
  {
    id: 'workout_days',
    label: 'Training days',
    type: 'choice',
    title: 'How many days a week can you train?',
    subtitle: 'Pick a number you can keep up for months, not just this week.',
    athlete: { loop: 'Run' },
    columns: 7,
    options: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) })),
  },
  {
    id: 'workout_duration',
    label: 'Session length',
    type: 'choice',
    title: 'How long is each session?',
    subtitle: 'Including warm-up and cooldown.',
    athlete: { loop: 'Run' },
    columns: 3,
    options: [20, 30, 45, 60, 75, 90].map((n) => ({ value: n, label: `${n} min` })),
  },
  {
    id: 'workout_preference',
    label: 'Training style',
    type: 'choice',
    title: 'What kind of training do you enjoy?',
    subtitle: "You'll stick with training you actually like.",
    athlete: { loop: 'Punch' },
    columns: 2,
    options: [
      { value: 'strength', label: 'Strength training', description: 'Lifting, progressive overload', icon: 'Dumbbell' },
      { value: 'hiit', label: 'HIIT', description: 'Short, intense intervals', icon: 'Zap' },
      { value: 'cardio', label: 'Cardio', description: 'Running, cycling, rowing', icon: 'HeartPulse' },
      { value: 'yoga_mobility', label: 'Yoga & mobility', description: 'Flexibility, control, core', icon: 'Flower2' },
      { value: 'mixed', label: 'A bit of everything', description: 'Variety keeps it fun', icon: 'Shuffle' },
    ],
  },
  {
    id: 'equipment',
    label: 'Equipment',
    type: 'choice',
    title: 'What equipment do you have?',
    subtitle: 'Your plan will only use what you pick here.',
    columns: 2,
    options: [
      { value: 'none', label: 'None', description: 'Bodyweight only', icon: 'PersonStanding' },
      { value: 'bands', label: 'Resistance bands', description: 'Light and portable', icon: 'Cable' },
      { value: 'dumbbells', label: 'Dumbbells', description: 'A pair or an adjustable set', icon: 'Dumbbell' },
      { value: 'home_gym', label: 'Home gym', description: 'Rack, barbell, bench', icon: 'Home' },
      { value: 'full_gym', label: 'Full gym', description: 'Machines, cables, everything', icon: 'Building2' },
    ],
  },
  {
    id: 'dietary_preference',
    label: 'Diet',
    type: 'choice',
    title: 'How do you eat?',
    subtitle: "We'll suggest protein sources that suit your diet.",
    columns: 3,
    options: [
      { value: 'vegetarian', label: 'Vegetarian', icon: 'Leaf' },
      { value: 'eggetarian', label: 'Eggetarian', icon: 'Egg' },
      { value: 'non_vegetarian', label: 'Non-vegetarian', icon: 'Drumstick' },
      { value: 'vegan', label: 'Vegan', icon: 'Sprout' },
      { value: 'pescatarian', label: 'Pescatarian', icon: 'Fish' },
      { value: 'no_preference', label: 'No preference', icon: 'Utensils' },
    ],
  },
  {
    id: 'injuries',
    label: 'Injuries & limitations',
    type: 'text',
    title: 'Any injuries or limitations?',
    subtitle: "Optional. The plan will avoid movements that could make them worse.",
    optional: true,
    placeholder: 'e.g. Mild lower-back pain, recovering from a sprained ankle…',
    suggestions: ['Knee pain', 'Lower-back pain', 'Shoulder injury', 'Wrist pain', 'Ankle sprain', 'Neck stiffness'],
  },
  {
    id: 'medical_conditions',
    label: 'Medical conditions',
    type: 'text',
    title: 'Any medical conditions we should know about?',
    subtitle: 'Optional and private. It adds safety notes to your plan. This is not a diagnosis.',
    optional: true,
    placeholder: 'e.g. Type 2 diabetes, managed with medication…',
    suggestions: ['Diabetes', 'High blood pressure', 'Asthma', 'Thyroid', 'PCOS / PCOD', 'Heart condition'],
    athlete: { gesture: 'Clapping' },
  },
]

export const LABELS: Record<string, string> = Object.fromEntries(
  QUESTIONS.flatMap((q) =>
    q.type === 'choice' ? q.options.map((o) => [`${q.id}:${o.value}`, o.label]) : [],
  ),
)

export function displayAnswer(question: Question, value: Answers[keyof Answers]): string {
  if (value === null || value === undefined || value === '') return 'Skipped'
  if (question.id === 'workout_days') return `${value} days / week`
  if (question.type === 'choice') return LABELS[`${question.id}:${value}`] ?? String(value)
  if (question.type === 'number') return `${value} ${question.unit}`
  return String(value)
}
