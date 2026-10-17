import type { CodeChallenge, Lesson, PracticeCard, ProfessionId, ProfessionModule, Unit } from '@/types/curriculum';
import conditionals from './lessons/beginner/conditionals.json';
import utmAutotagger from './lessons/marketing/utm-autotagger.json';
import { marketingModule } from './professions/marketing';
import { financeModule } from './professions/finance';
import { productOpsModule } from './professions/productOps';
import { dataModule } from './professions/data';

/**
 * Offline content registry. JSON literals widen discriminants to `string`, so
 * they are cast here; CI must validate them structurally and run every
 * challenge's `solution` against its own tests (see docs/ARCHITECTURE.md §9).
 */
const LESSONS: Lesson[] = [conditionals as unknown as Lesson, utmAutotagger as unknown as Lesson];

const byId = new Map(LESSONS.map((l) => [l.id, l]));

export function getLesson(id: string): Lesson | undefined {
  return byId.get(id);
}

export function getPracticeChallenge(lesson: Lesson): CodeChallenge | undefined {
  return lesson.cards.find((c): c is PracticeCard => c.type === 'practice')?.challenge;
}

export const professionModules: Record<ProfessionId, ProfessionModule> = {
  marketing: marketingModule,
  finance: financeModule,
  product_ops: productOpsModule,
  data: dataModule,
};

function buildUnitsForModule(mod: ProfessionModule, defaultIcons: string[]): Unit[] {
  return [
    {
      id: `${mod.id}.u1`,
      title: mod.title,
      description: mod.tagline,
      nodes: mod.useCases.map((uc, i, all) => ({
        id: uc.id,
        type: 'lesson' as const,
        refId: uc.lessonId,
        title: uc.title,
        icon: defaultIcons[i % defaultIcons.length] ?? '📌',
        unlockAfter: i === 0 ? [] : [all[i - 1]!.id],
      })),
    },
  ];
}

/** Standard certification path units (Foundations through PCEP/PCAP alignment). */
export const certificationUnits: Unit[] = [
  {
    id: 'core.beginner.u3',
    title: 'Unit 3 · Control Flow & Logic',
    description: 'Decisions and branching — aligned with PCEP Section 2.',
    nodes: [
      { id: 'n1', type: 'lesson', refId: 'core.beginner.u3.l1-conditionals', title: 'if / elif / else', icon: '🔀', unlockAfter: [] },
      { id: 'n2', type: 'lesson', refId: 'core.beginner.u3.l2-for-loops', title: 'for loops', icon: '🔁', unlockAfter: ['n1'] },
      { id: 'n3', type: 'lesson', refId: 'core.beginner.u3.l3-while-loops', title: 'while loops', icon: '♾️', unlockAfter: ['n2'] },
      { id: 'n4', type: 'checkpoint', refId: 'core.beginner.u3.checkpoint', title: 'Practice checkpoint', icon: '🏋️', unlockAfter: ['n3'] },
      { id: 'n5', type: 'milestone_quiz', refId: 'exam.pcep.section2', title: 'PCEP §2 Milestone', icon: '🏅', unlockAfter: ['n4'] },
    ],
  },
];

export const professionUnits: Record<ProfessionId, Unit[]> = {
  marketing: buildUnitsForModule(marketingModule, ['🔗', '📊', '🕵️', '💬', '🧹']),
  finance: buildUnitsForModule(financeModule, ['⚖️', '🧾', '💱', '📈', '🔍']),
  product_ops: buildUnitsForModule(productOpsModule, ['🚨', '🔄', '⏱️', '🎲', '🏷️']),
  data: buildUnitsForModule(dataModule, ['🧹', '📊', '📉', '🧪', '🎯']),
};

export { marketingModule, financeModule, productOpsModule, dataModule };
