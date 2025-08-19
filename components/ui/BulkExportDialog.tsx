"use client";

import { useState } from "react";
import { Download, Plus, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";

interface ExportConfig {
  type: "PRODUCT" | "ORDER" | "CUSTOMER";
  format: "CSV" | "EXCEL";
  columns: string[];
  filters?: Record<string, unknown>;
}

interface ExportResult {
  fileBuffer: string;
  contentType: string;
  filename: string;
}

interface BulkExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_COLUMNS = {
  PRODUCT: [
    { key: "name", label: "Product Naam" },
    { key: "brand", label: "Merk" },
    { key: "content", label: "Inhoud/Grootte" },
    { key: "ean", label: "EAN Code" },
    { key: "purchasePrice", label: "Inkoopprijs" },
    { key: "retailPrice", label: "Verkoopprijs" },
    { key: "stockQuantity", label: "Voorraad" },
    { key: "maxOrderQuantity", label: "Max Bestelling" },
    { key: "rating", label: "Sterren" },
    { key: "category", label: "Categorie" },
    { key: "subcategory", label: "Subcategorie" },
    { key: "isAvailable", label: "Beschikbaar" },
    { key: "description", label: "Beschrijving" },
    { key: "tags", label: "Tags" },
    { key: "createdAt", label: "Aangemaakt" },
    { key: "updatedAt", label: "Bijgewerkt" },
  ],
  ORDER: [
    { key: "id", label: "Order ID" },
    { key: "customerName", label: "Klant Naam" },
    { key: "customerEmail", label: "Klant Email" },
    { key: "status", label: "Status" },
    { key: "totalAmount", label: "Totaal Bedrag" },
    { key: "itemCount", label: "Aantal Items" },
    { key: "createdAt", label: "Aangemaakt" },
    { key: "updatedAt", label: "Bijgewerkt" },
  ],
  CUSTOMER: [
    { key: "name", label: "Klant Naam" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefoon" },
    { key: "address", label: "Adres" },
    { key: "city", label: "Stad" },
    { key: "postalCode", label: "Postcode" },
    { key: "country", label: "Land" },
    { key: "isActive", label: "Actief" },
    { key: "createdAt", label: "Aangemaakt" },
    { key: "updatedAt", label: "Bijgewerkt" },
  ],
};

export default function BulkExportDialog({ isOpen, onClose }: BulkExportDialogProps) {
  const [exportConfigs, setExportConfigs] = useState<ExportConfig[]>([]);
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState<ExportResult[]>([]);
  const [errors, setErrors] = useState<Record<string, unknown>[]>([]);

  const addExportConfig = () => {
    setExportConfigs((prev) => [
      ...prev,
      {
        type: "PRODUCT",
        format: "CSV",
        columns: AVAILABLE_COLUMNS.PRODUCT.map((col) => col.key),
      },
    ]);
  };

  const removeExportConfig = (index: number) => {
    setExportConfigs((prev) => prev.filter((_, i) => i !== index));
  };

  const updateExportConfig = (index: number, updates: Partial<ExportConfig>) => {
    setExportConfigs((prev) =>
      prev.map((config, i) => (i === index ? { ...config, ...updates } : config)),
    );
  };

  const toggleColumn = (configIndex: number, columnKey: string) => {
    setExportConfigs((prev) =>
      prev.map((config, i) => {
        if (i === configIndex) {
          const newColumns = config.columns.includes(columnKey)
            ? config.columns.filter((col) => col !== columnKey)
            : [...config.columns, columnKey];
          return { ...config, columns: newColumns };
        }
        return config;
      }),
    );
  };

  const handleBulkExport = async () => {
    if (exportConfigs.length === 0) {
      alert("Please add at least one export configuration");
      return;
    }

    setExporting(true);
    setResults([]);
    setErrors([]);

    try {
      const response = await fetch("/api/admin/export/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exports: exportConfigs,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setErrors(data.errors || []);

        // Download files
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((result: Record<string, unknown>) => {
            if (result && typeof result === 'object') {
              const blob = new Blob([Buffer.from(String(result.fileBuffer), "base64")], {
                type: String(result.contentType),
              });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = String(result.filename);
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }
          });
        }

        if (data.errors?.length > 0) {
          alert(
            `Export completed with ${data.successfulExports} successful exports and ${data.failedExports} failures.`,
          );
        } else {
          alert(`Successfully exported ${data.successfulExports} files!`);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }
    } catch (error) {
      console.error("Bulk export error:", error);
      alert(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    setExportConfigs([]);
    setResults([]);
    setErrors([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Download className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Bulk Export</h3>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Export Configurations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900">Export Configurations</h4>
              <button
                onClick={addExportConfig}
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-md hover:bg-blue-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Export
              </button>
            </div>

            {exportConfigs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Download className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No export configurations added</p>
                <p className="text-sm">Click &quot;Add Export&quot; to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                {exportConfigs.map((config, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="font-medium text-gray-900">
                        Export {index + 1}: {config.type}
                      </h5>
                      <button
                        onClick={() => removeExportConfig(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data Type
                        </label>
                        <select
                          value={config.type}
                          onChange={(e) =>
                            updateExportConfig(index, {
                              type: e.target.value as "PRODUCT" | "ORDER" | "CUSTOMER",
                              columns: AVAILABLE_COLUMNS[
                                e.target.value as keyof typeof AVAILABLE_COLUMNS
                              ].map((col) => col.key),
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="PRODUCT">Products</option>
                          <option value="ORDER">Orders</option>
                          <option value="CUSTOMER">Customers</option>
                        </select>
                      </div>

                      {/* Format Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Format
                        </label>
                        <select
                          value={config.format}
                          onChange={(e) =>
                            updateExportConfig(index, { format: e.target.value as "CSV" | "EXCEL" })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="CSV">CSV</option>
                          <option value="EXCEL">Excel</option>
                        </select>
                      </div>
                    </div>

                    {/* Column Selection */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Columns
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {AVAILABLE_COLUMNS[config.type].map((column) => (
                          <label
                            key={column.key}
                            className="flex items-center space-x-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={config.columns.includes(column.key)}
                              onChange={() => toggleColumn(index, column.key)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{column.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {(results.length > 0 || errors.length > 0) && (
            <div className="border-t pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Export Results</h4>

              {results.length > 0 && (
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-green-700 mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Successful Exports ({results.length})
                  </h5>
                  <div className="space-y-2">
                    {results.map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-green-50 rounded"
                      >
                        <span className="text-sm text-green-800">{String(result.filename)}</span>
                        <span className="text-xs text-green-600">
                          {"recordCount" in result ? String(result.recordCount) : ""} records
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {errors.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-red-700 mb-2 flex items-center">
                    <XCircle className="w-4 h-4 mr-1" />
                    Failed Exports ({errors.length})
                  </h5>
                  <div className="space-y-2">
                    {errors.map((error, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-red-50 rounded"
                      >
                        <span className="text-sm text-red-800">{String(error.type)}</span>
                        <span className="text-xs text-red-600">{String(error.error)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={handleBulkExport}
              disabled={exporting || exportConfigs.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{exporting ? "Exporting..." : "Start Bulk Export"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
