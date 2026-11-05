import { useId, useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatFileSize } from '@/utils/formatCurrency';
import { DOCUMENT_ALLOWED_EXTENSIONS, DOCUMENT_MAX_BYTES } from '@/utils/constants';

export function validateFile(file, { extensions = DOCUMENT_ALLOWED_EXTENSIONS, maxBytes = DOCUMENT_MAX_BYTES } = {}) {
  if (!file) return 'Choose a file';
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extensions.includes(extension)) return `Allowed file types: ${extensions.join(', ')}`;
  if (file.size === 0) return 'The file is empty';
  if (file.size > maxBytes) return `The file exceeds ${formatFileSize(maxBytes)}`;
  return null;
}

/** File picker with drag & drop, client-side type/size checks and an optional progress bar. */
export default function FileDrop({ file, onFile, progress, extensions = DOCUMENT_ALLOWED_EXTENSIONS, maxBytes = DOCUMENT_MAX_BYTES, className, label = 'File' }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const pick = (selected) => {
    const message = validateFile(selected, { extensions, maxBytes });
    setError(message);
    onFile(message ? null : selected);
  };

  return (
    <div className={className}>
      <label htmlFor={inputId} className="label-base">
        {label}
        <span className="ml-0.5 text-red-600" aria-hidden="true">
          *
        </span>
      </label>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
          </div>
          {progress === null || progress === undefined ? (
            <button type="button" onClick={() => onFile(null)} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Remove file">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <div className="w-40" aria-label={`Upload ${progress}%`} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-right text-xs text-slate-500">{progress}%</p>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files?.[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-slate-400',
            error && 'border-red-300',
          )}
        >
          <FileUp className="h-6 w-6 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium text-brand-700">Choose a file</span> or drag it here
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {extensions.join(', ').toUpperCase()} · up to {formatFileSize(maxBytes)}
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={extensions.map((extension) => `.${extension}`).join(',')}
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
