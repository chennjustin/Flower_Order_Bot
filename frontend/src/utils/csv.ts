/** Build a UTF-8 CSV blob from headers + rows. Cells are wrapped in quotes and escaped. */
export function rowsToCsvBlob(headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<unknown>>): Blob {
  const escape = (cell: unknown): string =>
    `"${String(cell ?? '').replace(/"/g, '""')}"`

  const csv = [headers, ...rows]
    .map(row => row.map(escape).join(','))
    .join('\n')

  const bom = '\uFEFF'
  return new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
}
