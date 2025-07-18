import React from 'react';
import ImageUploader from './components/ImageUploader';

function App() {
  return (
    // Versión sin Flexbox: El centrado se controla con 'mx-auto' en el <main>.
    <div className="bg-gray-900 text-white min-h-screen py-12 px-4">
      <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-blue-500">
          Renombrador de Imágenes Full-Stack
        </h1>
        <p className="text-gray-400 mt-2">
          Construido con React, Node.js y Supabase.
        </p>
      </header>
      
      {/* La clase 'mx-auto' en este elemento se encarga del centrado horizontal */}
      <main className="w-full max-w-4xl mx-auto bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8">
        <ImageUploader />
      </main>
    </div>
  );
}

export default App;
