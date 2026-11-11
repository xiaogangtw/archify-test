import {cx} from '../../components/ui/controls';
import type {ConnectionView} from './modelConnections';
export function ConnectionLight({connection}:{connection:ConnectionView}) {
 const state=connection.health.state;
 return <span className="inline-flex items-center gap-2 text-body"><span aria-hidden="true" className={cx('h-3 w-3 shrink-0 rounded-lg',state==='passed'?'bg-success':state==='failed'?'bg-danger':state==='checking'?'bg-warning':'bg-muted')}/><span>{connection.health.message}</span></span>;
}
