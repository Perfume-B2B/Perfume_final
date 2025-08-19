'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  X, 
  CheckCircle,
  AlertCircle,
  Download
} from 'lucide-react';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onFileProcessed: (data: {
    headers: string[];
    rows: any[];
    fileName: string;
    fileType: 'csv' | 'xlsx';
  }) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
}

export default function FileUpload({
  onFileProcessed,
  acceptedFileTypes = ['.csv', '.xlsx'],
  maxFileSize = 10 * 1024 * 1024 // 10MB default
}: FileUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    headers: string[];
    rows: any[];
    fileName: string;
    fileType: 'csv' | 'xlsx';
  } | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setError(null);
    setIsProcessing(true);

    try {
      // Validate file size
      if (file.size > maxFileSize) {
        throw new Error(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`);
      }

      // Validate file type
      const fileExtension = file.name.toLowerCase().split('.').pop();
      if (!acceptedFileTypes.some(type => type.includes(fileExtension || ''))) {
        throw new Error(`Unsupported file type. Please upload ${acceptedFileTypes.join(' or ')}`);
      }

      setUploadedFile(file);

      // Process file based on type
      if (fileExtension === 'csv') {
        await processCSVFile(file);
      } else if (fileExtension === 'xlsx') {
        await processXLSXFile(file);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setUploadedFile(null);
      setPreviewData(null);
    } finally {
      setIsProcessing(false);
    }
  }, [maxFileSize, acceptedFileTypes]);

  const processCSVFile = async (file: File) => {
    try {
      const text = await file.text();
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (records.length === 0) {
        throw new Error('CSV file contains no data rows');
      }

      const headers = Object.keys(records[0]);
      const rows = records.slice(0, 100); // Preview first 100 rows

      const data = {
        headers,
        rows,
        fileName: file.name,
        fileType: 'csv' as const
      };

      setPreviewData(data);
      onFileProcessed(data);

    } catch (err) {
      throw new Error(`Failed to parse CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const processXLSXFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        throw new Error('XLSX file contains no data rows');
      }

      const headers = Object.keys(jsonData[0] || {});
      const rows = jsonData.slice(0, 100);

      const data = {
        headers,
        rows,
        fileName: file.name,
        fileType: 'xlsx' as const,
      };

      setPreviewData(data);
      onFileProcessed(data);
    } catch (err) {
      throw new Error(`Failed to parse XLSX: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setPreviewData(null);
    setError(null);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: isProcessing
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Supplier File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
              }
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            
            <div className="space-y-4">
              <div className="flex justify-center">
                <Upload className="h-12 w-12 text-gray-400" />
              </div>
              
              <div>
                <p className="text-lg font-medium text-gray-900">
                  {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or click to select a file
                </p>
              </div>
              
              <div className="text-sm text-gray-500">
                <p>Supported formats: {acceptedFileTypes.join(', ')}</p>
                <p>Maximum size: {formatFileSize(maxFileSize)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Info */}
      {uploadedFile && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{uploadedFile.name}</p>
                  <p className="text-sm text-green-700">
                    {formatFileSize(uploadedFile.size)} • {uploadedFile.type || 'Unknown type'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={removeFile}>
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-blue-700">Processing file...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Data */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Data Preview
              <Badge variant="outline">{previewData.rows.length} rows</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {previewData.headers.map((header, index) => (
                      <th
                        key={index}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.rows.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {previewData.headers.map((header, colIndex) => (
                        <td
                          key={colIndex}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                        >
                          {row[header] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {previewData.rows.length > 5 && (
                <div className="mt-4 text-center text-sm text-gray-500">
                  Showing first 5 rows of {previewData.rows.length} total rows
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
