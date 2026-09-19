import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, AlertCircle } from 'lucide-react';

export default function DocumentDropzone({ onUpload, isUploading }) {
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles, fileRejections) => {
      setErrorMsg('');
      if (fileRejections.length > 0) {
        setErrorMsg('Some files were rejected. Please only upload PDF, DOCX, TXT, or images (max 25MB each).');
        return;
      }

      if (acceptedFiles.length > 0) {
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
    maxSize: 25 * 1024 * 1024, // 25 MB
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
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
          {isDragActive ? 'Drop documents here...' : 'Click or drop documents to upload'}
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          PDF, DOCX, TXT, PNG, JPG (up to 25MB)
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
