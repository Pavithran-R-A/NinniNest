export interface ColumnDef {
  name: string;
  ddl: string;
}

// Pure helper for idempotent migrations: given the columns a table already has
// (from PRAGMA table_info) and the columns a schema version requires, returns
// only the ones that still need their ALTER TABLE. A migration interrupted
// mid-way can simply be re-run — the second pass finds nothing to add.
export function missingColumns(existing: string[], defs: ColumnDef[]): ColumnDef[] {
  const have = new Set(existing);
  return defs.filter((d) => !have.has(d.name));
}
