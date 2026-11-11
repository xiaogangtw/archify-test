type ReferenceCase = { id: string; name: string; version: number; caseType?: 'test' | 'flow' };

// Explicit allowlist: no source, messages, credentials or execution data.
export function flowReferenceCatalog(cases: ReferenceCase[], currentId: string) {
  return cases.filter(item => item.caseType === 'flow' && item.id !== currentId && Number.isInteger(item.version) && item.version > 0)
    .slice(0, 100)
    .map(item => ({ scriptId: item.id, scriptVersion: item.version, name: item.name }));
}
