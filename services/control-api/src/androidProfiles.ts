import type { Pool } from 'pg';
export type AndroidProfile = { id: string; owner: string; name: string; avd: string; state: 'new' | 'ready' };
export interface AndroidProfiles { list(): Promise<AndroidProfile[]>; put(row: AndroidProfile): Promise<void> }
export const memoryAndroidProfiles = (): AndroidProfiles => {
  const rows = new Map<string, AndroidProfile>();
  return { list: async () => [...rows.values()].map(row => ({ ...row })), put: async row => { rows.set(row.id, { ...row }); } };
};
export function databaseAndroidProfiles(pool: Pool): AndroidProfiles {
  return {
    list: async () => (await pool.query('SELECT id,owner,name,avd,state FROM android_profiles ORDER BY created_at,id')).rows,
    put: async row => { await pool.query('INSERT INTO android_profiles(id,owner,name,avd,state) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET state=EXCLUDED.state', [row.id, row.owner, row.name, row.avd, row.state]); },
  };
}
