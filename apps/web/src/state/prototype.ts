import type { PageId, PrototypeState, Role, ViewState } from '../types';

export const initialState: PrototypeState = {
  page: 'dashboard',
  project: 'Archify Web',
  role: 'Admin',
  viewState: 'ready',
  query: '',
  notice: '',
};

export type Action =
  | { type: 'navigate'; page: PageId }
  | { type: 'role'; role: Role }
  | { type: 'view'; viewState: ViewState }
  | { type: 'query'; query: string }
  | { type: 'project'; project: string }
  | { type: 'notice'; notice: string };

export function canEdit(role: Role): boolean {
  return role === 'Author' || role === 'Admin';
}

export function reducer(state: PrototypeState, action: Action): PrototypeState {
  switch (action.type) {
    case 'navigate':
      return { ...state, page: action.page, query: '', viewState: 'ready', notice: '' };
    case 'role':
      return { ...state, role: action.role, notice: '已切換示範角色；真實授權將由 Control API 驗證。' };
    case 'view':
      return { ...state, viewState: action.viewState };
    case 'query':
      return { ...state, query: action.query };
    case 'project':
      return { ...state, project: action.project, page: 'project', query: '', notice: '已切換示範專案。' };
    case 'notice':
      return { ...state, notice: action.notice };
  }
}

