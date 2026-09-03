export default function Table({ columns, data, onRowClick }) {
    return (
        <div className="overflow-x-auto min-w-full -mx-4 sm:mx-0 shadow-xs border-b sm:border border-gray-200 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/90 backdrop-blur-xs sticky top-0 z-10">
                    <tr className="border-b border-gray-200">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                                style={{ width: col.width }}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {data.map((row, idx) => (
                        <tr
                            key={row._id || idx}
                            onClick={() => onRowClick?.(row)}
                            className={`${onRowClick ? 'cursor-pointer hover:bg-emerald-50/50' : ''} transition-colors min-h-[44px]`}
                        >
                            {columns.map((col) => (
                                <td key={col.key} className="px-4 py-3.5 text-sm text-gray-900 whitespace-nowrap">
                                    {col.render ? col.render(row) : (row[col.key] ?? '-')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}