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

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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
    const userExample = req.body.style || '';
    let prompt;

    // --- MEJORA: Construir un prompt que enseña a la IA a razonar ---
    if (userExample) {
      const exampleKebab = userExample
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-');

      prompt = `Tu tarea es actuar como un experto en catalogación de productos y crear un nombre de archivo descriptivo en formato kebab-case para la imagen proporcionada.

Usa el siguiente ejemplo como guía para tu razonamiento:
---
EJEMPLO GUÍA:
1.  **Nombre de Producto de Referencia:** "${userExample}"
2.  **Análisis de Atributos:** Para ese nombre, los atributos clave son el tipo de producto, la marca, la línea, el acabado, el color y el tamaño.
3.  **Nombre de Archivo Resultante:** "${exampleKebab}"
---

Ahora, aplica este mismo proceso a la imagen que te estoy enviando:
1.  **Analiza la imagen:** Identifica los atributos clave del producto que se muestra (tipo, marca, línea, etc.).
2.  **Construye el nombre:** Une los atributos que encontraste usando guiones.
3.  **Formatea el resultado:** Asegúrate de que todo esté en minúsculas.

Responde únicamente con el nombre de archivo final en formato kebab-case. No incluyas ninguna otra explicación.`;

    } else {
      // Si no se proporciona un ejemplo, se usa el prompt simple original.
      prompt = "Analiza esta imagen y genera un nombre de archivo conciso y descriptivo para ella en formato kebab-case. Responde únicamente con el nombre de archivo generado, sin la extensión.";
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const newNameRaw = response.text();
    
    const newName = newNameRaw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
    const originalName = req.file.originalname;

    const { data, error } = await supabase
      .from('processed_images')
      .insert([{ original_name: originalName, new_name: newName }])
      .select();

    if (error) {
      console.error(`Error de Supabase: ${error.message}`);
    }

    res.status(200).json({
      originalName: originalName,
      newName: newName
    });

  } catch (error) {
    console.error("Error en el procesamiento de la imagen:", error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la imagen.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
