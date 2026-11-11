type Navigation=()=>void|Promise<void>;
let guard:((navigation:Navigation)=>void)|undefined;
export function installNavigationGuard(next:(navigation:Navigation)=>void){guard=next;return()=>{if(guard===next)guard=undefined;};}
export function requestNavigation(navigation:Navigation){if(guard)guard(navigation);else void navigation();}
