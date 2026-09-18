require('dotenv').config();
const mongoose = require('mongoose');
const sharp = require('sharp');

const compressStudentDataUrl = async (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed || !trimmed.startsWith('data:image')) return trimmed;

  try {
    const match = trimmed.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!match) return trimmed;

    const buffer = Buffer.from(match[2], 'base64');
    const compressed = await sharp(buffer)
      .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 68, mozjpeg: true })
      .toBuffer();

    return `data:image/jpeg;base64,${compressed.toString('base64')}`;
  } catch (error) {
    console.warn('Student picture compression failed:', error.message);
    return trimmed;
  }
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const Student = mongoose.model(
    'Student',
    new mongoose.Schema(
      {
        student_id: String,
        full_name: String,
        picture: String,
        student_class: String
      },
      { collection: 'students' }
    )
  );

  const students = await Student.find({ picture: { $regex: '^data:image' } }).lean();
  console.log(`Found ${students.length} student records with embedded image data.`);

  let updated = 0;
  for (const student of students) {
    const nextPicture = await compressStudentDataUrl(student.picture);
    if (nextPicture !== student.picture) {
      await Student.updateOne({ _id: student._id }, { $set: { picture: nextPicture } });
      updated += 1;
      if (updated % 10 === 0 || updated === students.length) {
        console.log(`Compressed ${updated}/${students.length} records...`);
      }
    }
  }

  console.log(`Compression complete. Updated ${updated} student photo records.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Compression script failed:', error);
  process.exit(1);
});
