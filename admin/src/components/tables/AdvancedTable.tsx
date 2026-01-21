'use client';

import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { 
  ChevronUpDownIcon, 
  ChevronDownIcon, 
  ChevronUpIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon 
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AdvancedTableProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  title?: string;
  searchPlaceholder?: string;
  enableExport?: boolean;
  pageSize?: number;
  pageSizeOptions?: number[];
}

export default function AdvancedTable<T>({ 
  data, 
  columns, 
  title,
  searchPlaceholder = 'Buscar...',
  enableExport = true,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50]
}: AdvancedTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, `${title || 'export'}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableData = data.map((row: any) => 
      columns.map(col => {
        const accessor = col.id || (col as any).accessorKey;
        return row[accessor] || '';
      })
    );
    const headers = columns.map(col => (col as any).header || col.id);

    autoTable(doc, {
      head: [headers],
      body: tableData,
      styles: { fontSize: 8 },
    });

    doc.save(`${title || 'export'}.pdf`);
  };

  return (
    <div className="sp-card sp-card-static">
      <div className="sp-card-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={globalFilter ?? ''}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder={searchPlaceholder}
                className="sp-input pl-10"
              />
            </div>
            
            {enableExport && (
              <div className="flex gap-2">
                <button
                  onClick={exportToExcel}
                  className="sp-button sp-button-outline"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  Excel
                </button>
                <button
                  onClick={exportToPDF}
                  className="sp-button sp-button-outline"
                >
                  <ArrowDownTrayIcon className="h-5 w-5" />
                  PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="sp-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    className="text-left"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={header.column.getCanSort() ? 'flex items-center gap-2 cursor-pointer select-none' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span>
                            {header.column.getIsSorted() === 'asc' ? (
                              <ChevronUpIcon className="h-4 w-4" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                              <ChevronUpDownIcon className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="sp-card-body flex items-center justify-between border-t border-[var(--border)]">
          <div className="text-sm sp-muted">
            Mostrando {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} a{' '}
            {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length)} de{' '}
            {data.length} resultados
          </div>
          
          <div className="flex items-center gap-2">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="sp-select"
              aria-label="Registros por pagina"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} por pagina
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className="sp-button sp-button-outline"
              >
                Primera
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="sp-button sp-button-outline"
              >
                Anterior
              </button>

              {Array.from({ length: table.getPageCount() }, (_, i) => i)
                .filter((i) => {
                  const current = table.getState().pagination.pageIndex;
                  return i === 0 || i === table.getPageCount() - 1 || Math.abs(i - current) <= 1;
                })
                .map((i, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev !== undefined && i - prev > 1;
                  return (
                    <span key={`page-${i}`} className="flex items-center gap-2">
                      {showEllipsis && <span className="px-2 sp-muted">...</span>}
                      <button
                        onClick={() => table.setPageIndex(i)}
                        className={`sp-button ${table.getState().pagination.pageIndex === i ? 'sp-button-primary' : 'sp-button-outline'}`}
                        aria-current={table.getState().pagination.pageIndex === i ? 'page' : undefined}
                      >
                        {i + 1}
                      </button>
                    </span>
                  );
                })}

              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="sp-button sp-button-outline"
              >
                Siguiente
              </button>
              <button
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className="sp-button sp-button-outline"
              >
                Ultima
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
