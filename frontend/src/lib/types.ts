export type Gender = 'male' | 'female' | 'other'
export type Goal = 'fat_loss' | 'muscle_gain' | 'maintenance' | 'endurance' | 'general_fitness'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced'
export type WorkoutPreference = 'strength' | 'cardio' | 'hiit' | 'yoga_mobility' | 'mixed'
export type Equipment = 'none' | 'bands' | 'dumbbells' | 'home_gym' | 'full_gym'
export type DietaryPreference =
  | 'no_preference'
  | 'vegetarian'
  | 'eggetarian'
  | 'non_vegetarian'
  | 'vegan'
  | 'pescatarian'

export interface ProfileInput {
  age: number
  gender: Gender
  height_cm: number
  weight_kg: number
  target_weight_kg: number | null
  goal: Goal
  activity_level: ActivityLevel
  experience_level: ExperienceLevel
  workout_days: number
  workout_duration: number
  workout_preference: WorkoutPreference
  equipment: Equipment
  sleep_hours: number | null
  dietary_preference: DietaryPreference | null
  injuries: string | null
  medical_conditions: string | null
}

export interface Profile extends ProfileInput {
  id: number
  user_id: number
  updated_at: string
}

export interface Me {
  id: number
  email: string
  full_name: string
  first_name: string
  has_profile: boolean
}

export interface HealthReport {
  bmi: number
  bmi_category: string
  healthy_weight_range: { min_kg: number; max_kg: number }
  bmr: number
  tdee: number
  calorie_target: number
  calorie_adjustment: number
  macros: { protein_g: number; carbs_g: number; fat_g: number }
  nutrition: {
    diet: string
    meals_per_day: number
    protein_per_meal_g: number
    protein_sources: string[]
  }
  recovery: {
    sleep_hours: number
    target_min: number
    target_max: number
    status: 'low' | 'good' | 'high'
    note: string
  } | null
  health_flags: { level: 'info' | 'caution'; message: string }[]
  water_liters: { rest_day: number; training_day: number }
  heart_rate: {
    max_hr: number
    zones: { name: string; min_bpm: number; max_bpm: number; purpose: string }[]
  }
  weeks_to_target: number | null
  training: {
    split_name: string
    schedule: { day: string; focus: string }[]
    rest_days: string[]
    sets: string
    reps: string
    rest_seconds: number
    cardio_minutes_per_week: number
    intensity_note: string
    session_minutes: number
    weekly_minutes: number
  }
}

export interface Exercise {
  name: string
  sets: string
  reps: string
  rest_seconds: number
  notes: string
}

export interface PlanDay {
  day: string
  focus: string
  warmup: string
  exercises: Exercise[]
  cooldown: string
  estimated_minutes: number
}

export interface WorkoutPlan {
  id: number
  model: string
  created_at: string
  plan: {
    title: string
    summary: string
    days: PlanDay[]
    progression: string
    tips: string[]
    safety_notes: string
  }
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Usage {
  used_today: number
  daily_limit: number
  remaining_today: number
}
