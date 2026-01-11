'use client';

import { useCallback, useState } from 'react';
import { Upload, FileArchive, X, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  maxSize?: number; // in MB
}

export function DropZone({ onFileSelect, disabled = false, maxSize = 50 }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (!file.name.endsWith('.zip')) {
      return '請上傳 ZIP 檔案';
    }
    if (file.size > maxSize * 1024 * 1024) {
      return `檔案大小不得超過 ${maxSize}MB`;
    }
    return null;
  }, [maxSize]);

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }
    setError(null);
    setSelectedFile(file);
    onFileSelect(file);
  }, [validateFile, onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, [disabled, handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer',
          {
            'border-blue-500 bg-blue-50 dark:bg-blue-950/20': isDragging,
            'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600': !isDragging && !selectedFile && !error,
            'border-green-500 bg-green-50 dark:bg-green-950/20': selectedFile && !error,
            'border-red-500 bg-red-50 dark:bg-red-950/20': error,
            'opacity-50 cursor-not-allowed': disabled,
          }
        )}
      >
        <input
          type="file"
          accept=".zip"
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />

        <div className="flex flex-col items-center gap-4 text-center">
          {selectedFile ? (
            <>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <FileArchive className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  <X className="w-4 h-4" />
                  移除
                </button>
              )}
            </>
          ) : error ? (
            <>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-medium text-red-600 dark:text-red-400">{error}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  點擊或拖放重試
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                <Upload className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  將 ZIP 檔拖放到這裡
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  或點擊選擇檔案（最大 {maxSize}MB）
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
