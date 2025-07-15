import React, { useState, useMemo } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Button, Box, TextField } from '@mui/material';
import * as XLSX from 'xlsx';
import xlsIcon from '../xls.png';
import './CollapsibleTable.css';

function CollapsibleTable({ data, explanation }) {
    const [filterModel, setFilterModel] = useState({ items: [] });

    const { columns, rows } = useMemo(() => {
        if (!data || !data.columns || !data.data) {
            return { columns: [], rows: [] };
        }
        const gridColumns = data.columns.map((col, index) => ({
            field: col,
            headerName: col,
            width: 150,
            type: 'string',
        }));
        const gridRows = data.data.map((row, rowIndex) => {
            let rowData = { id: rowIndex };
            data.columns.forEach((header, cellIndex) => {
                rowData[header] = row[cellIndex];
            });
            return rowData;
        });
        return { columns: gridColumns, rows: gridRows };
    }, [data]);

    const handleExport = () => {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, "table_export.xlsx");
    };

    if (!columns.length) {
        return (
            <div className="collapsible-table-container">
                <p>Could not parse table data.</p>
            </div>
        );
    }

    return (
        <div className="collapsible-table-container">
            {explanation && <p className="explanation-text">{explanation}</p>}
            <div className="table-toolbar">
                <Button onClick={handleExport} className="export-button">
                    <img src={xlsIcon} alt="Export to Excel" />
                </Button>
            </div>
            <Box sx={{ height: 400, width: '100%' }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    pageSize={5}
                    rowsPerPageOptions={[5]}
                    disableSelectionOnClick
                    filterModel={filterModel}
                    onFilterModelChange={(model) => setFilterModel(model)}
                    slots={{
                        toolbar: CustomToolbar,
                    }}
                    slotProps={{
                        toolbar: {
                            columns: columns,
                            onFilterChange: (field, value) => {
                                const newFilterModel = { ...filterModel };
                                const itemIndex = newFilterModel.items.findIndex(item => item.field === field);
                                if (itemIndex > -1) {
                                    if (value) {
                                        newFilterModel.items[itemIndex].value = value;
                                    } else {
                                        newFilterModel.items.splice(itemIndex, 1);
                                    }
                                } else if (value) {
                                    newFilterModel.items.push({ field, operator: 'contains', value });
                                }
                                setFilterModel(newFilterModel);
                            }
                        }
                    }}
                />
            </Box>
        </div>
    );
}

function CustomToolbar({ columns, onFilterChange }) {
    return (
        <Box sx={{ p: 1, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {columns.map((col) => (
                <TextField
                    key={col.field}
                    variant="standard"
                    label={col.headerName}
                    onChange={(e) => onFilterChange(col.field, e.target.value)}
                />
            ))}
        </Box>
    );
}

export default CollapsibleTable;
