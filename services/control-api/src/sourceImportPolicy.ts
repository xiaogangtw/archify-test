// Shared browser/server policy: upload application sources, not an entire checkout.
export const excludedSourceDirectory = /^(?:\.git|\.svn|\.hg|node_modules|dist|build|vendor|coverage|\.next|\.nuxt|\.output|\.cache|\.local|\.turbo|\.idea|\.vscode|\.github|docs?|tests?|__tests__|__mocks__|__snapshots__|fixtures|e2e|playwright-report|test-results|public|static|images|generated)$/i;
const sourceDirectory=/^(?:src|app|pages|components|hooks|lib|utils|services|api|routes|store|stores|types|styles)$/i;
const codeExtension=/\.(?:[cm]?[jt]sx?|css|scss|sass|less|html|vue|svelte|graphql|gql)$/i;
const configuration=/^(?:package\.json|(?:tsconfig|jsconfig)(?:\.[\w-]+)?\.json|(?:vite|next|nuxt|svelte|angular|astro|tailwind|postcss)\.config\.[cm]?[jt]s|index\.html)$/i;
export function isSourceImportPath(path:string):boolean {
  if(!path || path.length>1000 || path.startsWith('/') || /[\\:\x00-\x1f\x7f]/.test(path))return false;
  const parts=path.split('/');
  if(parts.some(part=>!part || part==='.' || part==='..' || excludedSourceDirectory.test(part)))return false;
  const name=parts[parts.length-1];
  if(/^(?:credentials(?:\.[\w-]+)?\.json|secrets?(?:\.[\w-]+)?\.json|\.env(?:\..*)?|(?:package-lock|npm-shrinkwrap)\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(name) || /\.(?:test|spec|stories|story|min|generated|gen)\.[^.]+$/i.test(name))return false;
  // The first component is the user-selected folder. Direct file selection has no prefix.
  const relative=parts.length>1?parts.slice(1):parts;
  const directories=relative.slice(0,-1);
  // Config inheritance often points into config/ or workspace folders outside src.
  if(/^(?:tsconfig|jsconfig)(?:\.[\w-]+)?\.json$/i.test(name))return true;
  if(configuration.test(name) && (!directories.length || directories.length===2 && /^(?:apps|packages)$/.test(directories[0])))return true;
  const inSource=parts.slice(0,-1).some(part=>sourceDirectory.test(part));
  return (inSource || !directories.length) && (codeExtension.test(name) || inSource && /\.json$/i.test(name));
}
