import type { PageId } from '../../types';
import { Panel } from '../../components/Panel';
import { Button } from '../../components/ui/controls';
export function GitConnections({onNavigate}:{onNavigate:(page:PageId)=>void}) {
  return <div className="space-y-5">
    <Panel title="本機 Git 與憑證">
      <div className="space-y-5">
        <p className="text-body">在自己的電腦使用 Git 或 IDE 登入。憑證由本機 Git Credential Manager／Windows 認證管理員管理，不填入網頁，也不送到 Archify 後端或 VM。</p>
        <ol className="list-inside list-decimal space-y-3 text-body">
          <li>在本機 Git 或 IDE 登入 GitLab，將專案拉取到電腦。</li>
          <li>到「測試專案」選擇「匯入本機資料夾」。</li>
          <li>更新程式碼時，先在本機拉取，再重新選擇資料夾匯入。</li>
        </ol>
        <Button variant="primary" onClick={()=>onNavigate('projects')}>前往測試專案</Button>
      </div>
    </Panel>
    <section className="space-y-3 rounded-xl border border-line bg-surface p-5 md:p-6">
      <h2 className="text-heading font-bold">目前支援範圍</h2>
      <p className="text-body text-muted">已支援本機資料夾匯入。本機 Git 一鍵登入、拉取與憑證狀態讀取尚未接入，這個頁面不會宣稱已連線。</p>
      <p className="text-body text-muted">既有 VM Git 來源仍使用原連線設定，尚未改成本機 Git。匯入仍會把篩選後的程式碼快照送到 Archify；Git 憑證不隨檔案匯入。</p>
    </section>
  </div>;
}
