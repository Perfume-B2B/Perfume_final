"use client";

import { useState, useEffect } from "react";

// Product field types based on Prisma schema
export type ProductField =
  | "name"
  | "brand"
  | "content"
  | "ean"
  | "purchasePrice"
  | "retailPrice"
  | "stockQuantity"
  | "maxOrderableQuantity"
  | "starRating"
  | "category"
  | "subcategory"
  | "description"
  | "tags";

// Field information for UI display
export const PRODUCT_FIELDS: Record<
  ProductField,
  {
    label: string;
    required: boolean;
    description: string;
    example: string;
  }
> = {
  name: {
    label: "Productnaam",
    required: true,
    description: "De naam van het product",
    example: "Aventus",
  },
  brand: {
    label: "Merk",
    required: true,
    description: "Het merk van het product",
    example: "Creed",
  },
  content: {
    label: "Inhoud",
    required: true,
    description: "De inhoud/grootte van het product",
    example: "100ml",
  },
  ean: {
    label: "EAN Code",
    required: true,
    description: "13-cijferige EAN barcode",
    example: "1234567890123",
  },
  purchasePrice: {
    label: "Inkoopprijs",
    required: true,
    description: "De inkoopprijs van het product",
    example: "25.50",
  },
  retailPrice: {
    label: "Verkoopprijs",
    required: true,
    description: "De verkoopprijs van het product",
    example: "45.00",
  },
  stockQuantity: {
    label: "Voorraad",
    required: true,
    description: "Aantal stuks op voorraad",
    example: "100",
  },
  maxOrderableQuantity: {
    label: "Max Bestelbaar",
    required: false,
    description: "Maximum aantal bestelbaar per klant",
    example: "10",
  },
  starRating: {
    label: "Sterrenrating",
    required: false,
    description: "Populariteit rating (0-5 sterren)",
    example: "4",
  },
  category: {
    label: "Categorie",
    required: false,
    description: "Hoofdcategorie van het product",
    example: "Eau de Parfum",
  },
  subcategory: {
    label: "Subcategorie",
    required: false,
    description: "Subcategorie van het product",
    example: "Oriental",
  },
  description: {
    label: "Beschrijving",
    required: false,
    description: "Uitgebreide productbeschrijving",
    example: "Een verleidelijke geur...",
  },
  tags: {
    label: "Tags",
    required: false,
    description: "Zoekwoorden voor het product",
    example: "luxe,oriental,unisex",
  },
};

export interface ColumnMapping {
  [columnName: string]: ProductField | null;
}

export interface ColumnMapperProps {
  headers?: string[];
  onMappingChange: (mapping: ColumnMapping) => void;
  initialMapping?: ColumnMapping;
}

export default function ColumnMapper({
  headers = [],
  onMappingChange,
  initialMapping,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping || {});
  const [autoMapped, setAutoMapped] = useState<Set<string>>(new Set());

  // Auto-map columns based on header names
  useEffect(() => {
    const newMapping: ColumnMapping = {};
    const newAutoMapped = new Set<string>();

    // Add safety check for headers
    if (Array.isArray(headers)) {
      headers.forEach((header) => {
        const normalizedHeader = header.toLowerCase().trim();

        // Try to auto-map based on exact matches or common variations
        for (const [field, fieldInfo] of Object.entries(PRODUCT_FIELDS)) {
          const fieldVariations = [
            field.toLowerCase(),
            fieldInfo.label.toLowerCase(),
            fieldInfo.label.toLowerCase().replace(/\s+/g, ""),
            fieldInfo.label.toLowerCase().replace(/\s+/g, "_"),
            fieldInfo.label.toLowerCase().replace(/\s+/g, "-"),
          ];

          if (fieldVariations.includes(normalizedHeader)) {
            newMapping[header] = field as ProductField;
            newAutoMapped.add(header);
            break;
          }
        }

        // If no auto-mapping found, set to null
        if (!newMapping[header]) {
          newMapping[header] = null;
        }
      });
    }

    setMapping(newMapping);
    setAutoMapped(newAutoMapped);
    onMappingChange(newMapping);
  }, [headers, onMappingChange]);

  const handleMappingChange = (columnName: string, field: ProductField | null) => {
    const newMapping = { ...mapping, [columnName]: field };
    setMapping(newMapping);
    onMappingChange(newMapping);
  };

  // Get validation status
  const requiredFields = Object.entries(PRODUCT_FIELDS)
    .filter(([, info]) => info.required)
    .map(([field]) => field as ProductField);

  const mappedRequiredFields = new Set(
    Object.values(mapping).filter((field) => field && requiredFields.includes(field)),
  );

  const missingRequiredFields = requiredFields.filter((field) => !mappedRequiredFields.has(field));
  const isMappingValid = missingRequiredFields.length === 0;

  // Get field usage count for duplicate detection
  const fieldUsageCount: Record<ProductField, number> = {} as Record<ProductField, number>;
  if (mapping && typeof mapping === 'object') {
    Object.values(mapping).forEach((field) => {
      if (field) {
        fieldUsageCount[field] = (fieldUsageCount[field] || 0) + 1;
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Kolom Mapping</h3>
        <p className="text-sm text-gray-600">
          Koppel elke kolom uit je bestand aan een productveld. Automatisch gematchte kolommen zijn
          groen gemarkeerd.
        </p>
      </div>

      {/* Validation Status */}
      {!isMappingValid && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Verplichte velden ontbreken</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>De volgende verplichte velden moeten nog gemapt worden:</p>
                <ul className="list-disc list-inside mt-1">
                  {missingRequiredFields.map((field) => (
                    <li key={field} className="font-medium">
                      {PRODUCT_FIELDS[field].label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {isMappingValid && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Alle verplichte velden gemapt</h3>
              <p className="mt-1 text-sm text-green-700">
                Je kunt nu doorgaan naar de volgende stap.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Column Mapping Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Kolom Mapping</h4>
        </div>
        <div className="divide-y divide-gray-200">
          {headers && headers.length > 0 ? headers.map((header) => {
            const isAutoMapped = autoMapped.has(header);
            const selectedField = mapping[header];
            const usageCount = selectedField ? fieldUsageCount[selectedField] : 0;
            const hasDuplicate = selectedField && usageCount > 1;

            return (
              <div key={header} className={`px-6 py-4 ${isAutoMapped ? "bg-green-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1">
                          {header}
                          {isAutoMapped && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Auto-gematcht
                            </span>
                          )}
                          {hasDuplicate && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Duplicaat
                            </span>
                          )}
                        </label>
                        {selectedField && (
                          <p className="text-xs text-gray-500">
                            {PRODUCT_FIELDS[selectedField].description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    <select
                      value={selectedField || ""}
                      onChange={(e) =>
                        handleMappingChange(header, (e.target.value as ProductField) || null)
                      }
                      className={`block w-64 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isAutoMapped
                          ? "border-green-300 bg-green-50"
                          : hasDuplicate
                            ? "border-yellow-300 bg-yellow-50"
                            : "border-gray-300"
                      }`}
                    >
                      <option value="">-- Selecteer veld --</option>
                      {Object.entries(PRODUCT_FIELDS).map(([field, fieldInfo]) => (
                        <option key={field} value={field}>
                          {fieldInfo.label} {fieldInfo.required ? "*" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Field information when selected */}
                {selectedField && (
                  <div className="mt-2 text-xs text-gray-600">
                    <p>
                      <strong>Voorbeeld:</strong> {PRODUCT_FIELDS[selectedField].example}
                    </p>
                    {hasDuplicate && (
                      <p className="text-yellow-600 mt-1">
                        ⚠️ Dit veld wordt ook gebruikt voor:{" "}
                        {headers
                          .filter((h) => h !== header && mapping[h] === selectedField)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="px-6 py-8 text-center text-gray-500">
              <p>Geen kolommen beschikbaar. Upload eerst een bestand.</p>
            </div>
          )}
        </div>
      </div>

      {/* Field Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Veld Informatie</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(PRODUCT_FIELDS).map(([field, fieldInfo]) => (
            <div key={field} className="text-sm">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-gray-900">{fieldInfo.label}</span>
                {fieldInfo.required && <span className="text-red-500">*</span>}
              </div>
              <p className="text-gray-600 mt-1">{fieldInfo.description}</p>
              <p className="text-gray-500 text-xs mt-1">Voorbeeld: {fieldInfo.example}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
