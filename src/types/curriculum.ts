/**
 * PyPath curriculum data model.
 *
 * Every lesson follows the Explain -> Demonstrate -> Practice -> Reinforce loop,
 * expressed as an ordered list of discriminated-union `LessonCard`s. Content is
 * authored as JSON (see src/content/lessons) and shipped inside the app bundle
 * so the whole curriculum works offline.
 */
import type { AccessoryKeyId } from './editor';

export type ID = string;
/** CommonMark subset rendered by react-native-markdown-display. */
export type Markdown = string;

// ─────────────────────────────────────────────────────────────────────────────
// Taxonomy
// ─────────────────────────────────────────────────────────────────────────────

export type TierId = 'beginner' | 'intermediate' | 'pro' | 'seasoned_pro';
export type ProfessionId = 'marketing' | 'finance' | 'product_ops' | 'data';
export type CertificationId = 'PCEP' | 'PCAP' | 'PCPP1';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface CertificationAlignment {
  exam: CertificationId;
  /** Official objective code, e.g. "PCEP-30-02 2.1". */
  objective: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracks, units & the Duolingo-style path
// ─────────────────────────────────────────────────────────────────────────────

export type Track =
  | { kind: 'certification'; id: ID; title: string; description: string; tiers: TierBlock[] }
  | { kind: 'profession'; id: ID; title: string; description: string; module: ProfessionModule };

export interface TierBlock {
  tier: TierId;
  title: string;
  /** Certification this tier prepares for (Beginner→PCEP, Intermediate/Pro→PCAP, Seasoned→PCPP1). */
  certification?: CertificationId;
  units: Unit[];
}

export interface Unit {
  id: ID;
  title: string;
  description: string;
  nodes: PathNode[];
}

export type PathNodeType = 'lesson' | 'checkpoint' | 'milestone_quiz';

export interface PathNode {
  id: ID;
  type: PathNodeType;
  /** Lesson id for `lesson`/`checkpoint`, MockExam id for `milestone_quiz`. */
  refId: ID;
  title: string;
  icon?: string;
  /** All listed node ids must be completed before this node unlocks. */
  unlockAfter: ID[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Lesson
// ─────────────────────────────────────────────────────────────────────────────

export interface Lesson {
  schemaVersion: 1;
  id: ID;
  title: string;
  summary: string;
  tier: TierId;
  /** Present for profession-track lessons. */
  profession?: ProfessionId;
  estimatedMinutes: number;
  xpReward: number;
  tags: string[];
  /** Concept keys used for mistake analytics & spaced review (e.g. "conditionals.elif"). */
  concepts: string[];
  prerequisites: ID[];
  certification: CertificationAlignment[];
  /** Pyodide packages to warm up when the lesson opens (e.g. ["pandas"]). */
  requiredPackages: string[];
  /** Cheat sheet entries linked from the lesson footer. */
  cheatSheetRefs: ID[];
  cards: LessonCard[];
}

export type LessonCard = ExplainCard | DemonstrateCard | PracticeCard | ReinforceCard;

interface CardBase {
  id: ID;
  title: string;
}

/** 1. EXPLAIN — bite-sized theory with optional diagram & real-world callout. */
export interface ExplainCard extends CardBase {
  type: 'explain';
  body: Markdown;
  diagram?: Diagram;
  keyPoints: string[];
  /** Rendered as a collapsible "Why this matters in the real world" callout. */
  realWorld?: RealWorldCallout;
}

export interface RealWorldCallout {
  title: string;
  body: Markdown;
  roi?: RoiMetric;
}

export type Diagram =
  | {
      kind: 'flow';
      caption?: string;
      nodes: { id: ID; label: string; shape: 'start' | 'process' | 'decision' | 'end' }[];
      edges: { from: ID; to: ID; label?: string }[];
    }
  | { kind: 'table'; caption?: string; columns: string[]; rows: string[][] }
  | { kind: 'image'; caption?: string; asset: string; alt: string };

/** 2. DEMONSTRATE — annotated, runnable walkthrough. */
export interface DemonstrateCard extends CardBase {
  type: 'demonstrate';
  code: string;
  runnable: boolean;
  expectedOutput?: string;
  files?: VirtualFile[];
  steps: WalkthroughStep[];
}

export interface WalkthroughStep {
  /** Inclusive, 1-based line range highlighted in the snippet. */
  lines: [number, number];
  /** Optional tokens emphasised within the highlighted lines. */
  focus?: string[];
  explanation: Markdown;
}

/** 3. PRACTICE — opens the Code Lab with an embedded challenge. */
export interface PracticeCard extends CardBase {
  type: 'practice';
  challenge: CodeChallenge;
}

/** 4. REINFORCE — quick retrieval-practice quiz. */
export interface ReinforceCard extends CardBase {
  type: 'reinforce';
  questions: QuizQuestion[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Code challenges & test cases
// ─────────────────────────────────────────────────────────────────────────────

export interface CodeChallenge {
  id: ID;
  title: string;
  difficulty: Difficulty;
  prompt: Markdown;
  /** Rendered as a checklist in the top half of the Code Lab. */
  requirements: string[];
  starterCode: string;
  /** Reference solution — used by CI to validate the test suite; never shown before 3 failed attempts. */
  solution: string;
  hints: Hint[];
  tests: TestCase[];
  /** Files materialised into the sandbox FS (cwd = /home/pyodide) before every run. */
  files?: VirtualFile[];
  /** Extra Pyodide packages (imports are also auto-detected). */
  packages?: string[];
  /** stdin used by the "Run" button (tests carry their own stdin). */
  sampleStdin?: string;
  limits?: ExecutionLimits;
  xpReward: number;
  concepts: string[];
  /** Overrides the default editor accessory row for this challenge. */
  accessoryKeys?: AccessoryKeyId[];
}

export interface Hint {
  text: Markdown;
  /** XP deducted from the challenge reward when revealed. */
  xpCost: number;
}

export interface ExecutionLimits {
  /** Soft (in-interpreter) timeout per execution. Default 5000ms. */
  timeoutMs?: number;
  /** Combined stdout+stderr cap in characters. Default 65 536. */
  maxOutputChars?: number;
}

export interface VirtualFile {
  /** Relative to the sandbox cwd, e.g. "data/report.csv". `..` is rejected. */
  path: string;
  content: string;
  encoding?: 'utf8' | 'base64';
}

export type StdoutMatchMode = 'exact' | 'trimmed' | 'contains' | 'regex' | 'lines_unordered';

interface TestCaseBase {
  id: ID;
  /** Learner-facing description, e.g. "Members always ship free". */
  name: string;
  /** Hidden tests show pass/fail only — never inputs or expected values. */
  hidden: boolean;
  /** stdin fed to `input()` for this test's execution. */
  stdin?: string;
  /** Shown when the test fails (in addition to the humanized error). */
  failureHint?: string;
  weight?: number;
}

/** Runs the learner's program and compares captured stdout. */
export interface StdoutTestCase extends TestCaseBase {
  kind: 'stdout';
  expected: string;
  match: StdoutMatchMode;
}

/**
 * Runs the learner's program, then executes `code` in the *same* namespace.
 * `assert actual == expected` statements are rewritten so failures report
 * both values ("expected 4.99, got 0").
 */
export interface AssertTestCase extends TestCaseBase {
  kind: 'assert';
  code: string;
}

export type TestCase = StdoutTestCase | AssertTestCase;

// ─────────────────────────────────────────────────────────────────────────────
// Quizzes (Reinforce cards + certification mock exams)
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionBase {
  id: ID;
  prompt: Markdown;
  /** Optional read-only code snippet shown with the question. */
  code?: string;
  explanation: Markdown;
  /** Concept key for mistake analysis. */
  concept: string;
  /** Certification objective, for readiness scoring. */
  objective?: string;
}

export interface MultipleChoiceQuestion extends QuestionBase {
  kind: 'multiple_choice';
  options: { id: ID; text: string }[];
  /** More than one id ⇒ "select all that apply". */
  correctOptionIds: ID[];
}

export interface PredictOutputQuestion extends QuestionBase {
  kind: 'predict_output';
  code: string;
  /** Compared after trimming trailing whitespace per line. */
  answer: string;
}

export interface FillBlankQuestion extends QuestionBase {
  kind: 'fill_blank';
  /** Code with `___` placeholders. */
  template: string;
  /** Accepted answers for each blank, in order. */
  blanks: string[][];
}

export type QuizQuestion = MultipleChoiceQuestion | PredictOutputQuestion | FillBlankQuestion;

// ─────────────────────────────────────────────────────────────────────────────
// Profession tracks
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfessionModule {
  id: ID;
  profession: ProfessionId;
  title: string;
  tagline: string;
  audience: string;
  outcomes: string[];
  /** Minimum core tier recommended before starting (e.g. "beginner"). */
  recommendedTier: TierId;
  useCases: UseCase[];
}

export interface UseCase {
  id: ID;
  title: string;
  problem: string;
  /** How the task is done manually today — anchors the ROI story. */
  manualProcess: string;
  roi: RoiMetric;
  packages: string[];
  /** Lesson that teaches this use case end-to-end. */
  lessonId: ID;
  /** Runnable showcase snippet for the module overview. */
  sampleCode: string;
  sampleFiles?: VirtualFile[];
}

export interface RoiMetric {
  manualMinutes: number;
  automatedSeconds: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'per_campaign' | 'per_report';
  /** Pre-computed for display, e.g. 52. */
  annualHoursSaved?: number;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Certification Readiness Hub
// ─────────────────────────────────────────────────────────────────────────────

export interface MockExam {
  id: ID;
  certification: CertificationId;
  title: string;
  durationMinutes: number;
  passingScorePct: number;
  questionCount: number;
  sections: { objective: string; title: string; weightPct: number; questionIds: ID[] }[];
  questionPool: QuizQuestion[];
}

export interface ReadinessReport {
  certification: CertificationId;
  overallPct: number;
  byObjective: { objective: string; title: string; pct: number; attempts: number }[];
  weakestConcepts: string[];
  generatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cheat sheet (offline quick reference)
// ─────────────────────────────────────────────────────────────────────────────

export interface CheatSheetEntry {
  id: ID;
  title: string;
  category: 'syntax' | 'builtins' | 'strings' | 'collections' | 'control_flow' | 'functions' | 'oop' | 'stdlib' | 'pandas';
  syntax: string;
  example: string;
  output?: string;
  notes: Markdown;
  keywords: string[];
  tier: TierId;
}
