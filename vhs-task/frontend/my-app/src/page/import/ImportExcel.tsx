'use client';

import React from "react"

import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { parseExcelFile } from '../utils/excelUtils';

interface ImportExcelProps {
  onImport: (data: any[]) => void;
  onClose: () => void;
  maxSize?: number; // in MB
}

export default function ImportExcel({ onImport, onClose, maxSize = 5 }: ImportExcelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size
    if (selectedFile.size > maxSize * 1024 * 1024) {
      setError(`File vượt quá ${maxSize}MB`);
      return;
    }

    // Validate file type
    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
      setError('Chỉ hỗ trợ file CSV hoặc XLSX');
      return;
    }

    setFile(selectedFile);
    setError('');

    try {
      setLoading(true);
      const data = await parseExcelFile(selectedFile);
      setPreview(data.slice(0, 3)); // Show first 3 rows
      setSuccess(true);
    } catch (err) {
      setError('Lỗi đọc file: ' + String(err));
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!file) {
      setError('Vui lòng chọn file');
      return;
    }

    setLoading(true);
    parseExcelFile(file)
      .then(data => {
        onImport(data);
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1000);
      })
      .catch(err => {
        setError('Lỗi import: ' + String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-2xl">
        <h2 className="text-2xl font-bold text-foreground mb-4">Import dữ liệu từ Excel</h2>

        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center mb-4">
          <Upload className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
          <label className="block">
            <span className="text-foreground font-medium cursor-pointer hover:text-blue-600">
              Chọn file CSV/XLSX
            </span>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
              disabled={loading}
            />
          </label>
          <p className="text-sm text-muted-foreground mt-2">
            Kích thước tối đa: {maxSize}MB
          </p>
          {file && (
            <p className="text-sm text-foreground mt-2">
              File: {file.name}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && preview.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-green-800 font-medium">Xác nhận file thành công ({preview.length}+ hàng)</p>
            </div>
            <div className="bg-white border rounded overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    {preview[0] && Object.keys(preview[0]).map(key => (
                      <th key={key} className="px-3 py-2 text-left text-gray-700">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className="border-t hover:bg-gray-50">
                      {Object.values(row).map((val, idx) => (
                        <td key={idx} className="px-3 py-2 text-gray-600">{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleImport}
            disabled={!file || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang import...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
