import { serverStorage } from './controlApi';
export interface CaseFolder { id: string; name: string; parentId: string | null; scope?:'test'|'flow' }
export interface LibraryTree { folders: CaseFolder[]; scriptFolders: Record<string, string | null> }
export type LibraryItem = { kind: 'folder' | 'script'; id: string };
export const treeStorageKey = 'archify.script-folders.v1';
export const emptyTree = (): LibraryTree => ({ folders: [], scriptFolders: {} });

export function flattenTree(tree: LibraryTree): LibraryTree {
  const used = new Set<string>(['未分類']);
  const folders = tree.folders.map(folder => {
    let name = folder.name;
    let suffix = 2;
    while (used.has(name.toLocaleLowerCase())) name = `${folder.name} (${suffix++})`;
    used.add(name.toLocaleLowerCase());
    return { ...folder, name, parentId: null };
  });
  return { folders, scriptFolders: { ...tree.scriptFolders } };
}

export function validTree(value: unknown): value is LibraryTree {
  if (!value || typeof value !== 'object') return false;
  const tree = value as LibraryTree;
  if (!Array.isArray(tree.folders) || !tree.scriptFolders || typeof tree.scriptFolders !== 'object' || Array.isArray(tree.scriptFolders)) return false;
  if (!tree.folders.every(folder => folder && typeof folder.id === 'string' && folder.id.length > 0
    && typeof folder.name === 'string' && folder.name.trim().length > 0
    && (folder.parentId === null || typeof folder.parentId === 'string'))) return false;
  const ids = new Set(tree.folders.map(folder => folder.id));
  if (ids.size !== tree.folders.length) return false;
  for (const folder of tree.folders) {
    const visited = new Set([folder.id]);
    let parentId = folder.parentId;
    while (parentId !== null) {
      if (!ids.has(parentId) || visited.has(parentId)) return false;
      visited.add(parentId);
      parentId = tree.folders.find(item => item.id === parentId)!.parentId;
    }
  }
  return Object.values(tree.scriptFolders).every(id => id === null || (typeof id === 'string' && ids.has(id)));
}

export function loadTree(): LibraryTree {
  try {
    const tree = JSON.parse(serverStorage.getItem(treeStorageKey) || 'null');
    if (validTree(tree)) return flattenTree(tree);
  } catch { /* Library layout is separate from script content. */ }
  return emptyTree();
}

export function folderPath(tree: LibraryTree, folderId: string | null): string {
  const names: string[] = [];
  let current = tree.folders.find(folder => folder.id === folderId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id); names.unshift(current.name);
    current = tree.folders.find(folder => folder.id === current!.parentId);
  }
  return ['全部案例', ...names].join(' / ');
}

export function moveItem(tree: LibraryTree, item: LibraryItem, target: string | null): LibraryTree {
  if (target !== null && !tree.folders.some(folder => folder.id === target)) throw new Error('找不到目的資料夾。');
  if (item.kind === 'script') return { ...tree, scriptFolders: { ...tree.scriptFolders, [item.id]: target } };
  const folder = tree.folders.find(folder => folder.id === item.id);
  if (!folder) throw new Error('找不到要移動的資料夾。');
  let ancestor = target;
  while (ancestor !== null) {
    if (ancestor === item.id) throw new Error('不能把資料夾移到自己或自己的子資料夾。');
    ancestor = tree.folders.find(folder => folder.id === ancestor)?.parentId ?? null;
  }
  if (tree.folders.some(other => other.id !== folder.id && other.parentId === target
    && other.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase())) throw new Error('目的位置已有同名資料夾。');
  return { ...tree, folders: tree.folders.map(current => current.id === item.id ? { ...current, parentId: target } : current) };
}

