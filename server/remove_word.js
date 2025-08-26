const fs = require('fs');
const path = require('path');

const wordsFilePath = path.join(__dirname, 'words.json');

// Get the word to remove from command line arguments
const wordToRemove = process.argv[2];

if (!wordToRemove) {
  console.error('Usage: node remove_word.js <word_to_remove>');
  process.exit(1);
}

fs.readFile(wordsFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading words file:', err);
    return;
  }

  try {
    let words = JSON.parse(data);
    const originalLength = words.length;
    const lowerWordToRemove = wordToRemove.toLowerCase();

    const filteredWords = words.filter(pair => 
      pair.civilian.toLowerCase() !== lowerWordToRemove &&
      pair.undercover.toLowerCase() !== lowerWordToRemove
    );

    if (filteredWords.length === originalLength) {
      console.log(`Word "${wordToRemove}" not found in any pair.`);
      return;
    }

    fs.writeFile(wordsFilePath, JSON.stringify(filteredWords, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Error writing to words file:', writeErr);
        return;
      }
      console.log(`Successfully removed the word pair containing "${wordToRemove}".`);
    });
  } catch (parseErr) {
    console.error('Error parsing words.json:', parseErr);
  }
});
