/*
  =====================================
  ARCHIVO: backend/index.js
  =====================================
*/
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// --- CONFIGURACIÓN ---
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Configuración de Multer para manejar la subida de archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Configuración de Clientes de API
// Gemini: Asegúrate de tener la variable de entorno GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Supabase: Asegúrate de tener las variables de entorno para Supabase
const supabase = createClient(process.env.SUPABASE_PROJECT_URL, process.env.SUPABASE_ANON_KEY);


// --- RUTAS DE LA API ---
app.get('/', (req, res) => {
  res.send('El servidor del renombrador de imágenes está funcionando!');
});

app.post('/api/rename', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ninguna imagen.' });
  }

  try {
    // 1. Lógica para llamar a Gemini AI
    // --- CAMBIO IMPORTANTE: Usando un modelo más reciente ---
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = "Analiza esta imagen y genera un nombre de archivo conciso y descriptivo para ella en formato-kebab-case. Responde únicamente con el nombre de archivo generado, sin la extensión.";
    
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const newNameRaw = response.text();
    
    // Limpieza del nombre de archivo para asegurar el formato
    const newName = newNameRaw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
    const originalName = req.file.originalname;

    // 2. Guardar en la base de datos de Supabase
    const { data, error } = await supabase
      .from('processed_images')
      .insert([
        { original_name: originalName, new_name: newName },
      ])
      .select();

    if (error) {
      // Si hay un error con Supabase, lo registramos pero no detenemos la respuesta al usuario
      console.error(`Error de Supabase: ${error.message}`);
      // Podrías decidir si quieres enviar un error al cliente o no.
      // Por ahora, continuaremos y le daremos el nombre al usuario.
    }

    // 3. Enviar respuesta al cliente
    res.status(200).json({
      originalName: originalName,
      newName: newName
    });

  } catch (error) {
    console.error("Error en el procesamiento de la imagen:", error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la imagen.' });
  }
});


// --- INICIAR SERVIDOR ---
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
