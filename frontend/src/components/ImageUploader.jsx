import React, { useState, useMemo } from 'react';
import JSZip from 'jszip';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ImageUploader = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  // --- NUEVO ESTADO: Para guardar las instrucciones del usuario ---
  const [namingStyle, setNamingStyle] = useState('');

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files).map((file, index) => ({
      id: `file-${index}-${Date.now()}`,
      file: file,
      status: 'pendiente',
      originalName: file.name,
      newName: null,
      objectURL: URL.createObjectURL(file),
    }));
    setFiles(selectedFiles);
  };

  const handleProcessImages = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);

    for (const fileData of files) {
      if (fileData.status === 'pendiente') {
        setFiles(prevFiles => prevFiles.map(f => f.id === fileData.id ? { ...f, status: 'analizando' } : f));
        
        const formData = new FormData();
        formData.append('image', fileData.file);
        // --- MEJORA: Añadir las instrucciones al formulario ---
        formData.append('style', namingStyle);

        try {
          const response = await fetch(`${API_URL}/api/rename`, {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) throw new Error(`Error en la respuesta del servidor: ${response.statusText}`);
          const result = await response.json();
          const extension = fileData.originalName.split('.').pop();
          const finalNewName = `${result.newName}.${extension}`;
          setFiles(prevFiles => prevFiles.map(f => f.id === fileData.id ? { ...f, status: 'listo', newName: finalNewName } : f));
        } catch (error) {
          console.error(`Error procesando ${fileData.originalName}:`, error);
          setFiles(prevFiles => prevFiles.map(f => f.id === fileData.id ? { ...f, status: 'error' } : f));
        }
      }
    }
    setIsProcessing(false);
  };

  const handleDownloadAll = async () => {
    const processedFiles = files.filter(f => f.status === 'listo');
    if (processedFiles.length === 0) return;
    setIsZipping(true);
    const zip = new JSZip();
    try {
      const filePromises = processedFiles.map(async (fileData) => {
        const response = await fetch(fileData.objectURL);
        const blob = await response.blob();
        zip.file(fileData.newName, blob);
      });
      await Promise.all(filePromises);
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = 'imagenes-renombradas.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error al crear el archivo ZIP:", error);
    } finally {
      setIsZipping(false);
    }
  };

  const hasProcessedFiles = useMemo(() => files.some(f => f.status === 'listo'), [files]);

  return (
    <div>
      {/* --- NUEVO CAMPO DE TEXTO PARA INSTRUCCIONES --- */}
      <div className="mb-6">
        <label htmlFor="style-input" className="block text-sm font-medium text-gray-300 mb-2">
          Estilo de Nombres (Opcional):
        </label>
        <textarea
          id="style-input"
          rows="2"
          className="w-full p-2 bg-gray-700 rounded-md text-white border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          placeholder="Ej: usar solo nombres de animales, que todos los nombres empiecen con 'factura-', etc."
          value={namingStyle}
          onChange={(e) => setNamingStyle(e.target.value)}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <label htmlFor="image-input" className="w-full sm:w-auto cursor-pointer flex-grow text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105">
          Seleccionar Imágenes
        </label>
        <input type="file" id="image-input" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
        <button onClick={handleProcessImages} disabled={isProcessing || isZipping} className="w-full sm:w-auto flex-grow text-center bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
          {isProcessing ? 'Procesando...' : 'Iniciar Procesamiento'}
        </button>
        <button onClick={handleDownloadAll} disabled={!hasProcessedFiles || isProcessing || isZipping} className="w-full sm:w-auto flex-grow text-center bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
          {isZipping ? 'Comprimiendo...' : 'Descargar Todo (.zip)'}
        </button>
      </div>
      
      <div className="space-y-3">
        {files.map(fileData => (
          <FileRow key={fileData.id} fileData={fileData} />
        ))}
      </div>
    </div>
  );
};

// Componente para cada fila de archivo (sin cambios)
const FileRow = ({ fileData }) => {
    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = fileData.objectURL;
        link.download = fileData.newName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    return (
      <div className="bg-gray-700/60 p-3 rounded-lg flex items-center gap-4 transition-all">
        <img src={fileData.objectURL} alt="thumbnail" className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
        <div className="flex-grow overflow-hidden">
          <p className="text-sm font-medium text-gray-200 truncate" title={fileData.originalName}>{fileData.originalName}</p>
          <p className={`text-xs ${fileData.status === 'listo' ? 'text-green-300 font-semibold' : 'text-gray-400'}`}>
            {fileData.status === 'listo' ? fileData.newName : 'El nuevo nombre aparecerá aquí...'}
          </p>
        </div>
        <div className="status-indicator w-24 text-center flex-shrink-0">
          <StatusBadge status={fileData.status} />
        </div>
        <div className="action-button w-32 text-right flex-shrink-0">
          {fileData.status === 'listo' && (
            <button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 px-4 rounded-lg transition">
              Descargar
            </button>
          )}
        </div>
      </div>
    );
}


// Componente para el indicador de estado (sin cambios)
const StatusBadge = ({ status }) => {
  switch (status) {
    case 'analizando':
      return <div className="loader-sm mx-auto animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>;
    case 'listo':
      return <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full">Listo</span>;
    case 'error':
      return <span className="bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded-full">Error</span>;
    default:
      return <span className="bg-yellow-500 text-white text-xs font-semibold px-2 py-1 rounded-full">Pendiente</span>;
  }
};

export default ImageUploader;
