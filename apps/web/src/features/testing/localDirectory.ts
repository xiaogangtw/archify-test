import { excludedSourceDirectory } from '../../../../../services/control-api/src/sourceImportPolicy';
import { selectSourceFiles } from './sourceImportModel';
interface LocalFile {kind:'file';name:string;getFile:()=>Promise<File>}
interface LocalDirectory {kind:'directory';name:string;values:()=>AsyncIterable<LocalDirectory|LocalFile>}
type DesktopPicker = (options:{startIn:'desktop';mode:'read'})=>Promise<LocalDirectory>;
export function desktopPicker():DesktopPicker|undefined {
  const picker=(window as Window & {showDirectoryPicker?:DesktopPicker}).showDirectoryPicker;
  return picker?.bind(window);
}
export async function readDirectory(directory:LocalDirectory):Promise<{files:File[];skipped:number}> {
  const files:File[]=[];
  let visited=0;
  let skipped=0;
  async function visit(folder:LocalDirectory,prefix:string) {
    if(prefix.length>1000)throw new Error('資料夾路徑過長。');
    for await(const entry of folder.values()) {
      if(++visited>100000)throw new Error('資料夾項目超過 100,000 個，請選擇較小的專案範圍。');
      if(entry.kind==='directory') {
        if(!excludedSourceDirectory.test(entry.name))await visit(entry,`${prefix}/${entry.name}`);
        else skipped++;
      } else {
        const file=await entry.getFile();
        Object.defineProperty(file,'webkitRelativePath',{value:`${prefix}/${entry.name}`});
        if(selectSourceFiles([file]).files.length) {
          files.push(file);
          if(files.length>10000)throw new Error('最多匯入 10,000 個檔案。');
        } else skipped++;
      }
    }
  }
  await visit(directory,directory.name);
  selectSourceFiles(files);
  return {files,skipped};
}
