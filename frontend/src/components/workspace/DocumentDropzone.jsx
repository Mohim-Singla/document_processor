import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, AlertCircle } from 'lucide-react';

export default function DocumentDropzone({ onUpload, isUploading }) {
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles, fileRejections) => {
      setErrorMsg('');
      if (fileRejections.length > 0) {
        const hasTooMany = fileRejections.some((r) => r.errors?.some((e) => e.code === 'too-many-files'));
        if (hasTooMany) {
          setErrorMsg('Maximum 5 files can be uploaded at once.');
          return;
        }
        setErrorMsg('Some files were rejected. Supported formats: PDF, DOCX, TXT, MD, CSV, TSV, JSON, XML, HTML, YAML, LOG, or images (max 5 files, 10MB each).');
        return;
      }

      if (acceptedFiles.length > 0) {
        if (acceptedFiles.length > 5) {
          setErrorMsg('Maximum 5 files can be uploaded at once.');
          return;
        }
        try {
          await onUpload(acceptedFiles);
        } catch (err) {
          setErrorMsg(err.message || 'Failed to upload files');
        }
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noKeyboard: true,
    disabled: isUploading,
    maxSize: 10 * 1024 * 1024, // 10 MB
    maxFiles: 5,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt', '.log'],
      'text/markdown': ['.md', '.markdown'],
      'text/x-markdown': ['.md', '.markdown'],
      'text/csv': ['.csv'],
      'application/csv': ['.csv'],
      'text/x-csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'text/tsv': ['.tsv'],
      'application/json': ['.json'],
      'text/json': ['.json'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
      'text/html': ['.html', '.htm'],
      'application/x-yaml': ['.yaml', '.yml'],
      'text/yaml': ['.yaml', '.yml'],
      'text/x-yaml': ['.yaml', '.yml'],
      'text/x-log': ['.log'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
      'image/bmp': ['.bmp'],
      'image/tiff': ['.tiff', '.tif'],
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <div
        {...getRootProps({
          tabIndex: -1,
          onKeyDown: (e) => {
            e.stopPropagation();
            e.preventDefault();
          },
        })}
        data-dropzone="true"
        className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 text-center ${
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-900/60'
        } ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 mb-2">
          <UploadCloud className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-xs font-semibold text-slate-200">
          {isDragActive ? 'Drop documents here (max 5)...' : 'Click or drop documents to upload'}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          PDF, DOCX, TXT, MD, CSV, JSON, XML, YAML, HTML, LOG, Images (max 5 files, up to 10MB each)
        </p>
        {isUploading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-indigo-400">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            Uploading to S3 & queueing OCR...
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-2.5 text-xs text-red-400 bg-red-950/40 border border-red-900/60 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
