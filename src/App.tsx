import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  RotateCw, 
  Download, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  X,
  FilePlus,
  RefreshCw,
  Info,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, degrees } from 'pdf-lib';

// Set up PDF.js Worker
// For local development and build compatibility, we can assign the worker class directly.
// This is the cleanest React/Vite-compatible setup for pdfjs-dist.
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFPageItem {
  id: string; // unique ID for key and drag-drop
  fileId: string; // which file this page belongs to
  fileName: string; // name of the source file
  originalPageNumber: number; // 0-indexed page number in the original file
  rotation: number; // degrees: 0, 90, 180, 270
  thumbnailUrl: string; // Data URL of the page preview
  width: number;
  height: number;
}

interface LoadedFile {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  arrayBuffer: ArrayBuffer;
}

export default function App() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [pages, setPages] = useState<PDFPageItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [previewPage, setPreviewPage] = useState<PDFPageItem | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Show status messages briefly
  const showStatus = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMessage({ text, type });
    if (type !== 'error') {
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Helper to generate a random ID
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Load and render PDF pages
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;
    
    setIsLoading(true);
    showStatus('Memuat berkas PDF...', 'info');

    try {
      const newFiles: LoadedFile[] = [];
      const newPages: PDFPageItem[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
          showStatus(`File ${file.name} bukan PDF yang valid.`, 'error');
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const fileId = generateId();

        // Load document with pdf.js to render pages
        // Convert arrayBuffer to a Uint8Array which is safer and fully supported by PDF.js
        // We slice / copy it so that we don't detach or lose ownership of the buffer
        const typedArray = new Uint8Array(arrayBuffer.slice(0));
        const loadingTask = pdfjsLib.getDocument({ data: typedArray });
        const pdfDoc = await loadingTask.promise;
        const pageCount = pdfDoc.numPages;

        newFiles.push({
          id: fileId,
          name: file.name,
          size: file.size,
          pageCount,
          arrayBuffer: arrayBuffer.slice(0) // Save a copy to prevent detached buffer issues
        });

        // Extract pages & render thumbnails
        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 0.3 }); // Small scale for thumbnail
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport
            } as any).promise;
          }

          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);

          newPages.push({
            id: generateId(),
            fileId,
            fileName: file.name,
            originalPageNumber: pageNum - 1, // 0-indexed
            rotation: 0,
            thumbnailUrl,
            width: viewport.width,
            height: viewport.height
          });
        }
      }

      setFiles(prev => [...prev, ...newFiles]);
      setPages(prev => [...prev, ...newPages]);
      showStatus(`Berhasil memuat ${fileList.length} file PDF!`, 'success');
    } catch (error) {
      console.error('Error loading PDF:', error);
      showStatus('Gagal memproses file PDF. Pastikan file tidak rusak.', 'error');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updatedPages = [...pages];
    const [draggedPage] = updatedPages.splice(draggedIndex, 1);
    updatedPages.splice(targetIndex, 0, draggedPage);

    setPages(updatedPages);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Reorder buttons (alternate to drag and drop)
  const movePage = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    const updatedPages = [...pages];
    const [page] = updatedPages.splice(index, 1);
    updatedPages.splice(targetIndex, 0, page);
    setPages(updatedPages);
  };

  // Rotate page
  const rotatePage = (index: number) => {
    const updatedPages = [...pages];
    updatedPages[index] = {
      ...updatedPages[index],
      rotation: (updatedPages[index].rotation + 90) % 360
    };
    setPages(updatedPages);
  };

  // Delete page
  const deletePage = (index: number) => {
    const updatedPages = [...pages];
    updatedPages.splice(index, 1);
    setPages(updatedPages);
  };

  // Clear all pages and files
  const clearAll = () => {
    setFiles([]);
    setPages([]);
    setPreviewPage(null);
    showStatus('Semua halaman dan berkas telah dibersihkan.', 'info');
  };

  // Merge and Export the PDF
  const exportPDF = async () => {
    if (pages.length === 0) {
      showStatus('Tidak ada halaman untuk diekspor!', 'error');
      return;
    }

    setIsLoading(true);
    showStatus('Menyusun PDF baru...', 'info');

    try {
      const mergedPdf = await PDFDocument.create();

      // Cache loaded pdf-lib documents to avoid loading them repeatedly
      const pdfLibDocsCache: Record<string, PDFDocument> = {};

      for (const pageItem of pages) {
        const sourceFile = files.find(f => f.id === pageItem.fileId);
        if (!sourceFile) {
          throw new Error(`File dengan ID ${pageItem.fileId} tidak ditemukan.`);
        }

        // Load document if not in cache
        if (!pdfLibDocsCache[pageItem.fileId]) {
          // Send a sliced copy to prevent detaching/modifying the original buffer
          pdfLibDocsCache[pageItem.fileId] = await PDFDocument.load(sourceFile.arrayBuffer.slice(0));
        }

        const srcDoc = pdfLibDocsCache[pageItem.fileId];
        
        // Copy the specific page
        const [copiedPage] = await mergedPdf.copyPages(srcDoc, [pageItem.originalPageNumber]);
        
        // Apply rotation adjustment if any
        if (pageItem.rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees((currentRotation + pageItem.rotation) % 360));
        }

        mergedPdf.addPage(copiedPage);
      }

      // Save PDF and trigger download
      const mergedPdfBytes = await mergedPdf.save();
      // Ensure mergedPdfBytes is casted or structured appropriately for Blob constructor in TS
      const blob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'edited_document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showStatus('PDF berhasil diekspor dan diunduh!', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showStatus('Gagal mengekspor PDF baru.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Format file size
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-red-500 text-white p-2.5 rounded-lg shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 m-0">Urbays PDF Editor</h1>
              <p className="text-xs text-slate-500 m-0">Atur ulang, rotasi, hapus, dan gabung halaman PDF secara visual</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-950 text-white hover:bg-slate-800 rounded-lg text-sm font-semibold transition cursor-pointer shadow-xs"
              disabled={isLoading}
            >
              <FilePlus className="h-4 w-4" />
              <span>Tambah PDF</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".pdf"
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex flex-col gap-6">
        
        {/* Status Messages */}
        {statusMessage && (
          <div className={`p-4 rounded-xl border flex items-start space-x-3 transition-all ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : statusMessage.type === 'error' 
              ? 'bg-rose-50 border-rose-200 text-rose-800' 
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : statusMessage.type === 'error' ? (
              <X className="h-5 w-5 shrink-0 text-rose-600" />
            ) : (
              <Info className="h-5 w-5 shrink-0 text-blue-600" />
            )}
            <span className="text-sm font-medium">{statusMessage.text}</span>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center space-y-4 max-w-xs w-full text-center">
              <RefreshCw className="h-10 w-10 text-red-500 animate-spin" />
              <p className="text-slate-800 font-semibold">Sedang diproses...</p>
              <p className="text-xs text-slate-500">Mohon tunggu beberapa saat untuk pemrosesan file PDF.</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {pages.length === 0 && (
          <div className="flex-1 border-2 border-dashed border-slate-300 rounded-3xl bg-white p-12 flex flex-col items-center justify-center text-center shadow-xs">
            <div className="bg-red-50 p-6 rounded-full mb-4">
              <Upload className="h-12 w-12 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Unggah Dokumen PDF Anda</h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              Pilih satu atau beberapa file PDF dari komputer Anda. Anda dapat mengatur ulang urutan halaman dengan menyeretnya (drag & drop), atau memutarnya dan menghapus halaman yang tidak diinginkan.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-red-500 text-white hover:bg-red-600 font-semibold rounded-xl text-base shadow-lg shadow-red-500/20 transition cursor-pointer"
            >
              <Upload className="h-5 w-5" />
              <span>Pilih File PDF</span>
            </button>
          </div>
        )}

        {/* Workspace Columns */}
        {pages.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            
            {/* Left sidebar: File list & Actions */}
            <div className="w-full lg:w-80 bg-white border border-slate-200 rounded-2xl p-6 shrink-0 shadow-sm flex flex-col gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Dokumen Sumber</h3>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {files.map(file => (
                    <div key={file.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3">
                      <FileText className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {file.pageCount} Halaman • {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Ringkasan Output</h3>
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Total Halaman:</span>
                    <span className="font-bold text-slate-800">{pages.length} Halaman</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 font-medium">Jumlah Dokumen:</span>
                    <span className="font-bold text-slate-800">{files.length} File</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <button
                    onClick={exportPDF}
                    className="w-full inline-flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm shadow-md transition cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    <span>Unduh PDF Baru</span>
                  </button>
                  <button
                    onClick={clearAll}
                    className="w-full inline-flex items-center justify-center space-x-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm transition cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                    <span>Reset Semua</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-start space-x-2 text-xs text-slate-500 bg-slate-50/50 p-3 rounded-xl">
                  <HelpCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Petunjuk:</strong> Geser kartu halaman untuk mengubah urutan, atau gunakan tombol panah <ChevronUp className="h-3 w-3 inline" /> <ChevronDown className="h-3 w-3 inline" /> untuk memindahkannya ke atas/bawah. Gunakan tombol <RotateCw className="h-3 w-3 inline" /> untuk merotasi halaman 90 derajat.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Pages Grid */}
            <div className="flex-1 w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 m-0">Tata Letak Halaman</h2>
                  <p className="text-xs text-slate-500 m-0">Atur halaman di bawah ini sesuka Anda</p>
                </div>
                <div className="text-xs text-slate-400 font-medium">
                  {pages.length} Halaman Siap
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
                {pages.map((page, index) => {
                  const isDragged = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;

                  return (
                    <div
                      key={page.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`group relative border rounded-xl bg-slate-50 flex flex-col p-2.5 transition-all select-none ${
                        isDragged ? 'opacity-30 border-blue-500 bg-blue-50/20' : ''
                      } ${
                        isDragOver ? 'border-dashed border-red-500 scale-105 bg-red-50/10' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      {/* Drag handle / Hover Overlay */}
                      <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
                        <button
                          onClick={() => setPreviewPage(page)}
                          className="bg-white border border-slate-200 p-1.5 rounded-lg text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer"
                          title="Lihat Detail Halaman"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => rotatePage(index)}
                          className="bg-white border border-slate-200 p-1.5 rounded-lg text-slate-600 hover:text-slate-900 shadow-xs cursor-pointer"
                          title="Putar 90°"
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deletePage(index)}
                          className="bg-white border border-slate-200 p-1.5 rounded-lg text-red-500 hover:text-red-700 shadow-xs cursor-pointer"
                          title="Hapus Halaman"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Thumbnail Container */}
                      <div className="aspect-3/4 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing mb-3">
                        <img
                          src={page.thumbnailUrl}
                          alt={`Halaman ${index + 1}`}
                          className="max-h-full max-w-full object-contain transition-transform"
                          style={{
                            transform: `rotate(${page.rotation}deg)`,
                          }}
                        />
                        {/* Page number badge */}
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/70 backdrop-blur-xs text-white rounded text-[10px] font-bold">
                          {index + 1}
                        </div>
                      </div>

                      {/* Source details */}
                      <div className="mt-auto">
                        <p className="text-[10px] font-bold text-slate-800 truncate" title={page.fileName}>
                          {page.fileName}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">
                          Hal Asli: {page.originalPageNumber + 1}
                        </p>
                      </div>

                      {/* Move controls for mobile/accessibility */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200 flex justify-between items-center gap-1.5">
                        <button
                          onClick={() => movePage(index, 'up')}
                          disabled={index === 0}
                          className="flex-1 py-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                          title="Pindah Kiri/Atas"
                        >
                          <ChevronUp className="h-3.5 w-3.5 rotate-270" />
                        </button>
                        <button
                          onClick={() => movePage(index, 'down')}
                          disabled={index === pages.length - 1}
                          className="flex-1 py-1 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                          title="Pindah Kanan/Bawah"
                        >
                          <ChevronDown className="h-3.5 w-3.5 rotate-270" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Preview Modal */}
      {previewPage && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full flex flex-col shadow-2xl overflow-hidden max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 truncate max-w-xs">{previewPage.fileName}</h3>
                <p className="text-xs text-slate-500">Halaman Asli: {previewPage.originalPageNumber + 1}</p>
              </div>
              <button
                onClick={() => setPreviewPage(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center bg-slate-100">
              <div className="shadow-lg rounded-lg border border-slate-200 bg-white p-2">
                <img
                  src={previewPage.thumbnailUrl}
                  alt="Detail Halaman"
                  className="max-w-full max-h-[50vh] object-contain"
                  style={{
                    transform: `rotate(${previewPage.rotation}deg)`,
                  }}
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between">
              <button
                onClick={() => {
                  const idx = pages.findIndex(p => p.id === previewPage.id);
                  if (idx !== -1) rotatePage(idx);
                  setPreviewPage(prev => prev ? { ...prev, rotation: (prev.rotation + 90) % 360 } : null);
                }}
                className="inline-flex items-center space-x-2 px-4 py-2 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                <RotateCw className="h-4 w-4" />
                <span>Putar Halaman</span>
              </button>
              <button
                onClick={() => {
                  const idx = pages.findIndex(p => p.id === previewPage.id);
                  if (idx !== -1) {
                    deletePage(idx);
                    setPreviewPage(null);
                  }
                }}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl text-sm font-semibold transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>Hapus Halaman</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-slate-400 font-medium">
          Dibuat oleh Urbays 2026 
        </div>
      </footer>
    </div>
  );
}
