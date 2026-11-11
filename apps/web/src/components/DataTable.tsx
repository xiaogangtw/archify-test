import {cx,useCompactUi} from './ui/controls';
interface Props {
  columns: string[];
  rows: string[][];
  query?: string;
}

export function DataTable({ columns, rows, query = '' }: Props) {
  const compact=useCompactUi();
  const filtered = rows.filter(row =>
    row.join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );

  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full border-collapse text-left',compact?'text-menu':'text-body')}>
        <thead>
          <tr className="border-b border-line text-muted">
            {columns.map(column => (
              <th key={column} scope="col" className={cx('whitespace-nowrap font-medium',compact?'px-2 py-2':'px-4 py-3')}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length ? filtered.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={cx('align-top',compact?'px-2 py-2':'px-4 py-4 leading-6')}>
                  {cell}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                沒有符合條件的資料。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

