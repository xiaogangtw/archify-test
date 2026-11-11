export const appiumExample = `export const flow = {
  appPackage: "com.android.settings",
  steps: [
    {
      name: "確認設定畫面顯示",
      action: "assertVisible",
      using: "id",
      value: "android:id/content"
    }
  ]
} as const;
`;
// Package verified against LINE's official Google Play listing.
export const appiumLineExample = `export const flow = {
  appPackage: "jp.naver.line.android",
  steps: [
    {
      name: "確認 LINE 已開啟並位於前景",
      action: "assertAppForeground"
    }
  ]
} as const;
`;
export function appiumLabels(source: string): string[] {
  // All declarations, for edit-removal comparison only. Preview uses the AST.
  return [...source.matchAll(/(?:"name"|\bname)\s*:\s*(['"])([^'"\n]+)\1/g)].map(match => match[2]);
}
export function isDualPhoneFlow(source: string): boolean {
  return /(?:"actors"|\bactors)\s*:\s*\[/.test(source);
}
export const appiumDualExample = `export const flow = {
  appPackage: "com.android.settings",
  actors: ["sender", "receiver"],
  steps: [
    {
      name: "確認發送者設定畫面",
      actor: "sender",
      action: "assertVisible",
      using: "id",
      value: "android:id/content"
    },
    {
      name: "確認接收者設定畫面",
      actor: "receiver",
      action: "assertVisible",
      using: "id",
      value: "android:id/content"
    }
  ]
} as const;
`;
