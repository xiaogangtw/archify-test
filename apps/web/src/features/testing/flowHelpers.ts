import type { FlowStep, TestCase } from './types';

export function caseToFlowStep(testCase: TestCase): FlowStep {
  return {
    id: crypto.randomUUID(),
    caseId: testCase.id,
    caseVersion: testCase.version,
    snapshot: structuredClone(testCase),
  };
}

export function requiredVariables(steps: FlowStep[]) {
  const names = new Set<string>();
  for (const step of steps) {
    const text = [step.snapshot.target, step.snapshot.expected,
      ...step.snapshot.actions.flatMap(action => [action.target, action.value])].join(' ');
    for (const match of text.matchAll(/\{\{([A-Za-z_]\w*)\}\}/g)) names.add(match[1]);
  }
  return [...names];
}

export function variableLabel(name: string) {
  const labels: Record<string, string> = {
    projectId: '專案 ID',
    testEmail: '測試帳號（Email）',
    secretRef: '測試密碼的憑證參照',
  };
  return labels[name] || name;
}

