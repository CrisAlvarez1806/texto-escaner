const express = require('express');
const multer = require('multer');
const {Storage} = require('@google-cloud/storage');
const vision = require('@google-cloud/vision');
const {Firestore} = require('@google-cloud/firestore');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

const storage = new Storage();
const bucket = storage.bucket('bucket-proyecto1');
const visionClient = new vision.ImageAnnotatorClient();
const db = new Firestore();

const palabrasProhibidas = ['violencia', 'grosería', 'odio','sangre','borracho','chantaje'];app.use(express.static('public'));

app.post('/subir', upload.single('imagen'), async (req, res) => {
  const { titulo } = req.body;
  const archivoLocal = req.file.path;
  const nombreRemoto = Date.now() + path.extname(req.file.originalname);
  const archivoRemoto = bucket.file(nombreRemoto);

  try {
    await bucket.upload(archivoLocal, { destination: archivoRemoto });
    fs.unlinkSync(archivoLocal); // Borra archivo local

    const [result] = await visionClient.textDetection(`gs://${bucket.name}/${nombreRemoto}`);
    const texto = result.textAnnotations[0]?.description || '';
    const palabrasDetectadas = palabrasProhibidas.filter(p => texto.toLowerCase().includes(p));
    const edadSugerida = palabrasDetectadas.length > 0 ? '12+' : '6+';

    await db.collection('librosClasificados').add({
      titulo,
      textoDetectado: texto,
      palabrasDetectadas,
      edadSugerida,
      fecha: new Date()
    });

    res.send({ titulo, edadSugerida, palabrasDetectadas });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al procesar la imagen');
  }
});

app.listen(8080, () => console.log('Servidor activo en puerto 8080'));
